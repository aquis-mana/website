import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * Regression test for the CSP-blocked script bug.
 *
 * Astro inlines small processed `<script>` tags directly into the HTML as
 * `<script type="module">…</script>`. Our middleware sends a nonce-based CSP
 * (`script-src 'self' 'nonce-…'`), so any inline script WITHOUT that nonce is
 * blocked by the browser — which silently broke the RSVP overlay in production.
 *
 * The existing Playwright suite runs against `astro dev`, where Vite serves
 * these scripts as external modules, so the bug never reproduced there. This
 * test exercises the *production* build, which is where inlining happens.
 *
 * Invariant: in the production-rendered HTML, every inline <script> (one with
 * no `src`) must carry the request's CSP nonce, or it would be blocked.
 */

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 4399
const BASE = `http://127.0.0.1:${PORT}`

let server: ChildProcess

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status < 500) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`server did not start within ${timeoutMs}ms`)
}

beforeAll(async () => {
  // Build the production server bundle (this is where script inlining happens).
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
  if (build.status !== 0) {
    throw new Error(`build failed:\n${build.stdout}\n${build.stderr}`)
  }

  server = spawn('node', ['./dist/server/entry.mjs'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(PORT),
      // No real backend: the adapter fails and events render empty, but the
      // RsvpOverlay script is always present, which is all we need here.
      CALENDAR_SOURCE: 'directus',
      DIRECTUS_URL: 'http://127.0.0.1:9',
    },
    stdio: 'ignore',
  })

  await waitForServer(BASE, 15_000)
}, 120_000)

afterAll(() => {
  server?.kill()
})

describe('production build CSP', () => {
  it('renders no inline <script> that lacks the CSP nonce', async () => {
    const res = await fetch(BASE)
    const csp = res.headers.get('content-security-policy') ?? ''
    const html = await res.text()

    // Sanity: the policy is nonce-based, as the middleware intends.
    const nonceMatch = csp.match(/script-src[^;]*'nonce-([^']+)'/)
    expect(nonceMatch, `expected nonce-based script-src, got: ${csp}`).toBeTruthy()
    const nonce = nonceMatch![1]

    // Collect every <script ...> opening tag and keep only inline ones (no src).
    const scriptTags = html.match(/<script\b[^>]*>/g) ?? []
    const inlineWithoutNonce = scriptTags.filter((tag) => {
      const isExternal = /\ssrc\s*=/.test(tag)
      if (isExternal) return false
      return !tag.includes(`nonce="${nonce}"`)
    })

    expect(
      inlineWithoutNonce,
      `these inline scripts would be blocked by the CSP:\n${inlineWithoutNonce.join('\n')}`
    ).toEqual([])
  })
})
