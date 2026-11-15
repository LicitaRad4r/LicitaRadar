import { createHash } from 'node:crypto'
import type { Edital } from '../dominio/edital.js'
import { diaBrasilia, diasCorridos } from '../dominio/tempo.js'
import { regraDeNegocio } from '../erros.js'

/** Etapas fixas do acompanhamento (US20), na ordem em que avançam. */
export const ETAPAS = ['interessado', 'preparando', 'enviado', 'resultado'] as const
export type Etapa = (typeof ETAPAS)[number]

export const RESULTADOS = ['venceu', 'nao_venceu'] as const
export type ResultadoAcompanhamento = (typeof RESULTADOS)[number]

/**
 * `inicial` = interessado ou preparando (a proposta ainda não foi enviada); `final` = enviado ou resultado.
 * Gravada junto com a etapa porque a listagem separa os itens por fase em consultas do Firestore.
 */
export type Fase = 'inicial' | 'final'
export const faseDe = (etapa: Etapa): Fase => (etapa === 'interessado' || etapa === 'preparando' ? 'inicial' : 'final')

/** Destaque do prazo: vence em 0 a 3 dias corridos (horário de Brasília), como a US16 nas certidões. */
export const DIAS_DE_DESTAQUE = 3

/** Só avança uma etapa por vez; a única volta permitida é de preparando para interessado. */
const TRANSICOES: Readonly<Record<Etapa, readonly Etapa[]>> = {
  interessado: ['preparando'],
  preparando: ['enviado', 'interessado'],
  enviado: ['resultado'],
  resultado: [],
}
export const transicaoPermitida = (de: Etapa, para: Etapa): boolean => TRANSICOES[de].includes(para)

/** Registro como é gravado (o `id` é o id do documento). O prazo e os dados do edital são uma cópia da hora da criação. */
export interface AcompanhamentoRegistro {
  id: string
  empresaId: string
  editalId: string
  etapa: Etapa
  fase: Fase
  /** Só preenchido na etapa `resultado`. */
  resultado: ResultadoAcompanhamento | null
  titulo: string
  orgao: string
  uf: string
  /** Prazo do edital, ISO 8601 (para exibir). */
  prazo: string
  /** Prazo do edital em ms desde 1970 (para ordenar e separar a listagem no banco). */
  prazoEm: number
  criadoEm: string
  atualizadoEm: string
}

/**
 * Id do documento: determinístico (uma empresa não acompanha o mesmo edital duas vezes, sem precisar de transação)
 * e opaco (não expõe o `empresaId` na URL nem deixa adivinhar o id de outra empresa).
 */
export const idDoAcompanhamento = (empresaId: string, editalId: string): string =>
  createHash('sha256').update(`${empresaId}\n${editalId}`).digest('hex').slice(0, 32)

/** Novo acompanhamento de um edital, na etapa `interessado` (ou na que o seed pedir). */
export function novoAcompanhamento(empresaId: string, edital: Edital, agora: Date, etapa: Etapa = 'interessado'): AcompanhamentoRegistro {
  const prazoEm = new Date(edital.dataLimite).getTime()
  if (!Number.isFinite(prazoEm)) throw new Error('Edital com prazo inválido.')
  const hora = agora.toISOString()
  return {
    id: idDoAcompanhamento(empresaId, edital.id),
    empresaId,
    editalId: edital.id,
    etapa,
    fase: faseDe(etapa),
    resultado: null,
    titulo: edital.objeto,
    orgao: edital.orgao,
    uf: edital.uf,
    prazo: edital.dataLimite,
    prazoEm,
    criadoEm: hora,
    atualizadoEm: hora,
  }
}

export interface PedidoDeEtapa {
  etapa: Etapa
  resultado?: ResultadoAcompanhamento
}

/**
 * Muda a etapa. Qualquer transição fora das permitidas é 422 e nada muda; depois de `resultado` o acompanhamento
 * não muda mais. Grava `atualizadoEm`.
 */
export function aplicarTransicao(atual: AcompanhamentoRegistro, pedido: PedidoDeEtapa, agora: Date): AcompanhamentoRegistro {
  if (atual.etapa === 'resultado') throw regraDeNegocio('O acompanhamento já tem resultado e não pode mais mudar.')
  if (!transicaoPermitida(atual.etapa, pedido.etapa)) {
    throw regraDeNegocio(`Não é possível ir de ${atual.etapa} para ${pedido.etapa}. Avance uma etapa por vez; só dá para voltar de preparando para interessado.`)
  }
  return {
    ...atual,
    etapa: pedido.etapa,
    fase: faseDe(pedido.etapa),
    resultado: pedido.etapa === 'resultado' ? (pedido.resultado ?? null) : null,
    atualizadoEm: agora.toISOString(),
  }
}

/** Só dá para remover enquanto a proposta não foi enviada (interessado ou preparando). */
export function validarRemocao(atual: AcompanhamentoRegistro): void {
  if (atual.fase === 'final') throw regraDeNegocio('Só é possível remover um acompanhamento em interessado ou preparando.')
}

/**
 * Prazo em dias de calendário de Brasília (negativo se já passou). Destaca de 0 a 3 dias; `encerrado` é o prazo
 * passado enquanto a proposta ainda não foi enviada (depois de enviada, o prazo vencido não é mais problema).
 */
export function classificarPrazo(r: Pick<AcompanhamentoRegistro, 'fase' | 'prazoEm'>, agora: Date) {
  const diasRestantes = diasCorridos(diaBrasilia(agora), diaBrasilia(new Date(r.prazoEm)))
  return {
    diasRestantes,
    destaque: diasRestantes >= 0 && diasRestantes <= DIAS_DE_DESTAQUE,
    encerrado: r.fase === 'inicial' && diasRestantes < 0,
  }
}

/**
 * Ordem da listagem: pelo prazo do edital (mais próximo primeiro), com os encerrados no fim. Como "encerrado" muda
 * com o relógio, a lista é cortada em três faixas, cada uma ordenada por prazo e depois por id:
 *   1. finais com prazo já passado (enviado/resultado: o prazo vencido não pesa)
 *   2. prazo de hoje em diante
 *   3. iniciais com prazo já passado (encerrados)
 * `hojeInicioMs` é a meia-noite de hoje em Brasília.
 */
export type Faixa = 'finais_vencidos' | 'em_prazo' | 'iniciais_vencidos'
export const FAIXAS: readonly Faixa[] = ['finais_vencidos', 'em_prazo', 'iniciais_vencidos']

export function faixaDe(r: Pick<AcompanhamentoRegistro, 'fase' | 'prazoEm'>, hojeInicioMs: number): Faixa {
  if (r.prazoEm >= hojeInicioMs) return 'em_prazo'
  return r.fase === 'final' ? 'finais_vencidos' : 'iniciais_vencidos'
}

/** Faixas que uma consulta percorre. Com filtro de etapa, a fase já está definida e uma das faixas vencidas some. */
export function faixasDaConsulta(etapa?: Etapa): readonly Faixa[] {
  if (!etapa) return FAIXAS
  return faseDe(etapa) === 'final' ? ['finais_vencidos', 'em_prazo'] : ['em_prazo', 'iniciais_vencidos']
}

/** Resposta da API para um acompanhamento (campos do contrato `Acompanhamento`). */
export function paraResposta(r: AcompanhamentoRegistro, agora: Date) {
  return {
    id: r.id,
    editalId: r.editalId,
    etapa: r.etapa,
    resultado: r.resultado,
    titulo: r.titulo,
    orgao: r.orgao,
    uf: r.uf,
    prazo: r.prazo,
    ...classificarPrazo(r, agora),
    criadoEm: r.criadoEm,
    atualizadoEm: r.atualizadoEm,
  }
}
