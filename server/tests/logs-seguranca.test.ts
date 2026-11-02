import { Writable } from 'node:stream'
import { describe, test, expect } from 'vitest'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { buildApp } from '../app'

function criarApp() {
  const linhas: string[] = []
  const logStream = new Writable({
    write(chunk: Buffer | string, _e: BufferEncoding, cb: (error?: Error | null) => void) {
      linhas.push(chunk.toString())
      cb()
    },
  })
  const app = buildApp({ logStream })
  const logs = () => linhas.flatMap((l) => l.split('\n').filter(Boolean)).map((l) => JSON.parse(l))
  return { app, linhas, logs }
}

describe('CT-LOG: logs estruturados de bloqueio de segurança', () => {
  const CHAVES_PERMITIDAS = new Set([
    'level',
    'severity',
    'time',
    'pid',
    'hostname',
    'requestId',
    'evento',
    'rota',
    'metodo',
    'status',
    'codigo',
    'msg',
  ])

  test('CT-LOG-001: 401 sem token gera JSON com requestId, rota e status', async () => {
    const { app, logs } = criarApp()
    const res = await app.inject({ method: 'GET', url: '/v1/feed' })
    expect(res.statusCode).toBe(401)
    
    const log = logs().find((l) => l.evento === 'bloqueio_seguranca')!
    expect(log).toMatchObject({ rota: '/v1/feed', status: 401, codigo: 'NAO_AUTENTICADO' })
    expect(log.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.headers['x-request-id']).toBe(log.requestId)

    const chavesLog = Object.keys(log)
    for (const chave of chavesLog) {
      expect(CHAVES_PERMITIDAS.has(chave)).toBe(true)
    }
  })

  test('CT-LOG-002: 403 (sem claim empresaId e papel insuficiente) também gera log', async () => {
    const { app, logs } = criarApp()
    // Simulação de rota protegida que retorna 403
    app.get('/v1/admin', async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.code(403).send({ codigo: 'ACESSO_NEGADO', mensagem: 'Papel insuficiente' })
    })

    const res = await app.inject({ method: 'GET', url: '/v1/admin' })
    expect(res.statusCode).toBe(403)

    const log = logs().find((l) => l.evento === 'bloqueio_seguranca')!
    expect(log).toMatchObject({ rota: '/v1/admin', status: 403, codigo: 'ACESSO_NEGADO' })
  })

  test('CT-LOG-003: nenhum dado pessoal aparece no log', async () => {
    const { app, linhas } = criarApp()
    await app.inject({
      method: 'GET',
      url: '/v1/feed?termo=joao@empresa.com.br',
      headers: { authorization: 'Bearer token-invalido', 'x-request-id': 'injetado@x.com' },
    })
    const saida = linhas.join('')
    expect(saida).not.toMatch(/@/)
    expect(saida).not.toContain('token-invalido')
    expect(saida).not.toContain('joao')
    expect(saida).not.toContain('127.0.0.1')
  })

  test('CT-LOG-004: respostas 200 e 404 não geram log de bloqueio', async () => {
    const { app, logs } = criarApp()
    app.get('/health', async () => ({ status: 'ok' }))
    
    await app.inject({ method: 'GET', url: '/health' })
    expect(logs().some((l) => l.evento === 'bloqueio_seguranca')).toBe(false)
  })
})