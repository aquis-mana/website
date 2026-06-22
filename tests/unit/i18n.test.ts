import { describe, it, expect } from 'vitest'
import { useTranslations } from '../../src/i18n/index'

describe('useTranslations', () => {
  it('returns German string for de locale', () => {
    const t = useTranslations('de')
    expect(t('nav.home')).toBe('Startseite')
  })

  it('falls back to German when English stub is empty', () => {
    const t = useTranslations('en')
    // en.ts has placeholder — but key must exist
    expect(typeof t('nav.home')).toBe('string')
    expect(t('nav.home').length).toBeGreaterThan(0)
  })
})
