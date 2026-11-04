import { useSyncExternalStore } from 'react'

export type Papel = 'decisor' | 'analista'

/** Quem está logado. Empresa e papel vêm do token (claims `empresaId` e `role`). */
export type Usuario = {
  email: string
  papel: Papel | null
  empresaId: string | null
}

/**
 * De onde vem a sessão. Em produção e com o emulador é o Firebase Auth (`lib/firebase.ts`);
 * com a API simulada é um login falso com os mesmos usuários do seed do back (`mocks/sessao.ts`).
 */
export interface ProvedorSessao {
  /** Avisa quando a sessão muda (entrou, saiu, token renovado). Devolve a função para parar de ouvir. */
  observar(aoMudar: (usuario: Usuario | null) => void): () => void
  entrar(email: string, senha: string): Promise<Usuario>
  sair(): Promise<void>
  /** ID token para o cabeçalho Authorization, ou null sem ninguém logado. */
  token(): Promise<string | null>
  /** Pede um token novo (ex.: depois que o back grava empresa e papel no primeiro PUT /perfil). */
  renovar(): Promise<void>
}

/** Login recusado (e-mail ou senha errados, muitas tentativas, sem conexão). */
export class ErroDeLogin extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroDeLogin'
  }
}

/** Por que a sessão terminou, quando não foi a pessoa que clicou em Sair. */
export type MotivoDaSaida = 'sessao-expirada'

type Estado = { carregando: boolean; usuario: Usuario | null; motivoDaSaida?: MotivoDaSaida }

let provedor: ProvedorSessao | null = null
let estado: Estado = { carregando: true, usuario: null }
let pararDeOuvir: (() => void) | null = null
let motivoDaSaida: MotivoDaSaida | undefined
const ouvintes = new Set<() => void>()

function publicar(novo: Estado) {
  estado = novo
  ouvintes.forEach((ouvinte) => ouvinte())
}

/** Escolhe o provedor de sessão. Chamado uma vez no main.tsx (e nos testes). */
export function configurarSessao(novo: ProvedorSessao) {
  pararDeOuvir?.()
  provedor = novo
  publicar({ carregando: true, usuario: null })
  motivoDaSaida = undefined
  pararDeOuvir = novo.observar((usuario) => {
    // Entrou de novo: o aviso de sessão expirada não vale mais.
    if (usuario) motivoDaSaida = undefined
    publicar({ carregando: false, usuario, motivoDaSaida })
  })
}

function exigirProvedor() {
  if (!provedor) throw new Error('Sessão não configurada: chame configurarSessao no main.tsx.')
  return provedor
}

export const sessao = {
  entrar: (email: string, senha: string) => exigirProvedor().entrar(email, senha),
  /** Encerra a sessão. Com motivo, a tela de login explica por que a pessoa saiu. */
  sair: (motivo?: MotivoDaSaida) => {
    motivoDaSaida = motivo
    return exigirProvedor().sair()
  },
  token: () => provedor?.token() ?? Promise.resolve(null),
  renovar: () => provedor?.renovar() ?? Promise.resolve(),
  atual: () => estado,
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

/** Sessão atual para as telas: `carregando` até o provedor responder pela primeira vez. */
export function useSessao(): Estado {
  return useSyncExternalStore(assinar, () => estado)
}
