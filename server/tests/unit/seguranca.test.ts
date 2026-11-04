import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import type { Usuario } from '../../src/auth.js'
import { certidoesGolden } from '../../src/seed/golden.js'
import { auth } from './ajudantes.js'
import { armazenamentoMemoria, certidaoRepoMemoria } from './memoria.js'

/**
 * Jornada 4: segurança em um único ponto (hook de autenticação) e testada nas rotas REAIS.
 * CT-SEG-010 (Firestore deny-all) fica em tests/integration, pois precisa do emulador.
 */
const agora = new Date('2026-10-15T13:00:00Z')
const usuarios: Record<string, Usuario> = {
  decisorA: { uid: 'u-dec-a', empresaId: 'emp-a', role: 'decisor' },
  analistaA: { uid: 'u-ana-a', empresaId: 'emp-a', role: 'analista' },
  decisorB: { uid: 'u-dec-b', empresaId: 'emp-b', role: 'decisor' },
  semEmpresa: { uid: 'u-sem' },
  semRole: { uid: 'u-sem-role', empresaId: 'emp-a' },
}

function criar(linhas?: string[]) {
  const logStream = linhas
    ? new Writable({
        write(chunk, _enc, cb) {
          linhas.push(String(chunk))
          cb()
        },
      })
    : undefined
  const repo = certidaoRepoMemoria(certidoesGolden(agora))
  const arq = armazenamentoMemoria()
  const app = buildApp({
    logger: false,
    logStream,
    agora: () => agora,
    feed: { editais: async () => [], scores: async () => [] },
    perfis: { ler: async () => null, salvar: async () => {}, criar: async () => 'x' },
    definirClaims: async () => {},
    certidoes: repo.repo,
    arquivos: arq.armazenamento,
    verificarToken: async (t) => {
      if (t === 'expirado') throw Object.assign(new Error('expirado'), { code: 'auth/id-token-expired' })
      const u = usuarios[t]
      if (!u) throw new Error('invalido')
      return u
    },
  })
  return { app, ...repo, ...arq }
}

const ROTAS_DE_NEGOCIO = ['/feed', '/certidoes', '/v1/feed', '/v1/certidoes', '/v1/perfil']

describe('segurança (CT-SEG)', () => {
  it('CT-SEG-001: sem token responde 401 em toda rota de negócio, mesmo com corpo inválido', async () => {
    const { app } = criar()
    for (const url of ROTAS_DE_NEGOCIO) {
      const r = await app.inject({ method: 'GET', url })
      expect(r.statusCode, url).toBe(401)
      expect(r.json().codigo).toBe('NAO_AUTENTICADO')
    }
    const ruim = await app.inject({ method: 'PUT', url: '/v1/perfil', headers: { 'content-type': 'application/json' }, payload: '{x' })
    expect(ruim.statusCode).toBe(401)
    const sem = await app.inject({ method: 'PUT', url: '/certidoes/cert-a-mais3/renovacao', headers: { 'content-type': 'application/json' }, payload: '{x' })
    expect(sem.statusCode).toBe(401)
  })

  it('CT-SEG-002: token inválido ou formato errado responde 401', async () => {
    const { app } = criar()
    for (const authorization of ['Bearer forjado', 'Basic abc', 'Bearer', 'forjado']) {
      const r = await app.inject({ method: 'GET', url: '/feed', headers: { authorization } })
      expect(r.statusCode, authorization).toBe(401)
    }
  })

  it('CT-SEG-003: token expirado responde 401 com aviso de sessão expirada', async () => {
    const r = await criar().app.inject({ method: 'GET', url: '/feed', headers: auth('expirado') })
    expect(r.statusCode).toBe(401)
    expect(r.json().mensagem).toMatch(/expirada/i)
  })

  it('CT-SEG-004: token sem empresaId ou sem role responde 403 EMPRESA_NAO_CONFIGURADA', async () => {
    const { app } = criar()
    for (const t of ['semEmpresa', 'semRole']) {
      for (const url of ['/feed', '/certidoes']) {
        const r = await app.inject({ method: 'GET', url, headers: auth(t) })
        expect([r.statusCode, r.json().codigo], `${t} ${url}`).toEqual([403, 'EMPRESA_NAO_CONFIGURADA'])
      }
    }
  })

  it('CT-SEG-005: analista em GET /certidoes responde 403 ACESSO_NEGADO; decisor acessa', async () => {
    const { app } = criar()
    for (const prefixo of ['', '/v1']) {
      const r = await app.inject({ method: 'GET', url: `${prefixo}/certidoes`, headers: auth('analistaA') })
      expect([r.statusCode, r.json().codigo]).toEqual([403, 'ACESSO_NEGADO'])
    }
    expect((await app.inject({ method: 'GET', url: '/certidoes', headers: auth('decisorA') })).statusCode).toBe(200)
  })

  it('CT-SEG-006: analista em PUT /certidoes/{id}/renovacao responde 403 e nada é gravado', async () => {
    const { app, mapa, gravados } = criar()
    const antes = structuredClone(mapa.get('cert-a-mais3')!)
    const r = await app.inject({ method: 'PUT', url: '/certidoes/cert-a-mais3/renovacao', headers: auth('analistaA') })
    expect([r.statusCode, r.json().codigo]).toEqual([403, 'ACESSO_NEGADO'])
    expect(mapa.get('cert-a-mais3')).toEqual(antes)
    expect(gravados.size).toBe(0)
  })

  it('CT-SEG-007: decisor da A em GET /certidoes/{id da B} responde 403 sem revelar a certidão', async () => {
    const { app } = criar()
    for (const prefixo of ['', '/v1']) {
      const r = await app.inject({ method: 'GET', url: `${prefixo}/certidoes/cert-b-mais10`, headers: auth('decisorA') })
      expect([r.statusCode, r.json().codigo]).toEqual([403, 'ACESSO_NEGADO'])
      expect(r.body).not.toMatch(/cert-b-mais10|CND|validade/)
    }
    expect((await app.inject({ method: 'GET', url: '/certidoes/cert-a-mais3', headers: auth('decisorA') })).statusCode).toBe(200)
  })

  it('CT-SEG-008: decisor da A em PUT /certidoes/{id da B}/renovacao responde 403 e a certidão da B fica inalterada', async () => {
    const { app, mapa, gravados } = criar()
    const antes = structuredClone(mapa.get('cert-b-mais10')!)
    const r = await app.inject({ method: 'PUT', url: '/certidoes/cert-b-mais10/renovacao', headers: auth('decisorA') })
    expect([r.statusCode, r.json().codigo]).toEqual([403, 'ACESSO_NEGADO'])
    expect(mapa.get('cert-b-mais10')).toEqual(antes)
    expect(gravados.size).toBe(0)
    const lista = await app.inject({ method: 'GET', url: '/certidoes', headers: auth('decisorB') })
    expect(lista.json().itens.map((i: { id: string }) => i.id)).toEqual(['cert-b-mais10'])
  })

  it('CT-SEG-009: analista da A em GET /perfil?orgId=empresa-B responde 403 (tenant só pelo token)', async () => {
    const { app } = criar()
    for (const url of ['/perfil?orgId=emp-b', '/v1/perfil?orgId=emp-b']) {
      const r = await app.inject({ method: 'GET', url, headers: auth('analistaA') })
      expect([r.statusCode, r.json().codigo], url).toEqual([403, 'ACESSO_NEGADO'])
    }
  })

  it('CT-SEG-009: orgId/empresaId de outra empresa em outras rotas (query ou corpo) também responde 403; o da própria passa', async () => {
    const { app } = criar()
    for (const url of ['/feed?orgId=emp-b', '/v1/feed?empresaId=emp-b', '/certidoes?orgId=emp-b', '/v1/perfil?orgId=emp-b']) {
      const r = await app.inject({ method: 'GET', url, headers: auth('decisorA') })
      expect([r.statusCode, r.json().codigo], url).toEqual([403, 'ACESSO_NEGADO'])
    }
    const corpo = await app.inject({ method: 'PUT', url: '/v1/perfil', headers: auth('decisorA'), payload: { empresaId: 'emp-b' } })
    expect(corpo.statusCode).toBe(403)
    expect((await app.inject({ method: 'GET', url: '/feed?orgId=emp-a', headers: auth('decisorA') })).statusCode).toBe(200)
  })

  it('PUT /perfil de quem ainda não tem empresa aceita o eco do GET (empresaId nulo) e responde 201', async () => {
    const { app } = criar()
    const corpo = { empresaId: null, ufs: ['DF'], termosChave: ['notebook'], segmentos: [], modalidades: [], valorMinimo: null, valorMaximo: null, prazoMinimoDiasUteis: null }
    const r = await app.inject({ method: 'PUT', url: '/v1/perfil', headers: auth('semEmpresa'), payload: corpo })
    expect(r.statusCode).toBe(201)
    const outra = await app.inject({ method: 'PUT', url: '/v1/perfil', headers: auth('semEmpresa'), payload: { ...corpo, empresaId: 'emp-b' } })
    expect(outra.statusCode).toBe(403)
  })

  it('CT-SEG-011: erro só traz codigo, mensagem e requestId; sem dados do recurso ou pessoais, no corpo e no log', async () => {
    const linhas: string[] = []
    const { app } = criar(linhas)
    const r = await app.inject({ method: 'PUT', url: '/certidoes/cert-a-mais3/renovacao', headers: auth('decisorB') })
    expect(r.statusCode).toBe(403)
    const corpo = r.json()
    expect(Object.keys(corpo).sort()).toEqual(['codigo', 'mensagem', 'requestId'])
    expect(r.body).not.toMatch(/cert-a-mais3|emp-a|emp-b|u-dec-b|CND/)
    const log = linhas.join('')
    expect(log).toMatch(/acesso bloqueado/)
    expect(log).toContain(`"requestId":"${corpo.requestId}"`)
    expect(log).toMatch(/"route":"\/certidoes\/:certidaoId\/renovacao"/)
    expect(log).toMatch(/"status":403/)
    const entrada = linhas.map((l) => JSON.parse(l)).find((l) => l.msg === 'acesso bloqueado')
    expect(Object.keys(entrada).sort()).toEqual(['level', 'msg', 'requestId', 'route', 'status', 'time'])
    expect(log).not.toMatch(/cert-a-mais3|emp-a|emp-b|u-dec-b|Bearer|decisorB/)
  })

  it('o requestId vem em todo erro (401, 403, 404, 400) e é diferente a cada requisição', async () => {
    const { app } = criar()
    const respostas = [
      await app.inject({ method: 'GET', url: '/feed' }),
      await app.inject({ method: 'GET', url: '/certidoes', headers: auth('analistaA') }),
      await app.inject({ method: 'GET', url: '/nao-existe', headers: auth('decisorA') }),
      await app.inject({ method: 'GET', url: '/feed?page=0', headers: auth('decisorA') }),
      await app.inject({ method: 'PUT', url: '/certidoes/nao-existe/renovacao', headers: auth('decisorA') }),
    ]
    expect(respostas.map((r) => r.statusCode)).toEqual([401, 403, 404, 400, 404])
    const ids = respostas.map((r) => r.json().requestId)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('100% das rotas (exceto GET /health e o preflight OPTIONS do CORS) exigem token', async () => {
    const { app } = criar()
    await app.ready()
    expect(app.rotas).toEqual(expect.arrayContaining(['GET /health', 'GET /v1/feed', 'GET /v1/certidoes', 'PUT /v1/certidoes/:certidaoId/renovacao', 'GET /v1/perfil']))
    for (const rota of app.rotas) {
      // `OPTIONS *` é o preflight do CORS (plugin @fastify/cors): responde antes da autenticação, sem dados (ver cors.test.ts).
      if (rota === 'OPTIONS *') continue
      const [metodo, caminho] = rota.split(' ') as [string, string]
      const url = caminho.replace(/:[A-Za-z]+/g, 'x')
      const r = await app.inject({ method: metodo as 'GET', url })
      if (rota === 'GET /health') expect(r.statusCode).toBe(200)
      else expect(r.statusCode, rota).toBe(401)
    }
  })
})
