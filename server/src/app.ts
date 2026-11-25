import type { Writable } from 'node:stream'
import { randomUUID } from 'node:crypto'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import Fastify, { LogController, type FastifyInstance } from 'fastify'
import { rotasAcompanhamentos } from './acompanhamento/rotas.js'
import { origensCors } from './cors-origens.js'
import type { DependenciasAcompanhamento } from './acompanhamento/repositorio.js'
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
  /** Kanban de acompanhamento (`/acompanhamentos`). Sem ele, as rotas não existem. */
  acompanhamentos?: DependenciasAcompanhamento
  /** Relógio injetável (testes usam data fixa). */
  agora?: Relogio
  /** Token do job de ingestão (`INGEST_JOB_TOKEN`). Sem ele, `POST /jobs/ingestao-pncp` recusa tudo. */
  tokenJob?: string
  /** Executa a ingestão do PNCP. Sem ele, a rota do job não existe. */
  ingestao?: () => Promise<ResultadoIngestao>
  /** Verifica as dependências para o `/readyz` (ex.: Firestore). Lança erro se não estiver pronto. */
  prontidao?: () => Promise<void>
  /** SHA do git publicado. No Render vem de RENDER_GIT_COMMIT. Localmente fica vazio. */
  commit?: string
  /** Origens extras do front (`CORS_ORIGENS`). O Hosting deste projeto e o Vite local entram sempre. */
  corsOrigens?: string[]
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

/** SHA de git (7 a 40 hex). Qualquer outro valor fica de fora do /healthz. */
function commitPublicado(valor: string | undefined): string | undefined {
  const commit = valor?.trim().toLowerCase() ?? ''
  return /^[0-9a-f]{7,40}$/.test(commit) ? commit : undefined
}

/** Monta a API sem abrir porta (usado pelo servidor e pelos testes). */
export function buildApp(deps: Dependencias): FastifyInstance {
  // `base: null` tira pid e hostname: o log de bloqueio traz só requestId, rota e status (CT-SEG-011).
  const logger = deps.logStream
    ? { level: 'info', base: null, stream: deps.logStream }
    : deps.logger === false
      ? false
      : { level: 'info', base: null }
  // Sem o log padrão de requisição (traz a URL); logamos requestId, rota, status e latência.
  // requestId gerado aqui (nunca aceito do cliente) e devolvido em todo erro e em todo log.
  const app = Fastify({ genReqId: () => randomUUID(), logger, logController: new LogController({ disableRequestLogging: true, requestIdLogLabel: 'requestId' }) })

  const agora = deps.agora ?? (() => new Date())
  const rotas: string[] = []
  app.decorate('rotas', rotas)
  app.addHook('onRoute', (r) => {
    for (const m of [r.method].flat()) if (m !== 'HEAD') rotas.push(`${m} ${r.url}`)
  })
  app.addHook('onResponse', async (req, reply) => {
    req.log.info({ route: req.routeOptions.url, status: reply.statusCode, latenciaMs: Math.round(reply.elapsedTime) }, 'requisicao')
  })

  registrarErros(app)
  // CORS antes da autenticação: o preflight (OPTIONS) não leva `Authorization` e até a resposta 401 precisa dos
  // cabeçalhos de CORS para o front conseguir ler o erro. Os hooks rodam na ordem de registro.
  const origensConfiguradas = deps.corsOrigens ?? ['http://localhost:5173']
  app.register(cors, {
    origin: origensCors(origensConfiguradas),
    methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  })
  // Upload: no máximo 1 arquivo de 5 MB por requisição (US14/US15).
  app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 } })
  registrarAuth(app, deps.verificarToken, { tokenJob: deps.tokenJob })

  app.get('/health', async () => ({ status: 'ok', timestamp: agora().toISOString() }))
  // Saúde para a plataforma de hospedagem: `/healthz` = a API está de pé; `/readyz` = e o Firestore responde.
  // Públicas, sem dados de usuário e sem detalhes de erro no corpo.
  // No Render, `/healthz` inclui o SHA do git (RENDER_GIT_COMMIT). Localmente esse campo fica de fora.
  app.get('/healthz', async () => {
    const commit = commitPublicado(deps.commit)
    return commit ? { status: 'ok', commit } : { status: 'ok' }
  })
  app.get('/readyz', async (req, reply) => {
    try {
      await deps.prontidao?.()
      return { status: 'ready' }
    } catch {
      req.log.warn({ route: req.routeOptions.url, status: 503, latenciaMs: Math.round(reply.elapsedTime) }, 'api nao pronta')
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
        if (deps.acompanhamentos) rotasAcompanhamentos(rotasDoPrefixo, deps.acompanhamentos, agora)
      },
      { prefix },
    )
  }

  return app
}
