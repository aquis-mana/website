import { describe, it, expect } from 'vitest'
import { sanitizeCmsHtml } from '../../../src/lib/sanitize'

describe('sanitizeCmsHtml', () => {
  it('strips <script> tags and their content', () => {
    const out = sanitizeCmsHtml('<p>Hi</p><script>alert(1)</script>')
    expect(out).toBe('<p>Hi</p>')
    expect(out).not.toContain('script')
  })

  it('removes javascript: hrefs but keeps safe links', () => {
    expect(sanitizeCmsHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:')
    const safe = sanitizeCmsHtml('<a href="https://example.com">x</a>')
    expect(safe).toContain('href="https://example.com"')
    expect(safe).toContain('rel="noopener noreferrer"')
  })

  it('drops event-handler attributes', () => {
    const out = sanitizeCmsHtml('<p onclick="alert(1)">x</p>')
    expect(out).toBe('<p>x</p>')
    expect(out).not.toContain('onclick')
  })

  it('keeps allowed formatting tags', () => {
    const html = '<h2>T</h2><ul><li><strong>a</strong></li></ul>'
    expect(sanitizeCmsHtml(html)).toBe(html)
  })

  it('handles empty / nullish input without throwing', () => {
    expect(sanitizeCmsHtml('')).toBe('')
    // @ts-expect-error testing defensive nullish handling
    expect(sanitizeCmsHtml(undefined)).toBe('')
  })
})
