import { defineMiddleware } from 'astro:middleware'
import { randomBytes } from 'node:crypto'

const TURNSTILE = 'https://challenges.cloudflare.com'

export const onRequest = defineMiddleware(async (context, next) => {
  // EN is not translated yet: redirect /en and /en/* to the German equivalent
  // (temporary 302 so it isn't cached while EN is being implemented).
  const { pathname, search } = context.url
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const target = pathname.replace(/^\/en/, '') || '/'
    return context.redirect(target + search, 302)
  }

  // Per-request nonce so our inline <script>s can run without 'unsafe-inline'.
  const nonce = randomBytes(16).toString('base64')
  context.locals.cspNonce = nonce

  const response = await next()

  // Only decorate HTML documents; leave API/asset responses untouched.
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) return response

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' ${TURNSTILE}`,
    // Tailwind/Astro may emit inline <style>; styles cannot execute JS.
    `style-src 'self' 'unsafe-inline'`,
    // Directus asset images (served from the CMS host) + inline data URIs.
    `img-src 'self' https: data:`,
    `font-src 'self'`,
    `connect-src 'self' ${TURNSTILE}`,
    `frame-src ${TURNSTILE}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join('; ')

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  )

  return response
})
