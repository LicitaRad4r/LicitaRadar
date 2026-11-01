import { test, expect } from '@playwright/test'

test('abre no feed com os editais mais aderentes primeiro', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'LicitaRadar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Editais para você' })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(10)
  await expect(page.getByRole('article').first().getByText('Alta aderência')).toBeVisible()
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
