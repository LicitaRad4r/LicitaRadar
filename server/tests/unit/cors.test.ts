import { describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { certidoesGolden } from '../../src/seed/golden.js'
import { armazenamentoMemoria, certidaoRepoMemoria } from './memoria.js'

/** CORS para o front em outra origem (Vite em :5173 → API em :3333). O preflight não leva token. */
const agora = new Date('2026-10-15T13:00:00Z')
const FRONT = 'http://localhost:5173'

function criar(corsOrigens?: string[]) {
  return buildApp({
    logger: false,
    agora: () => agora,
    corsOrigens,
    feed: { editais: async () => [], scores: async () => [] },
    perfis: { ler: async () => null, salvar: async () => {}, criar: async () => 'x' },
    definirClaims: async () => {},
    certidoes: certidaoRepoMemoria(certidoesGolden(agora)).repo,
    arquivos: armazenamentoMemoria(),
    verificarToken: async () => {
      throw new Error('token inválido')
    },
  })
}

const preflight = (app: ReturnType<typeof criar>, url: string, origem = FRONT, metodo = 'GET') =>
  app.inject({
    method: 'OPTIONS',
    url,
    headers: { origin: origem, 'access-control-request-method': metodo, 'access-control-request-headers': 'authorization,content-type' },
  })

describe('CORS', () => {
  it('preflight sem token responde 204 com os cabeçalhos certos (nas rotas com e sem /v1)', async () => {
    const app = criar()
    for (const [url, metodo] of [['/v1/feed', 'GET'], ['/v1/perfil', 'PUT'], ['/v1/certidoes/c1/renovacao', 'PUT'], ['/feed', 'GET']] as const) {
      const r = await preflight(app, url, FRONT, metodo)
      expect(r.statusCode, url).toBe(204)
      expect(r.headers['access-control-allow-origin'], url).toBe(FRONT)
      expect(String(r.headers['access-control-allow-headers']).toLowerCase()).toContain('authorization')
      expect(String(r.headers['access-control-allow-methods'])).toContain('PUT')
    }
  })

  it('o 401 sem token também leva o cabeçalho de CORS (o front consegue ler o erro)', async () => {
    const r = await criar().inject({ method: 'GET', url: '/v1/feed', headers: { origin: FRONT } })
    expect(r.statusCode).toBe(401)
    expect(r.headers['access-control-allow-origin']).toBe(FRONT)
    expect(r.json()).toMatchObject({ codigo: 'NAO_AUTENTICADO' })
  })

  it('origem fora da lista não recebe o cabeçalho de permissão', async () => {
    const r = await preflight(criar(), '/v1/feed', 'http://site-malicioso.example')
    expect(r.headers['access-control-allow-origin']).toBeUndefined()
    const get = await criar().inject({ method: 'GET', url: '/v1/feed', headers: { origin: 'http://site-malicioso.example' } })
    expect(get.statusCode).toBe(401)
    expect(get.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('aceita as origens configuradas (ex.: o domínio do Firebase Hosting)', async () => {
    const app = criar(['https://licitaradar.web.app', 'http://localhost:5173'])
    const r = await preflight(app, '/v1/feed', 'https://licitaradar.web.app')
    expect(r.statusCode).toBe(204)
    expect(r.headers['access-control-allow-origin']).toBe('https://licitaradar.web.app')
  })

  it('o CORS não abre as rotas: OPTIONS sem os cabeçalhos de preflight não devolve dados e o GET sem token continua 401', async () => {
    const app = criar()
    const r = await app.inject({ method: 'OPTIONS', url: '/v1/feed' })
    expect(r.statusCode).toBe(400)
    expect(r.body).not.toContain('itens')
    const dados = await app.inject({ method: 'GET', url: '/v1/feed', headers: { origin: FRONT } })
    expect(dados.statusCode).toBe(401)
  })
})
