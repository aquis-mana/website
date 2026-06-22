import { test, expect } from '@playwright/test'

test('RSVP overlay opens on button click', async ({ page }) => {
  await page.goto('/')
  const rsvpBtn = page.locator('.rsvp-trigger').first()
  await rsvpBtn.click()
  await expect(page.locator('#rsvp-overlay')).toBeVisible()
})

test('RSVP overlay closes on backdrop click', async ({ page }) => {
  await page.goto('/')
  await page.locator('.rsvp-trigger').first().click()
  await expect(page.locator('#rsvp-overlay')).toBeVisible()
  await page.locator('#rsvp-overlay').click({ position: { x: 5, y: 5 } })
  await expect(page.locator('#rsvp-overlay')).toBeHidden()
})

test('RSVP overlay closes on Escape key', async ({ page }) => {
  await page.goto('/')
  await page.locator('.rsvp-trigger').first().click()
  await page.keyboard.press('Escape')
  await expect(page.locator('#rsvp-overlay')).toBeHidden()
})
