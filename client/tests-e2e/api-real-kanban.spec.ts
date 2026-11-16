import { expect, test, type APIRequestContext } from '@playwright/test'
const API = process.env.API_URL ?? 'http://localhost:3333'
const AUTH = process.env.AUTH_EMULATOR_URL ?? 'http://localhost:9099'
const SENHA = process.env.E2E_SENHA ?? 'senha-local-123'
const CHAVE_FIREBASE = process.env.FIREBASE_API_KEY
const DECISOR_A = 'decisor.a@licitaradar.local'
const ANALISTA_A = 'analista.a@licitaradar.local'
const DECISOR_B = 'decisor.b@licitaradar.local'
const ROTA = `${API}/v1/acompanhamentos`

async function idToken(request: APIRequestContext, email: string) {
  const url = CHAVE_FIREBASE
    ? `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CHAVE_FIREBASE}`
    : `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`
  const r = await request.post(url, { data: { email, password: SENHA, returnSecureToken: true } })
  expect(r.ok(), 'login no Auth (emulador ou Firebase real)').toBeTruthy()
  return (await r.json()).idToken as string
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

function tokenExpiradoForjado() {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const agora = Math.floor(Date.now() / 1000)
  const corpo = { iss: 'https://securetoken.google.com/teste', aud: 'teste', sub: 'u-teste', iat: agora - 7200, exp: agora - 3600 }
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(corpo)}.assinatura-falsa`
}

test.describe.configure({ mode: 'serial', timeout: 120_000 })

test.describe('API real: kanban de acompanhamento (autorização)', () => {
  let tokenA = ''
  let tokenAnalistaA = ''
  let tokenB = ''
  let editalId = ''
  let acompId = '' 
  let criadoAqui = false

  test.beforeAll(async ({ playwright }) => {
    const request = await playwright.request.newContext()
    tokenA = await idToken(request, DECISOR_A)
    tokenAnalistaA = await idToken(request, ANALISTA_A)
    tokenB = await idToken(request, DECISOR_B)
    const feed = await request.get(`${API}/v1/feed`, { headers: auth(tokenA) })
    expect(feed.status()).toBe(200)
    const itens = (await feed.json()).itens as { id: string }[]
    expect(itens.length, 'o feed da empresa A precisa ter editais de teste (rode o seed)').toBeGreaterThan(0)
    editalId = itens[0].id
    await request.dispose()
  })

  test.afterAll(async ({ playwright }) => {
    if (!acompId || !criadoAqui) return
    const request = await playwright.request.newContext()
    await request.delete(`${ROTA}/${acompId}`, { headers: auth(tokenA) })
    await request.dispose()
  })

  test('@seguranca @kanban KAN-SEG-01 sem token, token inválido e token expirado → 401 NAO_AUTENTICADO em todas as rotas', async ({ request }) => {
    const cabecalhos: Record<string, Record<string, string>> = {
      'sem token': {},
      'token inválido': { Authorization: 'Bearer isto-nao-e-um-token' },
      'token expirado/forjado': { Authorization: `Bearer ${tokenExpiradoForjado()}` },
    }
    const chamadas = [
      (h: Record<string, string>) => request.post(ROTA, { headers: h, data: { editalId: 'qualquer' } }),
      (h: Record<string, string>) => request.get(ROTA, { headers: h }),
      (h: Record<string, string>) => request.patch(`${ROTA}/qualquer`, { headers: h, data: { etapa: 'preparando' } }),
      (h: Record<string, string>) => request.delete(`${ROTA}/qualquer`, { headers: h }),
    ]
    for (const [caso, h] of Object.entries(cabecalhos)) {
      for (const chamar of chamadas) {
        const r = await chamar(h)
        expect(r.status(), caso).toBe(401)
        expect(await r.json(), caso).toMatchObject({ codigo: 'NAO_AUTENTICADO' })
      }
    }
  })

  test('@seguranca @kanban KAN-SEG-02 qualquer papel da empresa usa o kanban: analista e decisor listam (200)', async ({ request }) => {
    const analista = await request.get(ROTA, { headers: auth(tokenAnalistaA) })
    expect(analista.status()).toBe(200)
    const decisor = await request.get(ROTA, { headers: auth(tokenA) })
    expect(decisor.status()).toBe(200)
  })

  test('@seguranca @kanban KAN-SEG-03 a empresa A cria um acompanhamento e não vaza o empresaId', async ({ request }) => {
    const r = await request.post(ROTA, { headers: auth(tokenA), data: { editalId } })
    expect([200, 201]).toContain(r.status()) 
    const corpo = await r.json()
    acompId = corpo.id
    expect(acompId).toBeTruthy()
    expect(JSON.stringify(corpo)).not.toContain('emp-a')
  })

  test('@seguranca @kanban KAN-SEG-04 a empresa B não vê o registro da A na lista', async ({ request }) => {
    const lista = await request.get(`${ROTA}?pageSize=100`, { headers: auth(tokenB) })
    expect(lista.status()).toBe(200)
    const ids = ((await lista.json()).itens as { id: string }[]).map((i) => i.id)
    expect(ids).not.toContain(acompId)
  })

  test('@seguranca @kanban KAN-SEG-05 a empresa B não altera nem remove o registro da A (403) e nada muda', async ({ request }) => {
    const patch = await request.patch(`${ROTA}/${acompId}`, { headers: auth(tokenB), data: { etapa: 'preparando' } })
    expect(patch.status()).toBe(403)
    expect(await patch.json()).toMatchObject({ codigo: 'ACESSO_NEGADO' })
    const del = await request.delete(`${ROTA}/${acompId}`, { headers: auth(tokenB) })
    expect(del.status()).toBe(403)

    const lista = await request.get(`${ROTA}?pageSize=100`, { headers: auth(tokenA) })
    const meu = ((await lista.json()).itens as { id: string; etapa: string }[]).find((i) => i.id === acompId)
    expect(meu, 'o registro da A continua lá').toBeTruthy()
    expect(meu?.etapa).not.toBe('preparando')
  })

  test('@seguranca @kanban KAN-SEG-06 empresaId forjado na query ou no corpo → 403', async ({ request }) => {
    const query = await request.get(`${ROTA}?empresaId=emp-a`, { headers: auth(tokenB) })
    expect(query.status()).toBe(403)
    const corpo = await request.post(ROTA, { headers: auth(tokenB), data: { editalId, empresaId: 'emp-a' } })
    expect(corpo.status()).toBe(403)
  })

  test('@seguranca @kanban KAN-SEG-07 id inexistente → 404 e corpo inválido → 400 (sem token válido não chega aqui)', async ({ request }) => {
    const nao = await request.patch(`${ROTA}/id-que-nao-existe`, { headers: auth(tokenA), data: { etapa: 'preparando' } })
    expect(nao.status()).toBe(404)
    const invalido = await request.post(ROTA, { headers: auth(tokenA), data: {} })
    expect(invalido.status()).toBe(400)
  })

  test('@seguranca @kanban KAN-SEG-08 ingestão: token do job inválido ou token de usuário → 401', async ({ request }) => {
    const sem = await request.post(`${API}/jobs/ingestao-pncp`)
    expect(sem.status()).toBe(401)
    const errado = await request.post(`${API}/jobs/ingestao-pncp`, { headers: { Authorization: 'Bearer token-do-job-errado' } })
    expect(errado.status()).toBe(401)
    const comUsuario = await request.post(`${API}/jobs/ingestao-pncp`, { headers: auth(tokenA) })
    expect(comUsuario.status()).toBe(401)
  })
})