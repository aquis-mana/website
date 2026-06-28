# Google Calendar Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Calendar as an optional, read-only event source selected by `CALENDAR_SOURCE=google`, while RSVPs keep working through Directus and a source-agnostic default capacity is honored.

**Architecture:** A `resolveCapacity` helper in `calendar.ts` centralizes the `explicit → DEFAULT_EVENT_CAPACITY → null` fallback used by both adapters. The reworked `google.ts` adapter fetches a public calendar via API key, parses a `[capacity:N]` tag out of each event description, and maps events to the existing `CalendarEvent` shape. The Directus adapter is updated to run its capacity through the same helper. RSVPs are untouched — `rsvps.event_id` is a plain string, so Google event ids flow through the existing RSVP/stats code with no schema change.

**Tech Stack:** TypeScript, Astro 6 (Node SSR adapter), Directus SDK, vitest.

## Global Constraints

- All runtime config is read via `process.env.*`, never `import.meta.env.*` (server SSR reads env at runtime).
- Tests live in `tests/unit/**/*.test.ts`; run with `npm test` (vitest, `node` environment).
- No Directus schema change — `rsvps.event_id` is an opaque `string`.
- Directus stays the default source; Google activates only when `CALENDAR_SOURCE=google`.
- Capacity precedence is always: explicit event capacity → `DEFAULT_EVENT_CAPACITY` → `null`.
- Commit style: `<type>(scope): description`. Do NOT add a Claude/Co-authored-by signature.
- Work happens on branch `claude/2026-06-28`.

## File Structure

- `src/adapters/calendar.ts` — Modify: add exported `resolveCapacity` helper (shared capacity fallback).
- `src/adapters/google.ts` — Modify: rework adapter; add exported `parseCapacity`; config validation; fetch throws on error; map with capacity + cleaned description.
- `src/adapters/directus.ts` — Modify: route `raw.capacity` through `resolveCapacity`.
- `tests/unit/adapters/calendar.test.ts` — Create: tests for `resolveCapacity`.
- `tests/unit/adapters/google.test.ts` — Modify: add `parseCapacity` tests, capacity/default/cleaning tests, config-missing throw, change error test to expect throw.
- `tests/unit/adapters/directus.test.ts` — Modify: add default-capacity test; isolate env between tests.
- `manifests/frontend/configmap.yaml` — Modify: document Google env vars (commented).
- `TODO.md` — Modify: mark the Google Calendar item done.

---

### Task 1: `resolveCapacity` shared helper

**Files:**
- Modify: `src/adapters/calendar.ts`
- Test: `tests/unit/adapters/calendar.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `export function resolveCapacity(explicit: number | null): number | null` — returns `explicit` if non-null; else the integer parsed from `process.env.DEFAULT_EVENT_CAPACITY`; else `null` (unset/empty/non-numeric → `null`).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/adapters/calendar.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- calendar`
Expected: FAIL — `resolveCapacity is not a function` / import error.

- [ ] **Step 3: Write minimal implementation**

In `src/adapters/calendar.ts`, append after the `getAdapter` function:

```ts
export function resolveCapacity(explicit: number | null): number | null {
  if (explicit !== null) return explicit
  const raw = process.env.DEFAULT_EVENT_CAPACITY
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? null : parsed
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- calendar`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/calendar.ts tests/unit/adapters/calendar.test.ts
git commit -m "feat(calendar): add source-agnostic resolveCapacity helper"
```

---

### Task 2: `parseCapacity` tag parser

**Files:**
- Modify: `src/adapters/google.ts`
- Test: `tests/unit/adapters/google.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function parseCapacity(description: string): { capacity: number | null; cleaned: string }` — extracts the first `[capacity:N]` tag (case-insensitive, tolerant of inner spaces), returns the parsed integer (or `null`) and the description with the tag removed, doubled spaces collapsed, and trimmed.

- [ ] **Step 1: Write the failing test**

In `tests/unit/adapters/google.test.ts`, change the top import line to also import `parseCapacity`:

```ts
import { GoogleCalendarAdapter, parseCapacity } from '../../../src/adapters/google'
```

Then add this `describe` block at the end of the file:

```ts
describe('parseCapacity', () => {
  it('extracts capacity from a [capacity:N] tag and cleans the text', () => {
    const r = parseCapacity('Bring snacks [capacity:20]')
    expect(r.capacity).toBe(20)
    expect(r.cleaned).toBe('Bring snacks')
  })

  it('is case-insensitive and tolerates inner spaces', () => {
    const r = parseCapacity('Draft night [Capacity: 12 ]')
    expect(r.capacity).toBe(12)
    expect(r.cleaned).toBe('Draft night')
  })

  it('returns null capacity and original text when no tag is present', () => {
    const r = parseCapacity('No limits here')
    expect(r.capacity).toBeNull()
    expect(r.cleaned).toBe('No limits here')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- google`
Expected: FAIL — `parseCapacity` is not exported / not a function.

- [ ] **Step 3: Write minimal implementation**

In `src/adapters/google.ts`, add this exported function above `mapGoogleEvent`:

```ts
export function parseCapacity(description: string): { capacity: number | null; cleaned: string } {
  const match = description.match(/\[capacity:\s*(\d+)\s*\]/i)
  if (!match) return { capacity: null, cleaned: description }
  const capacity = Number.parseInt(match[1], 10)
  const cleaned = description.replace(match[0], '').replace(/ {2,}/g, ' ').trim()
  return { capacity, cleaned }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- google`
Expected: the 3 new `parseCapacity` tests PASS. (Existing adapter tests may change in Task 3 — they should still pass for now.)

- [ ] **Step 5: Commit**

```bash
git add src/adapters/google.ts tests/unit/adapters/google.test.ts
git commit -m "feat(google): add [capacity:N] description tag parser"
```

---

### Task 3: Rework the Google adapter

**Files:**
- Modify: `src/adapters/google.ts`
- Test: `tests/unit/adapters/google.test.ts`

**Interfaces:**
- Consumes: `resolveCapacity` (Task 1), `parseCapacity` (Task 2).
- Produces: `GoogleCalendarAdapter` whose `getUpcomingEvents()`/`getEvent(id)` throw when `GOOGLE_CALENDAR_ID` or `GOOGLE_CALENDAR_API_KEY` is missing, throw on a non-OK HTTP response, and otherwise return `CalendarEvent[]` with capacity resolved and the `[capacity:N]` tag stripped from `description`.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/adapters/google.test.ts`, add `afterEach` to imports and to the existing top-level adapter `describe` so env/global stubs don't leak:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
```

Inside `describe('GoogleCalendarAdapter', ...)`, directly after the existing `beforeEach(...)` block, add:

```ts
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
```

Replace the existing `getUpcomingEvents returns empty array on API error` test with:

```ts
  it('getUpcomingEvents throws on a non-OK API response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as unknown as Response)

    const adapter = new GoogleCalendarAdapter()
    await expect(adapter.getUpcomingEvents()).rejects.toThrow(
      'Google Calendar request failed: 403'
    )
  })
```

Then add these tests inside the same `describe`:

```ts
  it('throws when GOOGLE_CALENDAR_ID is not configured', async () => {
    vi.stubEnv('GOOGLE_CALENDAR_ID', '')
    const adapter = new GoogleCalendarAdapter()
    await expect(adapter.getUpcomingEvents()).rejects.toThrow(
      'GOOGLE_CALENDAR_ID is not configured'
    )
  })

  it('extracts capacity from the description tag and cleans the text', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ ...mockGoogleEvent, description: 'Bring snacks [capacity:8]' }],
      }),
    } as Response)

    const adapter = new GoogleCalendarAdapter()
    const events = await adapter.getUpcomingEvents()
    expect(events[0].capacity).toBe(8)
    expect(events[0].description).toBe('Bring snacks')
  })

  it('falls back to DEFAULT_EVENT_CAPACITY when the event has no tag', async () => {
    vi.stubEnv('DEFAULT_EVENT_CAPACITY', '30')
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [mockGoogleEvent] }),
    } as Response)

    const adapter = new GoogleCalendarAdapter()
    const events = await adapter.getUpcomingEvents()
    expect(events[0].capacity).toBe(30)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- google`
Expected: FAIL — the error test still gets `[]` (old behavior), the config-missing test does not throw, capacity is `null` instead of `8`/`30`.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/adapters/google.ts` with:

```ts
import type { CalendarAdapter, CalendarEvent } from './calendar'
import { resolveCapacity } from './calendar'

interface GoogleEventItem {
  id: string
  summary?: string
  description?: string
  start: { dateTime?: string; date?: string }
  location?: string
}

export function parseCapacity(description: string): { capacity: number | null; cleaned: string } {
  const match = description.match(/\[capacity:\s*(\d+)\s*\]/i)
  if (!match) return { capacity: null, cleaned: description }
  const capacity = Number.parseInt(match[1], 10)
  const cleaned = description.replace(match[0], '').replace(/ {2,}/g, ' ').trim()
  return { capacity, cleaned }
}

function mapGoogleEvent(item: GoogleEventItem): CalendarEvent {
  const { capacity, cleaned } = parseCapacity(item.description ?? '')
  return {
    id: item.id,
    title: item.summary ?? '(Kein Titel)',
    description: cleaned,
    date: new Date(item.start.dateTime ?? item.start.date ?? ''),
    location: item.location ?? '',
    imageUrl: null,
    capacity: resolveCapacity(capacity),
    capacityWarningThreshold: null,
  }
}

export class GoogleCalendarAdapter implements CalendarAdapter {
  private async fetchEvents(): Promise<CalendarEvent[]> {
    const calendarId = process.env.GOOGLE_CALENDAR_ID
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY
    if (!calendarId) throw new Error('GOOGLE_CALENDAR_ID is not configured')
    if (!apiKey) throw new Error('GOOGLE_CALENDAR_API_KEY is not configured')

    const timeMin = new Date().toISOString()
    const url =
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` +
      `?key=${apiKey}&timeMin=${timeMin}&orderBy=startTime&singleEvents=true&maxResults=50`

    console.log('[google] fetching upcoming events')
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[google] events.list failed: ${res.status} ${body}`)
      throw new Error(`Google Calendar request failed: ${res.status}`)
    }
    const data = await res.json()
    const items: GoogleEventItem[] = data.items ?? []
    console.log(`[google] fetched ${items.length} events`)
    return items.map(mapGoogleEvent)
  }

  async getUpcomingEvents(): Promise<CalendarEvent[]> {
    return this.fetchEvents()
  }

  async getEvent(id: string): Promise<CalendarEvent | null> {
    const events = await this.fetchEvents()
    return events.find((e) => e.id === id) ?? null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- google`
Expected: PASS — all `GoogleCalendarAdapter` tests (including the new throw, capacity-tag, and default-fallback tests) and the `parseCapacity` block.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/google.ts tests/unit/adapters/google.test.ts
git commit -m "feat(google): fetch public calendar via API key with capacity + error handling"
```

---

### Task 4: Apply the shared default in the Directus adapter

**Files:**
- Modify: `src/adapters/directus.ts`
- Test: `tests/unit/adapters/directus.test.ts`

**Interfaces:**
- Consumes: `resolveCapacity` (Task 1).
- Produces: `DirectusCalendarAdapter` whose mapped `CalendarEvent.capacity` is `resolveCapacity(raw.capacity)` (explicit DB value wins; otherwise `DEFAULT_EVENT_CAPACITY`).

- [ ] **Step 1: Write the failing test**

In `tests/unit/adapters/directus.test.ts`, add `afterEach` to imports:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
```

Inside `describe('DirectusCalendarAdapter', ...)`, after the existing `beforeEach`, add:

```ts
  afterEach(() => vi.unstubAllEnvs())
```

Then add this test:

```ts
  it('applies DEFAULT_EVENT_CAPACITY when the event has no capacity', async () => {
    vi.stubEnv('DEFAULT_EVENT_CAPACITY', '15')
    mockClient.request.mockResolvedValue([{ ...mockEvent, capacity: null }])
    const adapter = new DirectusCalendarAdapter()
    const events = await adapter.getUpcomingEvents()
    expect(events[0].capacity).toBe(15)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- directus`
Expected: FAIL — `events[0].capacity` is `null`, not `15`.

- [ ] **Step 3: Write minimal implementation**

In `src/adapters/directus.ts`, update the import on line 3:

```ts
import { resolveCapacity, type CalendarAdapter, type CalendarEvent } from './calendar'
```

And change the `capacity` line inside `mapEvent` from `capacity: raw.capacity,` to:

```ts
    capacity: resolveCapacity(raw.capacity),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- directus`
Expected: PASS — new default-capacity test passes; existing `capacity toBe(20)` test still passes (explicit wins).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/directus.ts tests/unit/adapters/directus.test.ts
git commit -m "feat(directus): honor source-agnostic DEFAULT_EVENT_CAPACITY fallback"
```

---

### Task 5: Document config and close the TODO

**Files:**
- Modify: `manifests/frontend/configmap.yaml`
- Modify: `TODO.md`

**Interfaces:**
- Consumes: nothing.
- Produces: documented env vars; TODO item marked done.

- [ ] **Step 1: Run the full suite as a baseline**

Run: `npm test`
Expected: PASS — all unit tests green.

- [ ] **Step 2: Document the Google env vars in the ConfigMap**

In `manifests/frontend/configmap.yaml`, add these commented lines under the existing `data:` keys (do not change the active values — Directus stays the default source):

```yaml
  # To use Google Calendar instead of Directus as the event source, set:
  #   CALENDAR_SOURCE: "google"
  #   GOOGLE_CALENDAR_ID: "<public-calendar-id>"
  #   DEFAULT_EVENT_CAPACITY: "20"   # optional, source-agnostic fallback when an event has no capacity
  # and provide GOOGLE_CALENDAR_API_KEY via the directus-secret (key: google-api-key).
```

- [ ] **Step 3: Mark the TODO item done**

In `TODO.md`, change the Google Calendar line from `- [ ]` to `- [x]`:

```markdown
- [x] **Integrate Google Calendar** — add Google Calendar as an optional calendar source alongside Directus; configurable via `CALENDAR_SOURCE=google` and a service account or API key
```

- [ ] **Step 4: Verify the suite still passes**

Run: `npm test`
Expected: PASS — unchanged, all green.

- [ ] **Step 5: Commit**

```bash
git add manifests/frontend/configmap.yaml TODO.md
git commit -m "docs(calendar): document Google Calendar env vars and close TODO"
```

---

## Self-Review

**Spec coverage:**
- API-key auth + public calendar → Task 3 (`fetchEvents`). ✓
- RSVP via Directus, no schema change → unchanged code path; verified `rsvps.event_id` is a string. ✓
- `[capacity:N]` tag parsing + strip from display → Tasks 2 & 3. ✓
- Source-agnostic `DEFAULT_EVENT_CAPACITY` via `resolveCapacity` in both adapters → Tasks 1, 3, 4. ✓
- Config validation throws like Directus → Task 3. ✓
- Non-OK response throws → Task 3 (test updated from old `[]` behavior). ✓
- Config/deployment documentation → Task 5. ✓
- Tests for resolveCapacity / parseCapacity / mapGoogleEvent / fetchEvents → Tasks 1–4. ✓

**Placeholder scan:** No TBD/TODO/vague steps; every code step shows full code. ✓

**Type consistency:** `resolveCapacity(explicit: number | null): number | null` used identically in Tasks 1, 3, 4. `parseCapacity` returns `{ capacity, cleaned }` consumed in Task 3's `mapGoogleEvent`. `CalendarEvent` fields match `calendar.ts`. ✓
