import type { Writable } from 'node:stream'
import { randomUUID } from 'node:crypto'
import multipart from '@fastify/multipart'
import Fastify, { LogController, type FastifyInstance } from 'fastify'
import { rotasCertidoes } from './certidoes/rotas.js'
import type { ArmazenamentoArquivos, CertidaoRepo } from './certidoes/repositorio.js'
import { registrarAuth, type VerificarToken } from './auth.js'
import type { Relogio } from './dominio/tempo.js'
import { registrarErros } from './erros.js'
import type { FeedRepo } from './feed/repositorio.js'
import { rotasFeed } from './feed/rotas.js'
import { rotasIngestao } from './ingestao/rotas.js'
import type { ResultadoIngestao } from './ingestao/servico.js'
import type { DefinirClaims, PerfilRepo } from './perfil/repositorio.js'
import { rotasPerfil } from './perfil/rotas.js'

export interface Dependencias {
  verificarToken: VerificarToken
  definirClaims: DefinirClaims
  perfis: PerfilRepo
  feed: FeedRepo
  certidoes: CertidaoRepo
  arquivos: ArmazenamentoArquivos
  /** Relógio injetável (testes usam data fixa). */
  agora?: Relogio
  /** Token do job de ingestão (`INGEST_JOB_TOKEN`). Sem ele, `POST /jobs/ingestao-pncp` recusa tudo. */
  tokenJob?: string
  /** Executa a ingestão do PNCP. Sem ele, a rota do job não existe. */
  ingestao?: () => Promise<ResultadoIngestao>
  /** Verifica as dependências para o `/readyz` (ex.: Firestore). Lança erro se não estiver pronto. */
  prontidao?: () => Promise<void>
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
  // `base: null` tira pid e hostname: o log de bloqueio traz só requestId, rota e status (CT-SEG-011).
  const logger = deps.logStream
    ? { level: 'info', base: null, stream: deps.logStream }
    : deps.logger === false
      ? false
      : { level: 'info', base: null }
  // Sem o log padrão de requisição (traz a URL); logamos só requestId, rota e status.
  // requestId gerado aqui (nunca aceito do cliente) e devolvido em todo erro e em todo log.
  const app = Fastify({ genReqId: () => randomUUID(), logger, logController: new LogController({ disableRequestLogging: true, requestIdLogLabel: 'requestId' }) })

  const agora = deps.agora ?? (() => new Date())
  const rotas: string[] = []
  app.decorate('rotas', rotas)
  app.addHook('onRoute', (r) => {
    for (const m of [r.method].flat()) if (m !== 'HEAD') rotas.push(`${m} ${r.url}`)
  })
  app.addHook('onResponse', async (req, reply) => {
    req.log.info({ route: req.routeOptions.url, status: reply.statusCode }, 'requisicao')
  })

  registrarErros(app)
  // Upload: no máximo 1 arquivo de 5 MB por requisição (US14/US15).
  app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 } })
  registrarAuth(app, deps.verificarToken, { tokenJob: deps.tokenJob })

  app.get('/health', async () => ({ status: 'ok', timestamp: agora().toISOString() }))
  // Saúde para a plataforma de hospedagem: `/healthz` = a API está de pé; `/readyz` = e o Firestore responde.
  // Públicas, sem dados e sem detalhes de erro no corpo.
  app.get('/healthz', async () => ({ status: 'ok' }))
  app.get('/readyz', async (req, reply) => {
    try {
      await deps.prontidao?.()
      return { status: 'ready' }
    } catch {
      req.log.warn({ route: req.routeOptions.url, status: 503 }, 'api nao pronta')
      return reply.status(503).send({ status: 'unavailable' })
    }
  })
  if (deps.ingestao) rotasIngestao(app, deps.ingestao)
  for (const prefix of PREFIXOS) {
    app.register(
      async (rotasDoPrefixo) => {
        rotasPerfil(rotasDoPrefixo, deps.perfis, deps.definirClaims)
        rotasFeed(rotasDoPrefixo, deps.feed)
        rotasCertidoes(rotasDoPrefixo, deps.certidoes, deps.arquivos, agora)
      },
      { prefix },
    )
  }

  return app
}
