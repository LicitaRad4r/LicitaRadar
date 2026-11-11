import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { acessoNegado, naoAutenticado, semEmpresa } from './erros.js'

export type Papel = 'decisor' | 'analista'

export interface Usuario {
  uid: string
  empresaId?: string
  role?: Papel
}

/** Verifica um ID token e devolve o usuário. Lança erro se for inválido. */
export type VerificarToken = (token: string) => Promise<Usuario>

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: Usuario
  }
}

const TOKEN_EXPIRADO = 'auth/id-token-expired'

const caminho = (req: FastifyRequest) => req.url.split('?')[0]

/** Rotas públicas: só as de saúde (sem dados). */
export const ROTAS_PUBLICAS = ['/health', '/healthz', '/readyz']
const publica = (req: FastifyRequest) => ROTAS_PUBLICAS.includes(caminho(req) ?? '')

/** Rota do job de ingestão: autentica com o token do job (`INGEST_JOB_TOKEN`), nunca com token do Firebase. */
export const ROTA_JOB = '/jobs/ingestao-pncp'
const ehJob = (req: FastifyRequest) => caminho(req) === ROTA_JOB

const resumo = (texto: string) => createHash('sha256').update(texto).digest()
/** Comparação em tempo constante (os dois lados passam por SHA-256 para terem o mesmo tamanho). */
const tokenConfere = (recebido: string, esperado: string) => timingSafeEqual(resumo(recebido), resumo(esperado))

export interface OpcoesAuth {
  /** Token do job de ingestão. Sem ele configurado, a rota do job recusa tudo (401). */
  tokenJob?: string
}

/**
 * Hook único de segurança (CT-SEG-001 a 011). Toda rota passa por aqui, inclusive as inexistentes
 * (a rota do job usa o token do job; as de saúde são públicas):
 * 1. `onRequest`: valida o token ANTES de ler o corpo, então sem token é sempre 401, mesmo com corpo inválido.
 * 2. `preHandler`: a empresa vem só do token; `orgId`/`empresaId` de outra empresa, na query ou no corpo, é 403.
 */
export function registrarAuth(app: FastifyInstance, verificar: VerificarToken, opcoes: OpcoesAuth = {}) {
  app.decorateRequest('usuario', undefined)

  app.addHook('onRequest', async (req) => {
    if (publica(req)) return
    const cabecalho = req.headers.authorization ?? ''
    const [tipo, token] = cabecalho.split(' ')
    if (tipo !== 'Bearer' || !token) throw naoAutenticado()
    if (ehJob(req)) {
      // Job: só o token do job vale. Sem token configurado no servidor, nenhum valor passa.
      if (!opcoes.tokenJob || !tokenConfere(token, opcoes.tokenJob)) throw naoAutenticado()
      return
    }
    try {
      req.usuario = await verificar(token)
    } catch (e) {
      const codigo = (e as { code?: string } | null)?.code
      throw naoAutenticado(codigo === TOKEN_EXPIRADO ? 'Sessão expirada. Faça login novamente.' : undefined)
    }
  })

  app.addHook('preHandler', async (req) => {
    if (publica(req) || ehJob(req)) return
    const usuario = usuarioDe(req)
    const corpo = typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {}
    for (const origem of [(req.query ?? {}) as Record<string, unknown>, corpo]) {
      for (const chave of ['orgId', 'empresaId']) {
        const valor = origem[chave]
        // `null` é o eco do `empresaId` do GET /perfil de quem ainda não tem empresa: não é outra empresa.
        if (valor !== undefined && valor !== null && valor !== usuario.empresaId) throw acessoNegado()
      }
    }
  })
}

/** Usuário autenticado (rotas /v1). */
export function usuarioDe(req: FastifyRequest): Usuario {
  if (!req.usuario) throw naoAutenticado()
  return req.usuario
}

/** Rotas de negócio: exige os claims `empresaId` e `role` (senão 403 EMPRESA_NAO_CONFIGURADA). */
export function contextoDe(req: FastifyRequest): { uid: string; empresaId: string; role: Papel } {
  const { uid, empresaId, role } = usuarioDe(req)
  if (!empresaId || !role) throw semEmpresa()
  return { uid, empresaId, role }
}

export const empresaDe = (req: FastifyRequest): string => contextoDe(req).empresaId

/** Restringe a rota a certos papéis (senão 403 ACESSO_NEGADO). Ex.: certidões só para `decisor`. */
export function exigirPapel(req: FastifyRequest, ...permitidos: Papel[]) {
  const ctx = contextoDe(req)
  if (!permitidos.includes(ctx.role)) throw acessoNegado()
  return ctx
}

/** Garante que o recurso carregado pertence à empresa do token (senão 403 ACESSO_NEGADO). */
export function exigirMesmaEmpresa(req: FastifyRequest, empresaDoRecurso: string) {
  const ctx = contextoDe(req)
  if (ctx.empresaId !== empresaDoRecurso) throw acessoNegado()
  return ctx
}
