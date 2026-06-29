import { test, expect } from '@playwright/test'

test.describe('EN locale suppressed', () => {
  test('/en/<path> redirects to the German page', async ({ page }) => {
    await page.goto('/en/ueber-uns')
    expect(new URL(page.url()).pathname).toBe('/ueber-uns')
  })

  test('/en redirects to the home page', async ({ page }) => {
    await page.goto('/en')
    expect(new URL(page.url()).pathname).toBe('/')
  })

  test('the navigation has no language switcher / EN links', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('header a[href^="/en"]')).toHaveCount(0)
  })
})
