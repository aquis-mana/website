import type { APIRoute } from 'astro'
import { buildUpstreamAssetUrl } from '../../lib/cms-assets'

export const prerender = false

/**
 * Public proxy for Directus-hosted assets. Directus is private, so the browser
 * cannot load its URLs directly; this fetches them server-side over the internal
 * network and streams them back. Only validated file ids reach Directus.
 */
export const GET: APIRoute = async ({ params, url }) => {
  const directusBase = process.env.DIRECTUS_URL
  if (!directusBase) return new Response(null, { status: 500 })

  const idPath = params.id
  if (!idPath) return new Response(null, { status: 404 })

  const upstream = buildUpstreamAssetUrl(idPath, url.searchParams, directusBase)
  if (!upstream) return new Response(null, { status: 400 })

  const token = process.env.DIRECTUS_TOKEN
  let res: Response
  try {
    res = await fetch(upstream, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch (err) {
    console.error('[cms-assets] upstream fetch failed:', err)
    return new Response(null, { status: 502 })
  }

  if (!res.ok) return new Response(null, { status: res.status })

  const headers = new Headers()
  for (const h of ['content-type', 'content-length', 'content-disposition']) {
    const v = res.headers.get(h)
    if (v) headers.set(h, v)
  }
  headers.set('cache-control', 'public, max-age=3600')

  return new Response(res.body, { status: 200, headers })
}
