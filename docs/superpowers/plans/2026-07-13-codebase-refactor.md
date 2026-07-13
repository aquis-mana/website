# Codebase Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pay down the audit-identified tech debt: centralize env config, deduplicate API/RSVP boilerplate, make the two calendar adapters window events consistently, remove `as any` casts, and add real quality gates (type-check in CI, e2e against the production build).

**Architecture:** Introduce two small shared modules — `src/lib/config.ts` (typed, lazy env access via getters) and `src/lib/http.ts` (JSON response helpers) — and route existing consumers through them. Tighten the Directus data layer (`findActiveRsvp`, real types) and align the Directus adapter's event window with the Google adapter. Add `astro check` tooling and gate CI on it plus the test suite.

**Tech Stack:** Astro 6 (SSR, `@astrojs/node` standalone), TypeScript (strict), Directus SDK 22, Vitest 4, Playwright 1.61, GitHub Actions.

## Global Constraints

- Node.js ≥ 22.12 (`package.json` `engines`).
- Site is **DE-only**; do not reintroduce the EN locale.
- Do **not** modify Kubernetes manifests (`manifests/**`, `application.yaml`, `configmap.yaml`) — infra is owned elsewhere.
- Preserve the nonce-based CSP behavior in `src/middleware.ts`.
- Config access must stay **lazy** (read `process.env` at call/access time) so `vi.stubEnv` in existing tests keeps working.
- The full test suite (`npm test`) must stay green after every task.
- Work on a `claude/<date>` branch, never commit to `main` directly. One commit per task.

---

### Task 1: Central typed config module

**Files:**
- Create: `src/lib/config.ts`
- Create: `tests/unit/lib/config.test.ts`
- Modify: `src/adapters/calendar.ts` (`resolveCapacity`, `getAdapter`)
- Modify: `src/adapters/google.ts` (`fetchEvents`)
- Modify: `src/lib/directus.ts` (`getDirectusClient`)
- Modify: `src/lib/captcha.ts` (`verifyTurnstile`)
- Modify: `src/pages/cms-assets/[...id].ts` (`GET`)
- Modify: `src/pages/index.astro` (frontmatter)

**Interfaces:**
- Produces: `config` object with getters: `calendarSource: 'directus' | 'google'`, `eventLookaheadDays: number`, `defaultEventCapacity: number | null`, `directusUrl: string | undefined`, `directusToken: string`, `googleCalendarId: string | undefined`, `googleApiKey: string | undefined`, `turnstileSiteKey: string`, `turnstileSecretKey: string | undefined`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lib/config.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/config.test.ts`
Expected: FAIL — cannot resolve `../../../src/lib/config`.

- [ ] **Step 3: Create the config module**

Create `src/lib/config.ts`:

```ts
function parseIntEnv(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

function parseIntEnvOrNull(raw: string | undefined): number | null {
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Central, typed access to environment configuration.
 *
 * Every field is a getter that reads process.env on access. This keeps values
 * current for tests that stub env, and keeps adapter-specific vars lazy (they
 * may be absent depending on CALENDAR_SOURCE). This is an SSR app, so
 * process.env is the correct source at runtime for both public and private vars.
 */
export const config = {
  get calendarSource(): 'directus' | 'google' {
    return process.env.CALENDAR_SOURCE === 'google' ? 'google' : 'directus'
  },
  get eventLookaheadDays(): number {
    return parseIntEnv(process.env.EVENT_LOOKAHEAD_DAYS, 7)
  },
  get defaultEventCapacity(): number | null {
    return parseIntEnvOrNull(process.env.DEFAULT_EVENT_CAPACITY)
  },
  get directusUrl(): string | undefined {
    return process.env.DIRECTUS_URL
  },
  get directusToken(): string {
    return process.env.DIRECTUS_TOKEN ?? ''
  },
  get googleCalendarId(): string | undefined {
    return process.env.GOOGLE_CALENDAR_ID
  },
  get googleApiKey(): string | undefined {
    return process.env.GOOGLE_CALENDAR_API_KEY
  },
  get turnstileSiteKey(): string {
    return process.env.PUBLIC_TURNSTILE_SITE_KEY ?? ''
  },
  get turnstileSecretKey(): string | undefined {
    return process.env.TURNSTILE_SECRET_KEY
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/config.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Route `calendar.ts` through config**

In `src/adapters/calendar.ts`, add the import after the logger import:

```ts
import { createLogger } from '../lib/logger'
import { config } from '../lib/config'
```

Replace the body of `getAdapter` env read:

```ts
  const source = config.calendarSource
```

Replace `resolveCapacity`:

```ts
export function resolveCapacity(explicit: number | null): number | null {
  if (explicit !== null) return explicit
  return config.defaultEventCapacity
}
```

- [ ] **Step 6: Route `google.ts` through config**

In `src/adapters/google.ts`, add after the logger import:

```ts
import { config } from '../lib/config'
```

Replace the env reads in `fetchEvents`:

```ts
    const calendarId = config.googleCalendarId
    const apiKey = config.googleApiKey
    if (!calendarId) throw new Error('GOOGLE_CALENDAR_ID is not configured')
    if (!apiKey) throw new Error('GOOGLE_CALENDAR_API_KEY is not configured')

    const now = new Date()
    const lookaheadDays = config.eventLookaheadDays
    const timeMin = now.toISOString()
    const timeMax = new Date(now.getTime() + lookaheadDays * 86_400_000).toISOString()
```

(Delete the old `parsedDays`/`Number.parseInt` lines.)

- [ ] **Step 7: Route `lib/directus.ts` through config**

In `src/lib/directus.ts`, add at the top:

```ts
import { config } from './config'
```

Replace the env reads in `getDirectusClient`:

```ts
    const url = config.directusUrl
    const token = config.directusToken
    if (!url) {
      throw new Error('DIRECTUS_URL is not configured')
    }
```

- [ ] **Step 8: Route `captcha.ts` through config**

Replace `src/lib/captcha.ts` lines 1-2:

```ts
import { config } from './config'

export async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = config.turnstileSecretKey
```

- [ ] **Step 9: Route the cms-assets route through config**

In `src/pages/cms-assets/[...id].ts`, add after the logger import:

```ts
import { config } from '../../lib/config'
```

Replace the two env reads:

```ts
  const directusBase = config.directusUrl
```

and

```ts
  const token = config.directusToken
```

(`config.directusToken` returns `''` when unset, so the existing `token ? {...} : {}` still omits the Authorization header — behavior unchanged.)

- [ ] **Step 10: Route `index.astro` through config**

In `src/pages/index.astro` frontmatter, add to the imports:

```ts
import { config } from '../lib/config'
```

Replace the siteKey line:

```ts
const siteKey = config.turnstileSiteKey
```

- [ ] **Step 11: Run the full suite and build**

Run: `npx vitest run && npm run build`
Expected: all tests PASS, build completes. (The existing adapter tests that `vi.stubEnv` still pass because config getters read env lazily.)

- [ ] **Step 12: Commit**

```bash
git add src/lib/config.ts tests/unit/lib/config.test.ts src/adapters/calendar.ts src/adapters/google.ts src/lib/directus.ts src/lib/captcha.ts src/pages/cms-assets/'[...id]'.ts src/pages/index.astro
git commit -m "refactor(config): centralize env access in a typed config module"
```

---

### Task 2: Shared HTTP/JSON response helpers

**Files:**
- Create: `src/lib/http.ts`
- Create: `tests/unit/lib/http.test.ts`
- Modify: `src/pages/api/rsvp/index.ts`
- Modify: `src/pages/api/rsvp/[token].ts`
- Modify: `src/pages/api/events/[id]/stats.ts`

**Interfaces:**
- Produces: `json(body: unknown, status?: number): Response` (default status 200) and `jsonError(message: string, status: number): Response`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lib/http.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { json, jsonError } from '../../../src/lib/http'

describe('http helpers', () => {
  it('json defaults to 200 and sets the JSON content type', async () => {
    const res = json({ ok: true })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(await res.json()).toEqual({ ok: true })
  })

  it('json honors an explicit status', () => {
    expect(json({ a: 1 }, 201).status).toBe(201)
  })

  it('jsonError wraps a message under `error` with the given status', async () => {
    const res = jsonError('Missing fields', 400)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing fields' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/http.test.ts`
Expected: FAIL — cannot resolve `../../../src/lib/http`.

- [ ] **Step 3: Create the helpers**

Create `src/lib/http.ts`:

```ts
/** JSON `Response` with the correct content type. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** JSON error `Response` of the shape `{ error: string }`. */
export function jsonError(message: string, status: number): Response {
  return json({ error: message }, status)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/http.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Refactor `api/rsvp/index.ts`**

In `src/pages/api/rsvp/index.ts`, delete the local `json` helper (the `const json = ...` block) and import the shared ones. The top imports become:

```ts
import type { APIRoute } from 'astro'
import { createRsvp } from '../../../lib/rsvp'
import { verifyTurnstile } from '../../../lib/captcha'
import { createLogger } from '../../../lib/logger'
import { json, jsonError } from '../../../lib/http'

const log = createLogger('rsvp')
```

Replace the error/response calls in the handler body:
- `return json({ error: 'Invalid JSON' }, 400)` → `return jsonError('Invalid JSON', 400)`
- `return json({ error: 'Missing fields' }, 400)` → `return jsonError('Missing fields', 400)`
- `return json({ error: 'Invalid status' }, 400)` → `return jsonError('Invalid status', 400)`
- `return json({ error: 'CAPTCHA failed' }, 422)` → `return jsonError('CAPTCHA failed', 422)`
- `return json(rsvp, 201)` → `return json(rsvp, 201)` (unchanged; now the shared helper)
- `return json({ error: 'Server error' }, 500)` → `return jsonError('Server error', 500)`

- [ ] **Step 6: Refactor `api/events/[id]/stats.ts`**

In `src/pages/api/events/[id]/stats.ts`, add the import:

```ts
import { json, jsonError } from '../../../../lib/http'
```

Replace:
- `return new Response(JSON.stringify(stats), { status: 200 })` → `return json(stats)`
- `return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })` → `return jsonError('Server error', 500)`

Leave `return new Response(null, { status: 400 })` (empty body) as-is.

- [ ] **Step 7: Refactor `api/rsvp/[token].ts` JSON responses**

In `src/pages/api/rsvp/[token].ts`, add the import:

```ts
import { json, jsonError } from '../../../lib/http'
```

Replace the JSON responses:
- `return new Response(JSON.stringify({ status: rsvp.status }), { status: 200, headers: { 'Content-Type': 'application/json' } })` → `return json({ status: rsvp.status })`
- `return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })` → `return jsonError('Server error', 500)`
- `return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })` → `return jsonError('Invalid JSON', 400)`
- `return new Response(JSON.stringify({ error: 'Invalid status' }), { status: 400 })` → `return jsonError('Invalid status', 400)`
- `return new Response(JSON.stringify(rsvp), { status: 200 })` → `return json(rsvp)`
- `return new Response(JSON.stringify({ error: 'RSVP not found' }), { status: 404 })` → `return jsonError('RSVP not found', 404)`

Leave the `return new Response(null, { status: 400 })` / `404` / `204` empty-body responses as-is.

- [ ] **Step 8: Run tests + build**

Run: `npx vitest run && npm run build`
Expected: all PASS, build OK.

- [ ] **Step 9: Commit**

```bash
git add src/lib/http.ts tests/unit/lib/http.test.ts src/pages/api/rsvp/index.ts src/pages/api/rsvp/'[token]'.ts src/pages/api/events/'[id]'/stats.ts
git commit -m "refactor(api): share JSON response helpers across routes"
```

---

### Task 3: Window Directus events to EVENT_LOOKAHEAD_DAYS

**Files:**
- Modify: `src/adapters/directus.ts` (extract `upcomingEventsQuery`, use it)
- Modify: `tests/unit/adapters/directus.test.ts` (add window test)

**Interfaces:**
- Consumes: `config.eventLookaheadDays` (Task 1).
- Produces: exported `upcomingEventsQuery(now: Date, lookaheadDays: number)` returning `{ filter: { status: { _eq: 'published' }, date: { _gte: string; _lte: string } }, sort: string[] }`.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/adapters/directus.test.ts` — first extend the import on line 2:

```ts
import { DirectusCalendarAdapter, upcomingEventsQuery } from '../../../src/adapters/directus'
```

Then add this test inside the `describe('DirectusCalendarAdapter', ...)` block (or a new describe at the end of the file):

```ts
  it('upcomingEventsQuery windows to lookaheadDays with an upper bound', () => {
    const now = new Date('2026-07-01T00:00:00.000Z')
    const q = upcomingEventsQuery(now, 5)
    expect(q.filter.status._eq).toBe('published')
    expect(q.filter.date._gte).toBe('2026-07-01T00:00:00.000Z')
    expect(q.filter.date._lte).toBe('2026-07-06T00:00:00.000Z')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/adapters/directus.test.ts`
Expected: FAIL — `upcomingEventsQuery` is not exported.

- [ ] **Step 3: Implement the query builder and use it**

In `src/adapters/directus.ts`, add the config import after the logger import:

```ts
import { config } from '../lib/config'
```

Add the exported builder above the `DirectusCalendarAdapter` class:

```ts
/**
 * Query for published events from now through the look-ahead window. Mirrors the
 * Google adapter's EVENT_LOOKAHEAD_DAYS windowing so both sources agree.
 */
export function upcomingEventsQuery(now: Date, lookaheadDays: number) {
  const timeMax = new Date(now.getTime() + lookaheadDays * 86_400_000)
  return {
    filter: {
      status: { _eq: 'published' as const },
      date: { _gte: now.toISOString(), _lte: timeMax.toISOString() },
    },
    sort: ['date'],
  }
}
```

Replace the body of `getUpcomingEvents`'s `client.request(...)` call:

```ts
      const items = await client.request(
        readItems('events', upcomingEventsQuery(new Date(), config.eventLookaheadDays))
      )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/adapters/directus.test.ts`
Expected: PASS. (The existing `getUpcomingEvents` tests still pass — the mocked client ignores the query and returns the stubbed array.)

- [ ] **Step 5: Run full suite + build**

Run: `npx vitest run && npm run build`
Expected: all PASS, build OK.

- [ ] **Step 6: Commit**

```bash
git add src/adapters/directus.ts tests/unit/adapters/directus.test.ts
git commit -m "fix(events): window Directus events to EVENT_LOOKAHEAD_DAYS like Google"
```

---

### Task 4: Add `astro check` type-check tooling

**Files:**
- Modify: `package.json` (devDeps + `check` script)

- [ ] **Step 1: Install the type-check tooling**

Run:

```bash
npm install -D @astrojs/check typescript
```

Expected: `@astrojs/check` and `typescript` added to `devDependencies`; `package-lock.json` updated.

- [ ] **Step 2: Add the `check` script**

In `package.json` `scripts`, add after the `astro` line:

```json
    "check": "astro check",
```

- [ ] **Step 3: Run the type check to establish a clean baseline**

Run: `npm run check`
Expected: `0 errors`. If errors appear, they are pre-existing type issues — fix each at its source (the codebase already extends `astro/tsconfigs/strict` and builds cleanly, so none are expected). Do **not** silence them with `any`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(tooling): add astro check type-check script"
```

---

### Task 5: Deduplicate the active-RSVP lookup and remove `as any`

**Files:**
- Modify: `src/lib/rsvp.ts` (add `findActiveRsvp`, remove casts)
- Modify: `src/pages/api/rsvp/[token].ts` (use `findActiveRsvp` in GET)

**Interfaces:**
- Consumes: `json`/`jsonError` (Task 2), `astro check` (Task 4).
- Produces: exported `findActiveRsvp(visitorToken: string): Promise<{ id: string; event_id: string; name: string; status: 'yes' | 'maybe' | 'cancelled'; visitor_token: string } | null>`.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/lib/rsvp.test.ts` (top import — check existing imports and add `findActiveRsvp` to the import from `../../../src/lib/rsvp`). Then add:

```ts
describe('findActiveRsvp', () => {
  it('returns the first non-cancelled rsvp or null', async () => {
    const { getDirectusClient } = await import('../../../src/lib/directus')
    const mockClient = { request: vi.fn() }
    vi.mocked(getDirectusClient).mockReturnValue(mockClient as any)
    const { findActiveRsvp } = await import('../../../src/lib/rsvp')

    mockClient.request.mockResolvedValue([
      { id: 'r1', event_id: 'e1', name: 'A', status: 'yes', visitor_token: 't' },
    ])
    expect((await findActiveRsvp('t'))?.id).toBe('r1')

    mockClient.request.mockResolvedValue([])
    expect(await findActiveRsvp('t')).toBeNull()
  })
})
```

> Note: match the existing mock setup already used in `tests/unit/lib/rsvp.test.ts`. If that file already mocks `getDirectusClient` at module scope, reuse that mock rather than re-importing — adapt this test to the file's established pattern.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/rsvp.test.ts`
Expected: FAIL — `findActiveRsvp` is not exported.

- [ ] **Step 3: Add `findActiveRsvp` and use it; remove casts**

In `src/lib/rsvp.ts`, add the exported helper above `createRsvp`:

```ts
/** The active (non-cancelled) RSVP for a visitor token, or null. */
export async function findActiveRsvp(visitorToken: string) {
  const client = getDirectusClient()
  const items = await client.request(
    readItems('rsvps', {
      filter: { visitor_token: { _eq: visitorToken }, status: { _neq: 'cancelled' } },
      limit: 1,
    })
  )
  return items[0] ?? null
}
```

Rewrite `updateRsvp` to use it and drop `as any`:

```ts
export async function updateRsvp(
  visitorToken: string,
  status: 'yes' | 'maybe'
): Promise<RsvpRecord> {
  const existing = await findActiveRsvp(visitorToken)
  if (!existing) throw new Error('RSVP not found')
  const client = getDirectusClient()
  const raw = await client.request(updateItem('rsvps', existing.id, { status }))
  return mapRsvp(raw)
}
```

Rewrite `cancelRsvp`:

```ts
export async function cancelRsvp(visitorToken: string): Promise<void> {
  const existing = await findActiveRsvp(visitorToken)
  if (!existing) return
  const client = getDirectusClient()
  await client.request(updateItem('rsvps', existing.id, { status: 'cancelled' }))
}
```

In `createRsvp`, drop the cast: `return mapRsvp(raw)`.

In `getRsvpStats`, drop the two `as Array<{ status: string }>` casts:

```ts
  const yes = items.filter((r) => r.status === 'yes').length
  const maybe = items.filter((r) => r.status === 'maybe').length
```

- [ ] **Step 4: Use `findActiveRsvp` in the `[token].ts` GET**

In `src/pages/api/rsvp/[token].ts`, update the imports (drop `readItems` and `getDirectusClient` if now unused; add `findActiveRsvp`):

```ts
import type { APIRoute } from 'astro'
import { updateRsvp, cancelRsvp, findActiveRsvp } from '../../../lib/rsvp'
import { createLogger } from '../../../lib/logger'
import { json, jsonError } from '../../../lib/http'

const log = createLogger('rsvp')
```

Replace the GET handler body with:

```ts
export const GET: APIRoute = async ({ params }) => {
  const { token } = params
  if (!token) return new Response(null, { status: 400 })

  try {
    const existing = await findActiveRsvp(token)
    if (!existing) return new Response(null, { status: 404 })
    return json({ status: existing.status })
  } catch (err) {
    log.error('GET by token failed', err)
    return jsonError('Server error', 500)
  }
}
```

- [ ] **Step 5: Run tests, type-check, build**

Run: `npx vitest run && npm run check && npm run build`
Expected: all PASS, `0 errors`, build OK. If `npm run check` flags a residual mismatch on `mapRsvp(raw)`, define the raw parameter type explicitly (the Directus `rsvps` item shape) rather than reintroducing `any`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rsvp.ts tests/unit/lib/rsvp.test.ts src/pages/api/rsvp/'[token]'.ts
git commit -m "refactor(rsvp): dedupe active-RSVP lookup and remove as-any casts"
```

---

### Task 6: Gate CI on type-check and tests

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Add a test job and make deploy depend on it**

Replace the `jobs:` section of `.github/workflows/deploy.yml` with:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Log in to registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
```

> `npm test` runs the Vitest unit + integration suites. The integration test (`tests/integration/csp-scripts.test.ts`) builds and boots the production server with no backend, so it runs in CI unchanged. Playwright e2e is intentionally excluded (needs browsers + a Directus backend).

- [ ] **Step 2: Validate the workflow YAML**

Run: `npx --yes yaml-lint .github/workflows/deploy.yml 2>/dev/null || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('yaml ok')"`
Expected: `yaml ok` (or no lint errors).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: gate image build on astro check and tests"
```

---

### Task 7: Run Playwright e2e against the production build

**Files:**
- Modify: `playwright.config.ts`

- [ ] **Step 1: Point the e2e web server at the built app**

Replace the `webServer` block in `playwright.config.ts` with:

```ts
  webServer: {
    // Exercise the real production build (dev mode serves scripts differently
    // and has hidden production-only bugs, e.g. the CSP script inlining issue).
    command: 'npm run build && npm run start',
    port: 4321,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '4321',
    },
  },
```

- [ ] **Step 2: Sanity-check the config parses**

Run: `npx playwright test --list 2>&1 | head -20`
Expected: the config loads and test titles are listed (it will start building; you can Ctrl-C once titles print). No config/parse errors.

> Full e2e execution still requires a reachable Directus backend for the RSVP specs; that dependency is pre-existing and out of scope. This task only ensures the browser tests run against the production build when a backend is available.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "test(e2e): run Playwright against the production build"
```

---

## Self-Review

**1. Spec coverage** (audit items 10–17 / the 6 requested refactors):
- Central typed config (item 10) → Task 1 ✓
- Shared HTTP/error helpers (item 12) → Task 2 ✓
- Dedupe active-RSVP lookup (item 13) → Task 5 ✓
- Adapter windowing (item 11, the divergence part) → Task 3 ✓
- Remove `as any` / tighten types (item 14) → Task 5 (+ Task 4 enables verification) ✓
- CI gate (item 16) → Task 6 ✓
- e2e against prod build (item 17) → Task 7 ✓
- Logger (item 15) → already shipped before this plan ✓

Not in scope (deliberately): ESLint/Prettier (audit item 8, not among the 6 requested), the "smarter Google recurring-event windowing" TODO (separate feature), and the calendar-view feature.

**2. Placeholder scan:** No TBD/TODO/"handle edge cases" — each code step contains full code. ✓

**3. Type consistency:** `config` getter names are used identically in Tasks 1/3/5. `json`/`jsonError` signatures match between Task 2 definition and Tasks 2/5 usage. `findActiveRsvp` return shape (has `.id` and `.status`) matches its uses in `updateRsvp`, `cancelRsvp`, and the `[token].ts` GET. `upcomingEventsQuery` shape matches its test. ✓
