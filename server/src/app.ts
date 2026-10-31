import type { Writable } from 'node:stream'
import Fastify, { LogController, type FastifyInstance } from 'fastify'
import { registrarAuth, type VerificarToken } from './auth.js'
import type { Relogio } from './dominio/tempo.js'
import { registrarErros } from './erros.js'
import type { FeedRepo } from './feed/repositorio.js'
import { rotasFeed } from './feed/rotas.js'
import type { DefinirClaims, PerfilRepo } from './perfil/repositorio.js'
import { rotasPerfil } from './perfil/rotas.js'

export interface Dependencias {
  verificarToken: VerificarToken
  definirClaims: DefinirClaims
  perfis: PerfilRepo
  feed: FeedRepo
  /** Relógio injetável (testes usam data fixa). */
  agora?: Relogio
  logger?: boolean
  /** Só para testes: captura os logs. */
  logStream?: Writable
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Rotas registradas (usado no teste de "100% das rotas protegidas"). */
    rotas: string[]
  }
}

/** Prefixos servidos: `/v1` (contrato) e sem prefixo (plano do CP2 e testes do QA). */
const PREFIXOS = ['/v1', '']

/** Monta a API sem abrir porta (usado pelo servidor e pelos testes). */
export function buildApp(deps: Dependencias): FastifyInstance {
  const logger = deps.logStream ? { level: 'info', stream: deps.logStream } : (deps.logger ?? true)
  // Sem o log padrão de requisição (traz a URL); logamos só requestId, rota e status.
  const app = Fastify({ logger, logController: new LogController({ disableRequestLogging: true }) })

  const rotas: string[] = []
  app.decorate('rotas', rotas)
  app.addHook('onRoute', (r) => {
    for (const m of [r.method].flat()) if (m !== 'HEAD') rotas.push(`${m} ${r.url}`)
  })
  app.addHook('onResponse', async (req, reply) => {
    req.log.info({ requestId: req.id, route: req.routeOptions.url, status: reply.statusCode }, 'requisicao')
  })

  registrarErros(app)
  registrarAuth(app, deps.verificarToken)

  app.get('/health', async () => ({ status: 'ok', timestamp: (deps.agora?.() ?? new Date()).toISOString() }))
  for (const prefix of PREFIXOS) {
    app.register(
      async (rotasDoPrefixo) => {
        rotasPerfil(rotasDoPrefixo, deps.perfis, deps.definirClaims)
        rotasFeed(rotasDoPrefixo, deps.feed)
      },
      { prefix },
    )
  }

  return app
}
