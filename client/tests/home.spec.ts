import { test, expect } from '@playwright/test'

test('abre no feed com os editais mais aderentes primeiro', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'LicitaRadar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Editais para você' })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(10)
  await expect(page.getByRole('article').first().getByRole('img', { name: /aderência alta$/ })).toBeVisible()
})

test('mostra o estado vazio com filtro sem resultado e permite limpar', async ({ page }) => {
  await page.goto('/?q=hemodialise')

  await expect(page.getByText('Nenhum edital combina com esses filtros')).toBeVisible()
  await page.getByRole('button', { name: 'Limpar filtros' }).last().click()
  await expect(page.getByRole('article')).toHaveCount(10)
})

test('pagina o feed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Próxima' }).click()

  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByText(/^2 de \d+$/)).toBeVisible()
})

test('filtra por estado e modalidade com etiquetas removíveis e mantém os filtros ao recarregar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Adicionar estado' }).selectOption('GO')
  await page.getByRole('combobox', { name: 'Modalidade' }).selectOption('pregao_eletronico')

  await expect(page).toHaveURL(/\?uf=GO&modalidade=pregao_eletronico$/)
  const ativas = page.getByRole('list', { name: 'Filtros ativos' })
  await expect(ativas.getByRole('button', { name: 'Remover filtro GO' })).toBeVisible()
  await expect(ativas.getByRole('button', { name: 'Remover filtro Pregão eletrônico' })).toBeVisible()

  await page.reload()
  await expect(ativas.getByRole('button')).toHaveCount(2)
  await expect(page.getByRole('article').first()).toContainText('GO')

  await ativas.getByRole('button', { name: 'Remover filtro GO' }).click()
  await expect(page).toHaveURL(/\?modalidade=pregao_eletronico$/)
})

test('renova uma certidão urgente e ela passa para Em dia', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Certidões' }).click()

  const emAlerta = page.getByRole('region', { name: /Precisam de atenção/ })
  await expect(emAlerta.getByRole('listitem', { name: 'CRF do FGTS' })).toBeVisible()
  await emAlerta.getByRole('button', { name: 'Renovar certidão CRF do FGTS' }).click()

  const dialogo = page.getByRole('dialog', { name: 'Renovar certidão' })
  await dialogo.getByLabel('Arquivo da certidão nova').setInputFiles({
    name: 'fgts.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 certidao'),
  })
  const daquiAUmAno = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  await dialogo.getByLabel('Nova validade').fill(daquiAUmAno)
  await dialogo.getByRole('button', { name: 'Salvar renovação' }).click()

  await expect(dialogo).toBeHidden()
  await expect(page.getByRole('region', { name: /Em dia/ }).getByRole('listitem', { name: 'CRF do FGTS' })).toBeVisible()
  await expect(page.getByText('Certidão renovada.')).toBeVisible()
})
