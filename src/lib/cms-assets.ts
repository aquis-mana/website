/**
 * Helpers for proxying Directus-hosted assets through the public frontend.
 *
 * Directus runs on a private subnet, so the browser cannot load its asset URLs
 * directly. The `/cms-assets/[...id]` route fetches them server-side over the
 * internal network and streams them back; these helpers validate ids (to avoid
 * SSRF/traversal) and rewrite asset URLs embedded in CMS content to that route.
 */

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
// Directus emits asset ids either bare (`<uuid>`) or with an extension
// (`<uuid>.jpeg`); accept an optional `.<ext>` suffix.
const FIRST_SEGMENT_RE = new RegExp(`^${UUID}(\\.[A-Za-z0-9]+)?$`)
const SAFE_FILENAME_RE = /^[\w.\- ]+$/

// Only these Directus asset query params are forwarded; tokens (access_token,
// key) and anything else are dropped.
const ALLOWED_PARAMS = ['width', 'height', 'quality', 'fit', 'format', 'download'] as const

/**
 * Validate the `[...id]` path of a proxied asset. Returns the id path unchanged
 * if it is a Directus file UUID, optionally followed by a single safe filename
 * segment (`<uuid>/<name.ext>`); otherwise null. Rejects traversal and extra depth.
 */
export function parseAssetId(idPath: string): string | null {
  if (!idPath || idPath.includes('..')) return null
  const segments = idPath.split('/')
  if (segments.length === 1) {
    return FIRST_SEGMENT_RE.test(segments[0]) ? idPath : null
  }
  if (segments.length === 2) {
    let name: string
    try {
      name = decodeURIComponent(segments[1])
    } catch {
      return null
    }
    return FIRST_SEGMENT_RE.test(segments[0]) && SAFE_FILENAME_RE.test(name) ? idPath : null
  }
  return null
}

function filterParams(input: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams()
  for (const key of ALLOWED_PARAMS) {
    if (input.has(key)) out.set(key, input.get(key) ?? '')
  }
  return out
}

/**
 * Build the internal Directus asset URL for a validated id, forwarding only
 * allowlisted transform params. Returns null if the id is invalid.
 */
export function buildUpstreamAssetUrl(
  idPath: string,
  params: URLSearchParams,
  directusBase: string
): string | null {
  if (!parseAssetId(idPath)) return null
  const base = directusBase.replace(/\/$/, '')
  const qs = filterParams(params).toString()
  return `${base}/assets/${idPath}${qs ? `?${qs}` : ''}`
}

/**
 * Rewrite a Directus asset URL found in CMS content (`.../assets/<id>`, absolute
 * or relative) to the local `/cms-assets/<id>` proxy path, keeping only
 * allowlisted transform params. Non-asset URLs are returned unchanged.
 */
export function rewriteAssetUrl(src: string): string {
  let pathname: string
  let search: string
  try {
    const u = new URL(src, 'http://_local_')
    pathname = u.pathname
    search = u.search
  } catch {
    return src
  }
  const match = pathname.match(/^\/assets\/(.+)$/)
  if (!match) return src
  const idPath = match[1]
  if (!parseAssetId(idPath)) return src
  const qs = filterParams(new URLSearchParams(search)).toString()
  return `/cms-assets/${idPath}${qs ? `?${qs}` : ''}`
}
