import { expect, test, type Page } from '@playwright/test'

/**
 * Roteiro E2E contra a API real (emulador do Firebase + seed). Pré-requisitos no docs/Testes/roteiro-e2e-api-real.md.
 * Usuários do seed (server/src/seed/seed.ts), senha local `senha-local-123`:
 *   decisor.a@ e analista.a@ (emp-a, perfil TI no DF/GO), decisor.b@ (emp-b, perfil RS).
 */
const API = process.env.API_URL ?? 'http://localhost:3333'
const AUTH = process.env.AUTH_EMULATOR_URL ?? 'http://localhost:9099'
const SENHA = 'senha-local-123'
const DECISOR_A = 'decisor.a@licitaradar.local'
const ANALISTA_A = 'analista.a@licitaradar.local'
const DECISOR_B = 'decisor.b@licitaradar.local'

async function entrar(page: Page, email: string, senha = SENHA) {
  await page.goto('/')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

async function idToken(request: import('@playwright/test').APIRequestContext, email: string) {
  const r = await request.post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    data: { email, password: SENHA, returnSecureToken: true },
  })
  expect(r.ok(), 'login no emulador de Auth').toBeTruthy()
  return (await r.json()).idToken as string
}

test.describe('API real: segurança (CT-SEG)', () => {
  test('E2E-01 sem token e com token adulterado → 401 NAO_AUTENTICADO (CT-SEG-001/002)', async ({ request }) => {
    const sem = await request.get(`${API}/v1/feed`)
    expect(sem.status()).toBe(401)
    expect(await sem.json()).toMatchObject({ codigo: 'NAO_AUTENTICADO' })

    const token = await idToken(request, DECISOR_A)
    const adulterado = await request.get(`${API}/v1/feed`, { headers: { Authorization: `Bearer ${token.slice(0, -4)}xxxx` } })
    expect(adulterado.status()).toBe(401)
  })

  test('E2E-02 analista não acessa certidões → 403 ACESSO_NEGADO; decisor acessa → 200 (CT-SEG-005/006)', async ({ request }) => {
    const analista = await request.get(`${API}/v1/certidoes`, { headers: { Authorization: `Bearer ${await idToken(request, ANALISTA_A)}` } })
    expect(analista.status()).toBe(403)
    expect(await analista.json()).toMatchObject({ codigo: 'ACESSO_NEGADO' })

    const decisor = await request.get(`${API}/v1/certidoes`, { headers: { Authorization: `Bearer ${await idToken(request, DECISOR_A)}` } })
    expect(decisor.status()).toBe(200)
  })

  test('E2E-03 isolamento: empresa A não lê dados da B e o feed de cada uma é o seu (CT-SEG-007..009)', async ({ request }) => {
    const hA = { Authorization: `Bearer ${await idToken(request, DECISOR_A)}` }
    const hB = { Authorization: `Bearer ${await idToken(request, DECISOR_B)}` }

    const forjado = await request.get(`${API}/v1/feed?empresaId=emp-b`, { headers: hA })
    expect(forjado.status()).toBe(403)

    const feedA = (await (await request.get(`${API}/v1/feed`, { headers: hA })).json()).itens as { id: string; score: number }[]
    const feedB = (await (await request.get(`${API}/v1/feed`, { headers: hB })).json()).itens as { id: string; score: number }[]
    expect(feedA.length).toBeGreaterThan(0)
    expect(feedB.length).toBeGreaterThan(0)
    expect(feedA[0]).not.toEqual(feedB[0]) // perfis diferentes → o topo do ranking difere
  })
})

test.describe('API real: saúde e job de ingestão (PR #25)', () => {
  test('E2E-11 /healthz e /readyz são públicos, respondem 200 e não trazem dados', async ({ request }) => {
    for (const rota of ['/healthz', '/readyz']) {
      const r = await request.get(`${API}${rota}`)
      expect(r.status(), rota).toBe(200)
      expect(JSON.stringify(await r.json())).not.toMatch(/empresa|edital|certid|token/i)
    }
  })

  test('E2E-12 o job de ingestão recusa sem token e com token de usuário do Firebase; o token do usuário não vira token do job', async ({ request }) => {
    const sem = await request.post(`${API}/jobs/ingestao-pncp`)
    expect(sem.status()).toBe(401)

    const token = await idToken(request, DECISOR_A)
    const comUsuario = await request.post(`${API}/jobs/ingestao-pncp`, { headers: { Authorization: `Bearer ${token}` } })
    expect(comUsuario.status()).toBe(401)

    // GET na rota do job também não executa nada.
    const get = await request.get(`${API}/jobs/ingestao-pncp`, { headers: { Authorization: `Bearer ${token}` } })
    expect([401, 404]).toContain(get.status())
  })
})

test.describe('API real: jornadas pela tela', () => {
  test('E2E-04 sem sessão a tela leva ao login; senha errada mostra o erro e continua no login (US02)', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()

    await entrar(page, DECISOR_A, 'senha-errada')
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  })

  test('E2E-05 decisor A entra e vê o feed do seed, o edital A (score 100) no topo (Jornada 1)', async ({ page }) => {
    await entrar(page, DECISOR_A)
    await expect(page.getByRole('heading', { name: 'Editais para você' })).toBeVisible()
    const primeiro = page.getByRole('article').first()
    await expect(primeiro).toContainText('Aquisição de notebooks')
    await expect(primeiro.getByRole('img', { name: /aderência alta$/ })).toBeVisible()
    // descartados do seed (D, E e F) não aparecem para a empresa A
    await expect(page.getByText('Serviços de limpeza predial')).toHaveCount(0)
  })

  test('E2E-06 empresa B vê um ranking diferente da A (CT-FEED-003)', async ({ page }) => {
    await entrar(page, DECISOR_B)
    const primeiro = page.getByRole('article').first()
    await expect(primeiro).toContainText('RS')
  })

  test('E2E-07 filtro sem resultado mostra o vazio e Limpar volta a lista (Jornada 2)', async ({ page }) => {
    await entrar(page, DECISOR_A)
    await expect(page.getByRole('heading', { name: 'Editais para você' })).toBeVisible()
    await page.goto('/?q=hemodialise')
    await expect(page.getByText('Nenhum edital combina com esses filtros')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).last().click()
    await expect(page.getByRole('article').first()).toBeVisible()
  })

  test('E2E-08 analista não vê Certidões no menu e recebe Acesso negado pela URL (US06)', async ({ page }) => {
    await entrar(page, ANALISTA_A)
    const menu = page.getByRole('navigation', { name: 'Principal' })
    await expect(menu.getByRole('link', { name: 'Editais' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Certidões' })).toHaveCount(0)
    await page.evaluate("history.pushState({}, '', '/certidoes'); dispatchEvent(new PopStateEvent('popstate'))")
    await expect(page.getByRole('heading', { name: 'Acesso negado' })).toBeVisible()
  })

  test('E2E-09 decisor renova uma certidão urgente e ela vai para Em dia (Jornada 3). Altera dados: rode o seed depois', async ({ page }) => {
    await entrar(page, DECISOR_A)
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Certidões' }).click()
    await expect(page.getByRole('heading', { name: 'Certidões' })).toBeVisible()

    const urgente = page.getByRole('listitem').filter({ hasText: 'Urgente' }).first()
    await urgente.getByRole('button', { name: /^Renovar certidão/ }).click()
    const dialogo = page.getByRole('dialog', { name: 'Renovar certidão' })
    await dialogo.getByLabel('Arquivo da certidão nova').setInputFiles({ name: 'certidao.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%e2e\n') })
    const validade = new Date(Date.now() + 200 * 864e5).toISOString().slice(0, 10)
    await dialogo.getByLabel('Nova validade').fill(validade)
    await dialogo.getByRole('button', { name: 'Salvar renovação' }).click()

    await expect(page.getByText('Certidão renovada.')).toBeVisible()
    await expect(page.getByRole('region', { name: /Em dia/ })).toContainText('Vence em 200 dias')
  })

  test('E2E-10 sair encerra a sessão e volta ao login', async ({ page }) => {
    await entrar(page, DECISOR_A)
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  })
})
