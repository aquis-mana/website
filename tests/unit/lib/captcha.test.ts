import { describe, it, expect, vi } from 'vitest'
import { verifyTurnstile } from '../../../src/lib/captcha'

describe('verifyTurnstile', () => {
  it('returns true when Cloudflare responds with success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    } as Response))
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    expect(await verifyTurnstile('valid-token')).toBe(true)
  })

  it('returns false when Cloudflare responds with failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ success: false }),
    } as Response))
    expect(await verifyTurnstile('bad-token')).toBe(false)
  })
})
