import { describe, it, expect } from 'vitest'
import { parseAssetId, buildUpstreamAssetUrl, rewriteAssetUrl } from '../../../src/lib/cms-assets'

const UUID = '7440d5a7-24f1-8848-3234-a2373a7a5c1e'

describe('parseAssetId', () => {
  it('accepts a bare UUID', () => {
    expect(parseAssetId(UUID)).toBe(UUID)
  })
  it('accepts a UUID with an extension suffix', () => {
    expect(parseAssetId(`${UUID}.jpeg`)).toBe(`${UUID}.jpeg`)
  })
  it('accepts a UUID with a safe filename segment', () => {
    expect(parseAssetId(`${UUID}/satzung.pdf`)).toBe(`${UUID}/satzung.pdf`)
  })
  it('rejects path traversal', () => {
    expect(parseAssetId('../../etc/passwd')).toBeNull()
    expect(parseAssetId(`${UUID}/../secret`)).toBeNull()
  })
  it('rejects non-UUID first segments and extra depth', () => {
    expect(parseAssetId('notauuid')).toBeNull()
    expect(parseAssetId(`${UUID}/a/b`)).toBeNull()
  })
})

describe('buildUpstreamAssetUrl', () => {
  const base = 'http://directus:8055'
  it('builds the internal asset URL for a valid id', () => {
    const params = new URLSearchParams()
    expect(buildUpstreamAssetUrl(UUID, params, base)).toBe(`${base}/assets/${UUID}`)
  })
  it('forwards only allowlisted transform params and drops tokens', () => {
    const params = new URLSearchParams('width=400&access_token=evil&key=preset&download=')
    const url = buildUpstreamAssetUrl(UUID, params, base)!
    expect(url).toContain('width=400')
    expect(url).toContain('download=')
    expect(url).not.toContain('access_token')
    expect(url).not.toContain('key=')
  })
  it('returns null for an invalid id (no upstream request possible)', () => {
    expect(buildUpstreamAssetUrl('../../etc/passwd', new URLSearchParams(), base)).toBeNull()
  })
})

describe('rewriteAssetUrl', () => {
  it('rewrites an absolute Directus asset URL to the local proxy path', () => {
    expect(rewriteAssetUrl(`https://cms.aquis-mana.de/assets/${UUID}`)).toBe(`/cms-assets/${UUID}`)
  })
  it('rewrites the internal host form too', () => {
    expect(rewriteAssetUrl(`http://directus:8055/assets/${UUID}`)).toBe(`/cms-assets/${UUID}`)
  })
  it('rewrites a relative /assets path', () => {
    expect(rewriteAssetUrl(`/assets/${UUID}`)).toBe(`/cms-assets/${UUID}`)
  })
  it('rewrites the real Directus form (uuid.ext with size params)', () => {
    expect(
      rewriteAssetUrl(`https://cms.aquis-mana.de/assets/${UUID}.jpeg?width=2048&height=1152`)
    ).toBe(`/cms-assets/${UUID}.jpeg?width=2048&height=1152`)
  })
  it('keeps allowlisted transform params and drops tokens', () => {
    expect(rewriteAssetUrl(`https://cms.aquis-mana.de/assets/${UUID}?width=400&access_token=evil`))
      .toBe(`/cms-assets/${UUID}?width=400`)
  })
  it('leaves external (non-Directus-asset) images untouched', () => {
    expect(rewriteAssetUrl('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg')
  })
})
