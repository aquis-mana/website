import { test, expect } from '@playwright/test'

test.describe('security headers', () => {
  test('home page sends a nonce-based CSP and hardening headers', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response!.headers()

    const csp = headers['content-security-policy']
    expect(csp).toBeTruthy()
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    // script-src must use a nonce, not 'unsafe-inline'
    expect(csp).toMatch(/script-src[^;]*'nonce-[^']+'/)
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)

    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })
})
