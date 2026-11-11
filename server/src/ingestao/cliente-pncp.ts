import { diaBrasilia, somarDias } from '../dominio/tempo.js'
import { CODIGOS_MODALIDADE_PADRAO } from './pncp.js'

/** Resultado de uma busca: contratações brutas (ainda não validadas) e as modalidades que falharam. */
export interface BuscaPncp {
  contratacoes: unknown[]
  falhas: string[]
}

export type FontePncp = (agora: Date) => Promise<BuscaPncp>

export interface OpcoesClientePncp {
  /** Base da API de consulta. Padrão: https://pncp.gov.br/api/consulta */
  baseUrl?: string
  /** Quantos dias à frente entram na busca (`dataFinal` da consulta de propostas em aberto). */
  diasAFrente?: number
  /** Teto de páginas por modalidade, para o job caber no tempo de uma requisição. */
  maxPaginas?: number
  tamanhoPagina?: number
  modalidades?: number[]
  tentativas?: number
  /** Pausa entre requisições, para não estourar o limite de taxa do PNCP (responde 429). */
  intervaloMs?: number
  timeoutMs?: number
  /** Injetáveis nos testes. */
  fetchImpl?: typeof fetch
  esperar?: (ms: number) => Promise<void>
}

export class ErroPncp extends Error {
  constructor(
    readonly status: number | null,
    mensagem: string,
  ) {
    super(mensagem)
  }
}

const BASE_PADRAO = 'https://pncp.gov.br/api/consulta'
/** Erros que valem nova tentativa. 400 e 422 são erro nosso e não se repetem. */
const REPETIVEIS = new Set([429, 500, 502, 503, 504])

/** Só o tipo e o código do erro de rede (ex.: TimeoutError, ECONNRESET): nunca a mensagem, que pode trazer a URL. */
function causaDeRede(e: unknown): string {
  const erro = e as { name?: string; code?: string; cause?: { code?: string } } | null
  return [erro?.name, erro?.cause?.code ?? erro?.code].filter(Boolean).join(' ') || 'erro desconhecido'
}

/** `HTTP 500` quando o PNCP respondeu; senão `sem resposta (TimeoutError)` etc. */
function descreverFalha(e: unknown): string {
  if (e instanceof ErroPncp && e.status) return `HTTP ${e.status}`
  const detalhe = e instanceof ErroPncp ? e.message.match(/\(([^)]*)\)/)?.[1] : undefined
  return detalhe ? `sem resposta (${detalhe})` : 'sem resposta'
}

/**
 * Espera antes de repetir. Respeita `Retry-After` (segundos ou data) quando vem. Sem ele: em 429 (limite de taxa do PNCP,
 * que não informa quando libera) 5 s, 10 s, 20 s… até 30 s; nos demais erros, 1 s, 2 s, 4 s… até 15 s.
 */
function esperaAntesDeRepetir(tentativa: number, status: number | null, retryAfter: string | null): number {
  const TETO = 30_000
  if (retryAfter) {
    const segundos = Number(retryAfter)
    const ms = Number.isFinite(segundos) ? segundos * 1000 : new Date(retryAfter).getTime() - Date.now()
    if (Number.isFinite(ms) && ms > 0) return Math.min(ms, TETO)
  }
  return status === 429 ? Math.min(5000 * 2 ** (tentativa - 1), TETO) : Math.min(1000 * 2 ** (tentativa - 1), 15_000)
}

/** Opções vindas do ambiente (`PNCP_BASE_URL`, `PNCP_DIAS_A_FRENTE`, `PNCP_MAX_PAGINAS`, `PNCP_INTERVALO_MS`); o que faltar usa o padrão. */
export function opcoesPncpDoAmbiente(env: Record<string, string | undefined> = process.env): OpcoesClientePncp {
  const numero = (nome: string): number | undefined => {
    const valor = env[nome]
    if (!valor) return undefined
    const n = Number(valor)
    if (!Number.isFinite(n) || n < 0) throw new Error(`${nome} inválida: ${valor}`)
    return n
  }
  return {
    baseUrl: env.PNCP_BASE_URL || undefined,
    diasAFrente: numero('PNCP_DIAS_A_FRENTE'),
    maxPaginas: numero('PNCP_MAX_PAGINAS'),
    intervaloMs: numero('PNCP_INTERVALO_MS'),
  }
}

const aaaammdd = (dia: string) => dia.replaceAll('-', '')
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

interface PaginaPncp {
  data?: unknown
  totalPaginas?: number
  paginasRestantes?: number
}

/**
 * Busca no PNCP as contratações com proposta em aberto, uma modalidade por vez
 * (a API exige o código da modalidade) e página a página.
 */
export function criarFontePncp(opcoes: OpcoesClientePncp = {}): FontePncp {
  const {
    baseUrl = BASE_PADRAO,
    diasAFrente = 30,
    maxPaginas = 3,
    tamanhoPagina = 50,
    modalidades = CODIGOS_MODALIDADE_PADRAO,
    tentativas = 4,
    intervaloMs = 5000,
    timeoutMs = 20_000,
    fetchImpl = fetch,
    esperar = dormir,
  } = opcoes

  async function buscarPagina(url: string): Promise<PaginaPncp | null> {
    let ultimo: ErroPncp = new ErroPncp(null, 'Falha ao consultar o PNCP.')
    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
      let retryAfter: string | null = null
      try {
        const r = await fetchImpl(url, {
          headers: { accept: 'application/json', 'user-agent': 'LicitaRadar-ingestao' },
          signal: AbortSignal.timeout(timeoutMs),
        })
        // Sem resultado, o PNCP responde 204 (sem corpo).
        if (r.status === 204) return null
        if (r.ok) return (await r.json()) as PaginaPncp
        retryAfter = r.headers.get('retry-after')
        ultimo = new ErroPncp(r.status, `PNCP respondeu ${r.status}.`)
        if (!REPETIVEIS.has(r.status)) throw ultimo
      } catch (e) {
        if (e instanceof ErroPncp && !REPETIVEIS.has(e.status ?? 0)) throw e
        ultimo = e instanceof ErroPncp ? e : new ErroPncp(null, `PNCP indisponível ou sem resposta (${causaDeRede(e)}).`)
      }
      if (tentativa < tentativas) await esperar(esperaAntesDeRepetir(tentativa, ultimo.status, retryAfter))
    }
    throw ultimo
  }

  return async (agora) => {
    const dataFinal = aaaammdd(somarDias(diaBrasilia(agora), diasAFrente))
    const contratacoes: unknown[] = []
    const falhas: string[] = []

    let primeira = true
    for (const codigo of modalidades) {
      try {
        for (let pagina = 1; pagina <= maxPaginas; pagina++) {
          const url = `${baseUrl.replace(/\/$/, '')}/v1/contratacoes/proposta?${new URLSearchParams({
            dataFinal,
            codigoModalidadeContratacao: String(codigo),
            pagina: String(pagina),
            tamanhoPagina: String(tamanhoPagina),
          })}`
          // Ritmo constante: uma pausa curta entre requisições (menos a primeira).
          if (!primeira) await esperar(intervaloMs)
          primeira = false
          const resposta = await buscarPagina(url)
          if (!resposta || !Array.isArray(resposta.data) || resposta.data.length === 0) break
          contratacoes.push(...resposta.data)
          const restantes = resposta.paginasRestantes ?? (resposta.totalPaginas !== undefined ? resposta.totalPaginas - pagina : 0)
          if (restantes <= 0) break
        }
      } catch (e) {
        falhas.push(`modalidade ${codigo}: ${descreverFalha(e)}`)
      }
    }

    // Só é erro quando nada foi coletado: se algumas páginas vieram, a ingestão segue e as falhas são informadas.
    if (falhas.length === modalidades.length && contratacoes.length === 0) throw new ErroPncp(null, `Nenhuma modalidade pôde ser consultada no PNCP. ${falhas.join('; ')}`)
    return { contratacoes, falhas }
  }
}
