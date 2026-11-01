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

const publica = (req: FastifyRequest) => req.url.split('?')[0] === '/health' // única rota pública

/**
 * Hook único de segurança (CT-SEG-001 a 011). Toda rota passa por aqui, inclusive as inexistentes:
 * 1. `onRequest`: valida o token ANTES de ler o corpo, então sem token é sempre 401, mesmo com corpo inválido.
 * 2. `preHandler`: a empresa vem só do token; `orgId`/`empresaId` de outra empresa, na query ou no corpo, é 403.
 */
export function registrarAuth(app: FastifyInstance, verificar: VerificarToken) {
  app.decorateRequest('usuario', undefined)

  app.addHook('onRequest', async (req) => {
    if (publica(req)) return
    const cabecalho = req.headers.authorization ?? ''
    const [tipo, token] = cabecalho.split(' ')
    if (tipo !== 'Bearer' || !token) throw naoAutenticado()
    try {
      req.usuario = await verificar(token)
    } catch (e) {
      const codigo = (e as { code?: string } | null)?.code
      throw naoAutenticado(codigo === TOKEN_EXPIRADO ? 'Sessão expirada. Faça login novamente.' : undefined)
    }
  })

  app.addHook('preHandler', async (req) => {
    if (publica(req)) return
    const usuario = usuarioDe(req)
    const corpo = typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {}
    for (const origem of [(req.query ?? {}) as Record<string, unknown>, corpo]) {
      for (const chave of ['orgId', 'empresaId']) {
        const valor = origem[chave]
        if (valor !== undefined && valor !== usuario.empresaId) throw acessoNegado()
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
