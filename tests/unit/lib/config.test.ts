import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../../src/lib/config'

afterEach(() => vi.unstubAllEnvs())

describe('config', () => {
  it('calendarSource defaults to directus and honors google', () => {
    vi.stubEnv('CALENDAR_SOURCE', '')
    expect(config.calendarSource).toBe('directus')
    vi.stubEnv('CALENDAR_SOURCE', 'google')
    expect(config.calendarSource).toBe('google')
  })

  it('eventLookaheadDays defaults to 7 and parses ints, ignoring garbage', () => {
    vi.stubEnv('EVENT_LOOKAHEAD_DAYS', '')
    expect(config.eventLookaheadDays).toBe(7)
    vi.stubEnv('EVENT_LOOKAHEAD_DAYS', '3')
    expect(config.eventLookaheadDays).toBe(3)
    vi.stubEnv('EVENT_LOOKAHEAD_DAYS', 'lots')
    expect(config.eventLookaheadDays).toBe(7)
  })

  it('defaultEventCapacity is null when unset/garbage, number otherwise', () => {
    vi.stubEnv('DEFAULT_EVENT_CAPACITY', '')
    expect(config.defaultEventCapacity).toBeNull()
    vi.stubEnv('DEFAULT_EVENT_CAPACITY', '15')
    expect(config.defaultEventCapacity).toBe(15)
    vi.stubEnv('DEFAULT_EVENT_CAPACITY', 'nope')
    expect(config.defaultEventCapacity).toBeNull()
  })

  it('reads values lazily (reflects env changes after import)', () => {
    vi.stubEnv('DIRECTUS_URL', 'http://a')
    expect(config.directusUrl).toBe('http://a')
    vi.stubEnv('DIRECTUS_URL', 'http://b')
    expect(config.directusUrl).toBe('http://b')
  })

  it('directusToken and turnstileSiteKey default to empty string', () => {
    vi.stubEnv('DIRECTUS_TOKEN', '')
    vi.stubEnv('PUBLIC_TURNSTILE_SITE_KEY', '')
    expect(config.directusToken).toBe('')
    expect(config.turnstileSiteKey).toBe('')
  })
})
