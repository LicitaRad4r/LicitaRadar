import { describe, expect, it } from 'vitest'
import { auth, criarApp } from './ajudantes.js'

const usuarios = {
  novo: { uid: 'u1' },
  decisorA: { uid: 'u2', empresaId: 'emp-A', role: 'decisor' as const },
  decisorB: { uid: 'u3', empresaId: 'emp-B', role: 'decisor' as const },
}

describe('GET/PUT /v1/perfil', () => {
  it('exige token (401 NAO_AUTENTICADO)', async () => {
    const { app } = criarApp(usuarios)
    const r = await app.inject({ method: 'GET', url: '/v1/perfil' })
    expect(r.statusCode).toBe(401)
    expect(r.json().codigo).toBe('NAO_AUTENTICADO')
    const r2 = await app.inject({ method: 'GET', url: '/v1/perfil', headers: auth('invalido') })
    expect(r2.statusCode).toBe(401)
  })

  it('GET sem empresa devolve perfil vazio com empresaId nulo', async () => {
    const { app } = criarApp(usuarios)
    const r = await app.inject({ method: 'GET', url: '/v1/perfil', headers: auth('novo') })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ empresaId: null, ufs: [], termosChave: [], valorMinimo: null })
  })

  it('primeiro PUT cria a empresa, grava claims de decisor e responde 201', async () => {
    const { app, empresas, claims } = criarApp(usuarios)
    const r = await app.inject({
      method: 'PUT',
      url: '/v1/perfil',
      headers: auth('novo'),
      payload: { ufs: ['DF', 'GO'], termosChave: ['notebook'], segmentos: ['ti'], valorMinimo: 50000 },
    })
    expect(r.statusCode).toBe(201)
    expect(r.json().empresaId).toBe('emp-1')
    expect(claims).toEqual([{ uid: 'u1', empresaId: 'emp-1', role: 'decisor' }])
    expect(empresas.get('emp-1')?.ufs).toEqual(['DF', 'GO'])
  })

  it('PUT seguinte substitui o perfil e responde 200', async () => {
    const { app, empresas, claims } = criarApp(usuarios)
    const r = await app.inject({
      method: 'PUT',
      url: '/v1/perfil',
      headers: auth('decisorA'),
      payload: { ufs: ['SP'] },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().empresaId).toBe('emp-A')
    expect(empresas.get('emp-A')?.ufs).toEqual(['SP'])
    expect(claims).toHaveLength(0)
  })

  it('GET devolve só o perfil da própria empresa', async () => {
    const { app } = criarApp(usuarios)
    await app.inject({ method: 'PUT', url: '/v1/perfil', headers: auth('decisorA'), payload: { ufs: ['DF'] } })
    await app.inject({ method: 'PUT', url: '/v1/perfil', headers: auth('decisorB'), payload: { ufs: ['RS'] } })
    const a = await app.inject({ method: 'GET', url: '/v1/perfil', headers: auth('decisorA') })
    const b = await app.inject({ method: 'GET', url: '/v1/perfil', headers: auth('decisorB') })
    expect(a.json().ufs).toEqual(['DF'])
    expect(b.json().ufs).toEqual(['RS'])
  })

  it('valida os campos (400 VALIDACAO com detalhes)', async () => {
    const { app, claims } = criarApp(usuarios)
    const r = await app.inject({
      method: 'PUT',
      url: '/v1/perfil',
      headers: auth('novo'),
      payload: { ufs: ['df'], termosChave: ['a'], segmentos: ['x'] },
    })
    expect(r.statusCode).toBe(400)
    const corpo = r.json()
    expect(corpo.codigo).toBe('VALIDACAO')
    const campos = corpo.detalhes.map((d: { campo: string }) => d.campo)
    expect(campos).toEqual(expect.arrayContaining(['ufs.0', 'termosChave.0', 'segmentos.0']))
    expect(claims).toHaveLength(0)
  })

  it('rejeita valor máximo menor que o mínimo', async () => {
    const { app } = criarApp(usuarios)
    const r = await app.inject({
      method: 'PUT',
      url: '/v1/perfil',
      headers: auth('novo'),
      payload: { valorMinimo: 100, valorMaximo: 10 },
    })
    expect(r.statusCode).toBe(400)
    expect(r.json().detalhes[0].campo).toBe('valorMaximo')
  })

  it('JSON malformado responde 400 VALIDACAO', async () => {
    const { app } = criarApp(usuarios)
    const r = await app.inject({
      method: 'PUT',
      url: '/v1/perfil',
      headers: { ...auth('novo'), 'content-type': 'application/json' },
      payload: '{ruim',
    })
    expect(r.statusCode).toBe(400)
    expect(r.json().codigo).toBe('VALIDACAO')
  })

  it('rota inexistente responde 404 NAO_ENCONTRADO', async () => {
    const { app } = criarApp(usuarios)
    // Sem token já é 401 (nem as rotas inexistentes ficam públicas); com token, 404.
    expect((await app.inject({ method: 'GET', url: '/nada' })).statusCode).toBe(401)
    const r = await app.inject({ method: 'GET', url: '/nada', headers: auth('novo') })
    expect(r.statusCode).toBe(404)
    expect(r.json().codigo).toBe('NAO_ENCONTRADO')
  })
})

describe('GET /health', () => {
  it('não exige token', async () => {
    const { app } = criarApp(usuarios)
    const r = await app.inject({ method: 'GET', url: '/health' })
    expect(r.statusCode).toBe(200)
    expect(r.json().status).toBe('ok')
  })
})
