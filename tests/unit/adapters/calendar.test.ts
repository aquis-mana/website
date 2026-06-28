import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveCapacity } from '../../../src/adapters/calendar'

describe('resolveCapacity', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns the explicit capacity when provided', () => {
    vi.stubEnv('DEFAULT_EVENT_CAPACITY', '50')
    expect(resolveCapacity(20)).toBe(20)
  })

  it('falls back to DEFAULT_EVENT_CAPACITY when explicit is null', () => {
    vi.stubEnv('DEFAULT_EVENT_CAPACITY', '50')
    expect(resolveCapacity(null)).toBe(50)
  })

  it('returns null when neither explicit nor env is set', () => {
    vi.stubEnv('DEFAULT_EVENT_CAPACITY', '')
    expect(resolveCapacity(null)).toBeNull()
  })

  it('returns null when DEFAULT_EVENT_CAPACITY is non-numeric', () => {
    vi.stubEnv('DEFAULT_EVENT_CAPACITY', 'lots')
    expect(resolveCapacity(null)).toBeNull()
  })
})
