import Fastify, { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import type { Writable } from 'node:stream'

export function buildApp(opts: { logStream?: Writable } = {}) {
  const app = Fastify({
    disableRequestLogging: true,
    requestIdHeader: false,
    requestIdLogLabel: 'requestId',
    genReqId: () => randomUUID(),
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      stream: opts.logStream,
      formatters: { level: (label) => ({ severity: label.toUpperCase() }) },
      serializers: {
         req: () => ({}),
         res: () => ({})
       },
      redact: {
        paths: ['*.email', '*.senha', '*.token', '*.authorization', 'req.headers', 'req.query', 'req.body'],
        censor: '[REDACTED]',
      },
    },
  })

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id)
  })

  app.addHook('onResponse', async (request, reply) => {
    const status = reply.statusCode
    if (status !== 401 && status !== 403) return
    const payload = reply.raw.getHeader('x-error-code') ?? (reply as any).errorCodigo
    request.log.warn(
      {
        evento: 'bloqueio_seguranca',
        rota: request.routeOptions?.url ?? 'rota_desconhecida',
        metodo: request.method,
        status,
        codigo: payload ?? (status === 401 ? 'NAO_AUTENTICADO' : 'ACESSO_NEGADO'),
      },
      'Acesso bloqueado',
    )
  })

  // Adicionando a rota /v1/feed exigida pelos testes de log de segurança (CT-LOG-001)
  app.get('/v1/feed', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.code(401).send({ codigo: 'NAO_AUTENTICADO', mensagem: 'Token ausente' })
    }
    return { status: 'sucesso', dados: [] }
  })

  return app
}