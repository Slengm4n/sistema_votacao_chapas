import { test, expect } from '@playwright/test';

test('deve carregar a tela inicial', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: 'Eleições das chapas do grêmio 2026'
    })
  ).toBeVisible();
});