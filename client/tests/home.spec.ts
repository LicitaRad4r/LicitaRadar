   import { test, expect } from '@playwright/test'

   test('mostra o nome do produto', async ({ page }) => {
     await page.goto('/')
     await expect(page.getByRole('heading', { name: 'LicitaRadar' })).toBeVisible()
   })