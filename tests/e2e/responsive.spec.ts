import { test, expect } from '@playwright/test'

test.describe('responsive layout', () => {
  test('mobile: hamburger visible, desktop nav hidden, toggle reveals menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.locator('#menu-toggle')).toBeVisible()
    await expect(page.locator('header nav ul')).toBeHidden()
    await expect(page.locator('#mobile-menu')).toBeHidden()
    await page.locator('#menu-toggle').click()
    await expect(page.locator('#mobile-menu')).toBeVisible()
  })

  test('desktop: nav visible, hamburger hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await expect(page.locator('header nav ul')).toBeVisible()
    await expect(page.locator('#menu-toggle')).toBeHidden()
  })

  test('mobile: home page has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('mobile: membership page has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/mitgliedschaft')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
