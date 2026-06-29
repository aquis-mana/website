import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from '../../../src/pages/cms-assets/[...id]'

const UUID = '7440d5a7-24f1-8848-3234-a2373a7a5c1e'

function ctx(id: string, search = '') {
  return { params: { id }, url: new URL(`http://localhost/cms-assets/_${search}`) } as never
}

describe('GET /cms-assets/[...id]', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('DIRECTUS_URL', 'http://directus:8055')
    vi.stubEnv('DIRECTUS_TOKEN', 'tok')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('fetches the validated asset from the internal URL with auth and streams it', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('IMG', { status: 200, headers: { 'content-type': 'image/png' } })
    )
    const res = await GET(ctx(UUID, '?width=400&access_token=evil'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toContain('max-age')

    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0]
    expect(calledUrl).toBe(`http://directus:8055/assets/${UUID}?width=400`)
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  it('rejects an invalid id without hitting the network', async () => {
    const res = await GET(ctx('../../etc/passwd'))
    expect(res.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('passes through an upstream 404', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))
    const res = await GET(ctx(UUID))
    expect(res.status).toBe(404)
  })
})
