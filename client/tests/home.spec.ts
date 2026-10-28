import { test, expect } from '@playwright/test'

test('abre no feed com os editais mais aderentes primeiro', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'LicitaRadar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Editais para você' })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(10)
  await expect(page.getByRole('article').first().getByText('Alta aderência')).toBeVisible()
})

test('mostra o estado vazio com filtro sem resultado e permite limpar', async ({ page }) => {
  await page.goto('/?termo=hemodialise')

  await expect(page.getByText('Nenhum edital combina com esses filtros')).toBeVisible()
  await page.getByRole('button', { name: 'Limpar filtros' }).last().click()
  await expect(page.getByRole('article')).toHaveCount(10)
})

test('pagina o feed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Próxima' }).click()

  await expect(page).toHaveURL(/pagina=2/)
  await expect(page.getByText(/^2 de \d+$/)).toBeVisible()
})
