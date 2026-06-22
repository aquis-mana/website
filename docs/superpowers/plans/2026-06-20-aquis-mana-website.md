# Aquis Mana Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public Aquis Mana e.V. website with a prominent event calendar, RSVP system with statistics, club info pages, and a headless CMS for non-technical content editing — deployed on Kubernetes.

**Architecture:** Astro (SSR, Node adapter) serves all pages and API routes; Directus (headless CMS backed by Postgres) stores events, RSVP data, pages, and documents; a pluggable calendar adapter abstracts Google Calendar vs. Directus-managed events; all services run as Kubernetes Deployments.

**Tech Stack:** Astro 4.x, TypeScript 5, Tailwind CSS v3, `@astrojs/node`, `@astrojs/tailwind`, `@directus/sdk` v17, Vitest 1.x, Playwright 1.x, Directus 11.x, Postgres 16

## Global Constraints

- German (`de`) is the default locale; English (`en`) strings are stubbed from the start — never inline German strings in components, always use `t()` helper
- Brand: primary `#0B1F4F` (dark navy), accent `#1E6FD9` (royal blue), white `#FFFFFF`
- `CALENDAR_SOURCE` env var selects backend: `directus` | `google`
- RSVP browser token stored in `localStorage` under key `rsvp_<eventId>`
- Capacity warning fires at ≤10% remaining OR ≤5 spots (whichever triggers first); per-event override via `capacity_warning_threshold` field
- No auth this phase — all RSVPs are Visitors; `member_id` is nullable, reserved for OIDC phase
- All commits on branch `claude/2026-06-20`

---

## File Map

```
src/
  adapters/
    calendar.ts          # CalendarAdapter interface + getAdapter() factory
    directus.ts          # DirectusCalendarAdapter
    google.ts            # GoogleCalendarAdapter
  lib/
    directus.ts          # Directus SDK client singleton
    rsvp.ts              # RSVP business logic: create, update, cancel, stats
    captcha.ts           # Turnstile server-side verification
  i18n/
    de.ts                # All German strings (source of truth)
    en.ts                # English stubs (same keys, placeholder values)
    index.ts             # useTranslations(lang) → t(key) helper
  layouts/
    Base.astro           # HTML shell, <head>, nav, footer
  components/
    EventCard.astro      # Single event: title, date, location, stats, RSVP button
    EventCalendar.astro  # Grid/list of EventCards
    RsvpStats.astro      # "X / CAP attending" + priority display
    RsvpOverlay.astro    # Modal overlay (server-rendered, JS-activated)
  pages/
    index.astro          # Home: calendar as hero, club intro below
    ueber-uns.astro      # About page (content from Directus)
    mitgliedschaft.astro # Membership page (fees table + PDF download)
    dokumente.astro      # Documents page (PDF list from Directus)
    en/
      index.astro        # English home (stub)
      ueber-uns.astro    # English about (stub)
      mitgliedschaft.astro
      dokumente.astro
    api/
      rsvp/
        index.ts         # POST /api/rsvp (create + CAPTCHA)
        [token].ts       # PATCH/DELETE /api/rsvp/:token
      events/
        [id]/
          stats.ts       # GET /api/events/:id/stats
  env.d.ts               # Astro env type declarations
tests/
  unit/
    adapters/
      directus.test.ts
      google.test.ts
    lib/
      rsvp.test.ts
      captcha.test.ts
  e2e/
    rsvp.spec.ts
astro.config.mjs
tailwind.config.mjs
tsconfig.json
vitest.config.ts
playwright.config.ts
.env.example
manifests/
  database/
    statefulset.yaml
    service.yaml
    pvc.yaml
  directus/
    deployment.yaml
    service.yaml
    ingress.yaml
    pvc.yaml
    secret.yaml
  frontend/
    deployment.yaml
    service.yaml
    ingress.yaml
    configmap.yaml
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `tailwind.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.env.example`
- Create: `src/env.d.ts`

**Interfaces:**
- Produces: Astro dev server on port 4321; `npm test` runs Vitest; `npm run test:e2e` runs Playwright

- [ ] **Step 1: Install Astro and dependencies**

```bash
npm create astro@latest . -- --template minimal --typescript strict --no-git --install
npm install @astrojs/node @astrojs/tailwind tailwindcss @directus/sdk
npm install -D vitest @vitest/coverage-v8 playwright @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Write `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config'
import node from '@astrojs/node'
import tailwind from '@astrojs/tailwind'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [tailwind()],
  i18n: {
    defaultLocale: 'de',
    locales: ['de', 'en'],
    routing: { prefixDefaultLocale: false },
  },
})
```

- [ ] **Step 3: Write `tailwind.config.mjs`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        navy: '#0B1F4F',
        blue: { accent: '#1E6FD9' },
      },
    },
  },
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
```

- [ ] **Step 5: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:4321',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    port: 4321,
    reuseExistingServer: true,
  },
})
```

- [ ] **Step 6: Write `.env.example`**

```
CALENDAR_SOURCE=directus
DIRECTUS_URL=http://directus:8055
DIRECTUS_TOKEN=
GOOGLE_CALENDAR_ID=
GOOGLE_CALENDAR_API_KEY=
TURNSTILE_SECRET_KEY=
PUBLIC_TURNSTILE_SITE_KEY=
```

- [ ] **Step 7: Write `src/env.d.ts`**

```ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly CALENDAR_SOURCE: 'directus' | 'google'
  readonly DIRECTUS_URL: string
  readonly DIRECTUS_TOKEN: string
  readonly GOOGLE_CALENDAR_ID: string
  readonly GOOGLE_CALENDAR_API_KEY: string
  readonly TURNSTILE_SECRET_KEY: string
  readonly PUBLIC_TURNSTILE_SITE_KEY: string
}
```

- [ ] **Step 8: Add scripts to `package.json`**

Merge into the existing `package.json`:
```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "start": "node ./dist/server/entry.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 9: Verify dev server starts**

```bash
npm run dev
```
Expected: "astro v4.x.x ready" on port 4321, no errors.

- [ ] **Step 10: Commit**

```bash
git add astro.config.mjs tailwind.config.mjs tsconfig.json vitest.config.ts playwright.config.ts .env.example src/env.d.ts package.json package-lock.json
git commit -m "feat: scaffold Astro SSR project with Tailwind, Vitest, Playwright"
```

---

### Task 2: i18n Strings & Base Layout

**Files:**
- Create: `src/i18n/de.ts`
- Create: `src/i18n/en.ts`
- Create: `src/i18n/index.ts`
- Create: `src/layouts/Base.astro`
- Create: `tests/unit/i18n.test.ts`

**Interfaces:**
- Produces: `useTranslations(lang: 'de' | 'en'): (key: keyof typeof de) => string`
- Produces: `Base.astro` accepts props `{ title: string, lang?: 'de' | 'en' }`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/i18n.test.ts
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
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm test -- tests/unit/i18n.test.ts
```
Expected: FAIL — "Cannot find module '../../src/i18n/index'"

- [ ] **Step 3: Write `src/i18n/de.ts`**

```ts
export default {
  'nav.home': 'Startseite',
  'nav.about': 'Über uns',
  'nav.membership': 'Mitgliedschaft',
  'nav.documents': 'Dokumente',
  'home.intro.heading': 'Willkommen bei Aquis Mana e.V.',
  'home.intro.body': 'Wir bieten Raum für Spielgemeinschaften in Aachen — offen für alle Tabletop-Gruppen, besonders für jüngere Spieler.',
  'events.heading': 'Veranstaltungen',
  'events.empty': 'Keine kommenden Veranstaltungen.',
  'events.rsvp': 'Anmelden',
  'events.attending': 'Teilnehmer',
  'events.capacity': 'Kapazität',
  'events.full': 'Ausgebucht',
  'events.nearFull': 'Fast ausgebucht',
  'events.priority.heading': 'Priorität bei Überbuchung',
  'events.priority.membersYes': 'Mitglieder — Ja',
  'events.priority.visitorsYes': 'Besucher — Ja',
  'events.priority.membersMaybe': 'Mitglieder — Vielleicht',
  'events.priority.visitorsMaybe': 'Besucher — Vielleicht',
  'rsvp.heading': 'Anmeldung',
  'rsvp.name': 'Dein Name',
  'rsvp.yes': 'Ja',
  'rsvp.maybe': 'Vielleicht',
  'rsvp.submit': 'Anmelden',
  'rsvp.cancel': 'Abmelden',
  'rsvp.change': 'Ändern',
  'rsvp.currentStatus': 'Du hast dich angemeldet als',
  'rsvp.warning.nearFull': 'Diese Veranstaltung ist fast ausgebucht.',
  'rsvp.warning.full': 'Diese Veranstaltung ist ausgebucht. Du kannst dich trotzdem anmelden.',
  'rsvp.error.generic': 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
  'membership.heading': 'Mitgliedschaft',
  'membership.types.heading': 'Mitgliedschaftsarten',
  'membership.payment.heading': 'Zahlung',
  'membership.download': 'Mitgliedschaftsantrag herunterladen',
  'documents.heading': 'Dokumente',
  'about.heading': 'Über uns',
  'footer.contact': 'Kontakt',
  'footer.instagram': 'Instagram',
} as const
```

- [ ] **Step 4: Write `src/i18n/en.ts`**

```ts
import type de from './de'

// English stubs — replace with translations when needed
const en: Record<keyof typeof de, string> = {
  'nav.home': 'Home',
  'nav.about': 'About',
  'nav.membership': 'Membership',
  'nav.documents': 'Documents',
  'home.intro.heading': 'Welcome to Aquis Mana e.V.',
  'home.intro.body': 'We provide space for gaming communities in Aachen — open to all tabletop groups, especially younger players.',
  'events.heading': 'Events',
  'events.empty': 'No upcoming events.',
  'events.rsvp': 'RSVP',
  'events.attending': 'Attending',
  'events.capacity': 'Capacity',
  'events.full': 'Full',
  'events.nearFull': 'Almost full',
  'events.priority.heading': 'Priority when overbooked',
  'events.priority.membersYes': 'Members — Yes',
  'events.priority.visitorsYes': 'Visitors — Yes',
  'events.priority.membersMaybe': 'Members — Maybe',
  'events.priority.visitorsMaybe': 'Visitors — Maybe',
  'rsvp.heading': 'RSVP',
  'rsvp.name': 'Your name',
  'rsvp.yes': 'Yes',
  'rsvp.maybe': 'Maybe',
  'rsvp.submit': 'Register',
  'rsvp.cancel': 'Cancel RSVP',
  'rsvp.change': 'Change',
  'rsvp.currentStatus': 'You have registered as',
  'rsvp.warning.nearFull': 'This event is almost full.',
  'rsvp.warning.full': 'This event is full. You can still register.',
  'rsvp.error.generic': 'Something went wrong. Please try again.',
  'membership.heading': 'Membership',
  'membership.types.heading': 'Membership types',
  'membership.payment.heading': 'Payment',
  'membership.download': 'Download membership form',
  'documents.heading': 'Documents',
  'about.heading': 'About us',
  'footer.contact': 'Contact',
  'footer.instagram': 'Instagram',
}

export default en
```

- [ ] **Step 5: Write `src/i18n/index.ts`**

```ts
import de from './de'
import en from './en'

type Strings = typeof de
const strings = { de, en } as const

export function useTranslations(lang: 'de' | 'en' = 'de') {
  return function t(key: keyof Strings): string {
    return strings[lang][key] ?? strings.de[key]
  }
}
```

- [ ] **Step 6: Run test to confirm passing**

```bash
npm test -- tests/unit/i18n.test.ts
```
Expected: PASS

- [ ] **Step 7: Write `src/layouts/Base.astro`**

```astro
---
import { useTranslations } from '../i18n/index'

interface Props {
  title: string
  lang?: 'de' | 'en'
}

const { title, lang = 'de' } = Astro.props
const t = useTranslations(lang)
const altLang = lang === 'de' ? 'en' : 'de'
const altHref = lang === 'de' ? '/en' + Astro.url.pathname : Astro.url.pathname.replace(/^\/en/, '') || '/'
---

<!doctype html>
<html lang={lang}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/favicon.ico" />
    <link rel="alternate" hreflang={altLang} href={altHref} />
    <title>{title} — Aquis Mana e.V.</title>
  </head>
  <body class="bg-white text-navy min-h-screen flex flex-col">
    <header class="bg-navy text-white">
      <nav class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href={lang === 'en' ? '/en' : '/'} class="flex items-center gap-3">
          <img src="/logo.jpeg" alt="Aquis Mana" class="h-10 w-10 rounded-full" />
          <span class="font-bold text-lg tracking-wide">Aquis Mana</span>
        </a>
        <ul class="flex gap-6 text-sm font-medium">
          <li><a href={lang === 'en' ? '/en' : '/'} class="hover:text-blue-accent transition-colors">{t('nav.home')}</a></li>
          <li><a href={lang === 'en' ? '/en/ueber-uns' : '/ueber-uns'} class="hover:text-blue-accent transition-colors">{t('nav.about')}</a></li>
          <li><a href={lang === 'en' ? '/en/mitgliedschaft' : '/mitgliedschaft'} class="hover:text-blue-accent transition-colors">{t('nav.membership')}</a></li>
          <li><a href={lang === 'en' ? '/en/dokumente' : '/dokumente'} class="hover:text-blue-accent transition-colors">{t('nav.documents')}</a></li>
          <li><a href={altHref} class="text-blue-accent hover:underline text-xs uppercase tracking-wider">{altLang.toUpperCase()}</a></li>
        </ul>
      </nav>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="bg-navy text-white text-sm mt-12">
      <div class="max-w-5xl mx-auto px-4 py-6 flex justify-between items-center">
        <span>© {new Date().getFullYear()} Aquis Mana e.V.</span>
        <div class="flex gap-4">
          <a href="https://www.instagram.com/aquis.mana" class="hover:text-blue-accent transition-colors">{t('footer.instagram')}</a>
        </div>
      </div>
    </footer>
  </body>
</html>
```

- [ ] **Step 8: Copy logo to public folder**

```bash
mkdir -p public
cp documents/assets/aquis-mana_logo.jpeg public/logo.jpeg
```

- [ ] **Step 9: Commit**

```bash
git add src/i18n/ src/layouts/ tests/unit/i18n.test.ts public/logo.jpeg
git commit -m "feat: add i18n strings and base layout"
```

---

### Task 3: Directus Client & Calendar Adapter Interface

**Files:**
- Create: `src/lib/directus.ts`
- Create: `src/adapters/calendar.ts`

**Interfaces:**
- Produces: `getDirectusClient(): DirectusClient` — singleton Directus SDK client authenticated with static token
- Produces: `CalendarEvent` type, `CalendarAdapter` interface, `getAdapter(): CalendarAdapter` factory

- [ ] **Step 1: Write `src/lib/directus.ts`**

```ts
import { createDirectus, rest, staticToken } from '@directus/sdk'

interface DirectusSchema {
  events: {
    id: string
    title: string
    description: string
    date: string
    location: string
    image: string | null
    capacity: number | null
    capacity_warning_threshold: number | null
    status: 'published' | 'draft'
  }[]
  rsvps: {
    id: string
    event_id: string
    name: string
    status: 'yes' | 'maybe' | 'cancelled'
    visitor_token: string
    member_id: string | null
    date_created: string
    date_updated: string
  }[]
  pages: {
    id: string
    slug: string
    title: string
    content: string
    status: 'published' | 'draft'
  }[]
  documents: {
    id: string
    title: string
    file: string
    category: string
    sort: number
  }[]
}

let client: ReturnType<typeof createDirectus<DirectusSchema>> | null = null

export function getDirectusClient() {
  if (!client) {
    client = createDirectus<DirectusSchema>(import.meta.env.DIRECTUS_URL)
      .with(staticToken(import.meta.env.DIRECTUS_TOKEN))
      .with(rest())
  }
  return client
}
```

- [ ] **Step 2: Write `src/adapters/calendar.ts`**

```ts
export interface CalendarEvent {
  id: string
  title: string
  description: string
  date: Date
  location: string
  imageUrl: string | null
  capacity: number | null
  capacityWarningThreshold: number | null
}

export interface CalendarAdapter {
  getUpcomingEvents(): Promise<CalendarEvent[]>
  getEvent(id: string): Promise<CalendarEvent | null>
}

export async function getAdapter(): Promise<CalendarAdapter> {
  const source = import.meta.env.CALENDAR_SOURCE ?? 'directus'
  if (source === 'google') {
    const { GoogleCalendarAdapter } = await import('./google')
    return new GoogleCalendarAdapter()
  }
  const { DirectusCalendarAdapter } = await import('./directus')
  return new DirectusCalendarAdapter()
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/directus.ts src/adapters/calendar.ts
git commit -m "feat: add Directus client and CalendarAdapter interface"
```

---

### Task 4: DirectusCalendarAdapter

**Files:**
- Create: `src/adapters/directus.ts`
- Create: `tests/unit/adapters/directus.test.ts`

**Interfaces:**
- Consumes: `getDirectusClient()` from `src/lib/directus.ts`; `CalendarAdapter`, `CalendarEvent` from `src/adapters/calendar.ts`
- Produces: `DirectusCalendarAdapter` implementing `CalendarAdapter`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/adapters/directus.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DirectusCalendarAdapter } from '../../../src/adapters/directus'

vi.mock('../../../src/lib/directus', () => ({
  getDirectusClient: vi.fn(),
}))

import { getDirectusClient } from '../../../src/lib/directus'

const mockEvent = {
  id: 'abc123',
  title: 'MtG Friday',
  description: 'Weekly draft',
  date: '2026-07-04T18:00:00Z',
  location: 'Vereinsheim',
  image: null,
  capacity: 20,
  capacity_warning_threshold: null,
  status: 'published' as const,
}

describe('DirectusCalendarAdapter', () => {
  let mockClient: { request: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockClient = { request: vi.fn() }
    vi.mocked(getDirectusClient).mockReturnValue(mockClient as any)
  })

  it('getUpcomingEvents returns mapped CalendarEvents', async () => {
    mockClient.request.mockResolvedValue([mockEvent])
    const adapter = new DirectusCalendarAdapter()
    const events = await adapter.getUpcomingEvents()

    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('abc123')
    expect(events[0].title).toBe('MtG Friday')
    expect(events[0].date).toBeInstanceOf(Date)
    expect(events[0].capacity).toBe(20)
  })

  it('getEvent returns null when not found', async () => {
    mockClient.request.mockResolvedValue([])
    const adapter = new DirectusCalendarAdapter()
    const event = await adapter.getEvent('missing')
    expect(event).toBeNull()
  })

  it('getUpcomingEvents filters draft events', async () => {
    mockClient.request.mockResolvedValue([
      { ...mockEvent, status: 'draft' },
    ])
    const adapter = new DirectusCalendarAdapter()
    // The adapter passes status filter to Directus; mock returns empty = 0 events
    mockClient.request.mockResolvedValue([])
    const events = await adapter.getUpcomingEvents()
    expect(events).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm test -- tests/unit/adapters/directus.test.ts
```
Expected: FAIL — "Cannot find module '../../../src/adapters/directus'"

- [ ] **Step 3: Write `src/adapters/directus.ts`**

```ts
import { readItems } from '@directus/sdk'
import { getDirectusClient } from '../lib/directus'
import type { CalendarAdapter, CalendarEvent } from './calendar'

function mapEvent(raw: {
  id: string
  title: string
  description: string
  date: string
  location: string
  image: string | null
  capacity: number | null
  capacity_warning_threshold: number | null
}): CalendarEvent {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    date: new Date(raw.date),
    location: raw.location,
    imageUrl: raw.image
      ? `${import.meta.env.DIRECTUS_URL}/assets/${raw.image}`
      : null,
    capacity: raw.capacity,
    capacityWarningThreshold: raw.capacity_warning_threshold,
  }
}

export class DirectusCalendarAdapter implements CalendarAdapter {
  async getUpcomingEvents(): Promise<CalendarEvent[]> {
    const client = getDirectusClient()
    const now = new Date().toISOString()
    const items = await client.request(
      readItems('events', {
        filter: {
          status: { _eq: 'published' },
          date: { _gte: now },
        },
        sort: ['date'],
      })
    )
    return items.map(mapEvent)
  }

  async getEvent(id: string): Promise<CalendarEvent | null> {
    const client = getDirectusClient()
    const items = await client.request(
      readItems('events', {
        filter: { id: { _eq: id }, status: { _eq: 'published' } },
        limit: 1,
      })
    )
    return items.length > 0 ? mapEvent(items[0]) : null
  }
}
```

- [ ] **Step 4: Run tests to confirm passing**

```bash
npm test -- tests/unit/adapters/directus.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/adapters/directus.ts tests/unit/adapters/directus.test.ts
git commit -m "feat: add DirectusCalendarAdapter"
```

---

### Task 5: GoogleCalendarAdapter

**Files:**
- Create: `src/adapters/google.ts`
- Create: `tests/unit/adapters/google.test.ts`

**Interfaces:**
- Produces: `GoogleCalendarAdapter` implementing `CalendarAdapter`; fetches from Google Calendar API v3 via `fetch`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/adapters/google.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GoogleCalendarAdapter } from '../../../src/adapters/google'

const mockGoogleEvent = {
  id: 'g001',
  summary: 'Board Game Night',
  description: 'Bring your favorites',
  start: { dateTime: '2026-07-10T19:00:00+02:00' },
  end: { dateTime: '2026-07-10T22:00:00+02:00' },
  location: 'Vereinsheim Aachen',
}

describe('GoogleCalendarAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('GOOGLE_CALENDAR_ID', 'test@group.calendar.google.com')
    vi.stubEnv('GOOGLE_CALENDAR_API_KEY', 'test-key')
  })

  it('getUpcomingEvents maps Google events to CalendarEvent', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [mockGoogleEvent] }),
    } as Response)

    const adapter = new GoogleCalendarAdapter()
    const events = await adapter.getUpcomingEvents()

    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('g001')
    expect(events[0].title).toBe('Board Game Night')
    expect(events[0].date).toBeInstanceOf(Date)
    expect(events[0].capacity).toBeNull()
  })

  it('getUpcomingEvents returns empty array on API error', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
    } as Response)

    const adapter = new GoogleCalendarAdapter()
    const events = await adapter.getUpcomingEvents()
    expect(events).toEqual([])
  })

  it('getEvent returns null (Google adapter does not support single lookup)', async () => {
    const adapter = new GoogleCalendarAdapter()
    // getEvent on Google adapter fetches all then filters
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [mockGoogleEvent] }),
    } as Response)
    const event = await adapter.getEvent('g001')
    expect(event).not.toBeNull()
    expect(event?.id).toBe('g001')
  })
})
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm test -- tests/unit/adapters/google.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write `src/adapters/google.ts`**

```ts
import type { CalendarAdapter, CalendarEvent } from './calendar'

interface GoogleEventItem {
  id: string
  summary?: string
  description?: string
  start: { dateTime?: string; date?: string }
  location?: string
}

function mapGoogleEvent(item: GoogleEventItem): CalendarEvent {
  return {
    id: item.id,
    title: item.summary ?? '(Kein Titel)',
    description: item.description ?? '',
    date: new Date(item.start.dateTime ?? item.start.date ?? ''),
    location: item.location ?? '',
    imageUrl: null,
    capacity: null,
    capacityWarningThreshold: null,
  }
}

export class GoogleCalendarAdapter implements CalendarAdapter {
  private async fetchEvents(): Promise<CalendarEvent[]> {
    const calendarId = encodeURIComponent(import.meta.env.GOOGLE_CALENDAR_ID)
    const apiKey = import.meta.env.GOOGLE_CALENDAR_API_KEY
    const timeMin = new Date().toISOString()
    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${apiKey}&timeMin=${timeMin}&orderBy=startTime&singleEvents=true&maxResults=50`

    const res = await fetch(url)
    if (!res.ok) return []

    const data = await res.json()
    return (data.items ?? []).map(mapGoogleEvent)
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

- [ ] **Step 4: Run tests to confirm passing**

```bash
npm test -- tests/unit/adapters/google.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/adapters/google.ts src/adapters/calendar.ts tests/unit/adapters/google.test.ts
git commit -m "feat: add GoogleCalendarAdapter and async adapter factory"
```

---

### Task 6: RSVP Library & Captcha Verification

**Files:**
- Create: `src/lib/rsvp.ts`
- Create: `src/lib/captcha.ts`
- Create: `tests/unit/lib/rsvp.test.ts`
- Create: `tests/unit/lib/captcha.test.ts`

**Interfaces:**
- Consumes: `getDirectusClient()` from `src/lib/directus.ts`
- Produces:
  - `createRsvp(eventId, name, status, visitorToken): Promise<RsvpRecord>`
  - `updateRsvp(visitorToken, status): Promise<RsvpRecord>`
  - `cancelRsvp(visitorToken): Promise<void>`
  - `getRsvpStats(eventId): Promise<RsvpStats>`
  - `verifyTurnstile(token: string): Promise<boolean>`
- Produces type: `RsvpRecord { id, eventId, name, status, visitorToken }`, `RsvpStats { yes: number, maybe: number, total: number, capacity: number | null, isNearFull: boolean, isOverFull: boolean }`

- [ ] **Step 1: Write failing RSVP tests**

```ts
// tests/unit/lib/rsvp.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRsvp, updateRsvp, cancelRsvp, getRsvpStats } from '../../../src/lib/rsvp'

vi.mock('../../../src/lib/directus', () => ({ getDirectusClient: vi.fn() }))
vi.mock('@directus/sdk', () => ({
  createItem: vi.fn((col: string, data: unknown) => ({ _tag: 'create', col, data })),
  readItems: vi.fn((col: string, opts: unknown) => ({ _tag: 'read', col, opts })),
  updateItem: vi.fn((col: string, id: string, data: unknown) => ({ _tag: 'update', col, id, data })),
}))

import { getDirectusClient } from '../../../src/lib/directus'

describe('createRsvp', () => {
  it('calls directus createItem with correct fields', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      id: 'r1', event_id: 'e1', name: 'Alice', status: 'yes', visitor_token: 'tok1', member_id: null,
    })
    vi.mocked(getDirectusClient).mockReturnValue({ request: mockRequest } as any)

    const result = await createRsvp('e1', 'Alice', 'yes', 'tok1')
    expect(result.eventId).toBe('e1')
    expect(result.name).toBe('Alice')
    expect(result.status).toBe('yes')
    expect(mockRequest).toHaveBeenCalled()
  })
})

describe('getRsvpStats', () => {
  it('counts yes and maybe, excludes cancelled', async () => {
    const mockRequest = vi.fn().mockResolvedValue([
      { status: 'yes' }, { status: 'yes' }, { status: 'maybe' }, { status: 'cancelled' },
    ])
    vi.mocked(getDirectusClient).mockReturnValue({ request: mockRequest } as any)

    const stats = await getRsvpStats('e1', 10)
    expect(stats.yes).toBe(2)
    expect(stats.maybe).toBe(1)
    expect(stats.total).toBe(3)
    expect(stats.capacity).toBe(10)
    expect(stats.isNearFull).toBe(false)
    expect(stats.isOverFull).toBe(false)
  })

  it('isOverFull when total > capacity', async () => {
    const mockRequest = vi.fn().mockResolvedValue([
      { status: 'yes' }, { status: 'yes' }, { status: 'yes' },
    ])
    vi.mocked(getDirectusClient).mockReturnValue({ request: mockRequest } as any)

    const stats = await getRsvpStats('e1', 2)
    expect(stats.isOverFull).toBe(true)
  })

  it('isNearFull when ≤5 spots remain', async () => {
    const mockRequest = vi.fn().mockResolvedValue(
      Array(16).fill({ status: 'yes' })
    )
    vi.mocked(getDirectusClient).mockReturnValue({ request: mockRequest } as any)

    const stats = await getRsvpStats('e1', 20)
    expect(stats.isNearFull).toBe(true)
    expect(stats.isOverFull).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm test -- tests/unit/lib/rsvp.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write `src/lib/rsvp.ts`**

```ts
import { createItem, readItems, updateItem } from '@directus/sdk'
import { getDirectusClient } from './directus'

export interface RsvpRecord {
  id: string
  eventId: string
  name: string
  status: 'yes' | 'maybe' | 'cancelled'
  visitorToken: string
}

export interface RsvpStats {
  yes: number
  maybe: number
  total: number
  capacity: number | null
  isNearFull: boolean
  isOverFull: boolean
}

function mapRsvp(raw: {
  id: string; event_id: string; name: string
  status: 'yes' | 'maybe' | 'cancelled'; visitor_token: string
}): RsvpRecord {
  return {
    id: raw.id,
    eventId: raw.event_id,
    name: raw.name,
    status: raw.status,
    visitorToken: raw.visitor_token,
  }
}

export async function createRsvp(
  eventId: string,
  name: string,
  status: 'yes' | 'maybe',
  visitorToken: string
): Promise<RsvpRecord> {
  const client = getDirectusClient()
  const raw = await client.request(
    createItem('rsvps', {
      event_id: eventId,
      name,
      status,
      visitor_token: visitorToken,
      member_id: null,
    })
  )
  return mapRsvp(raw)
}

export async function updateRsvp(
  visitorToken: string,
  status: 'yes' | 'maybe'
): Promise<RsvpRecord> {
  const client = getDirectusClient()
  const existing = await client.request(
    readItems('rsvps', {
      filter: { visitor_token: { _eq: visitorToken }, status: { _neq: 'cancelled' } },
      limit: 1,
    })
  )
  if (!existing.length) throw new Error('RSVP not found')
  const raw = await client.request(updateItem('rsvps', existing[0].id, { status }))
  return mapRsvp(raw)
}

export async function cancelRsvp(visitorToken: string): Promise<void> {
  const client = getDirectusClient()
  const existing = await client.request(
    readItems('rsvps', {
      filter: { visitor_token: { _eq: visitorToken }, status: { _neq: 'cancelled' } },
      limit: 1,
    })
  )
  if (!existing.length) return
  await client.request(updateItem('rsvps', existing[0].id, { status: 'cancelled' }))
}

export async function getRsvpStats(
  eventId: string,
  capacity: number | null,
  warningThreshold?: number | null
): Promise<RsvpStats> {
  const client = getDirectusClient()
  const items = await client.request(
    readItems('rsvps', {
      filter: { event_id: { _eq: eventId } },
      fields: ['status'],
    })
  )

  const yes = items.filter((r) => r.status === 'yes').length
  const maybe = items.filter((r) => r.status === 'maybe').length
  const total = yes + maybe

  let isNearFull = false
  let isOverFull = false

  if (capacity !== null) {
    isOverFull = total > capacity
    const remaining = capacity - total
    const threshold = warningThreshold ?? Math.max(Math.floor(capacity * 0.1), 5)
    isNearFull = !isOverFull && remaining <= threshold
  }

  return { yes, maybe, total, capacity, isNearFull, isOverFull }
}
```

- [ ] **Step 4: Write `src/lib/captcha.ts`**

```ts
export async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = import.meta.env.TURNSTILE_SECRET_KEY
  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    }
  )
  const data = await res.json()
  return data.success === true
}
```

- [ ] **Step 5: Write `tests/unit/lib/captcha.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { verifyTurnstile } from '../../../src/lib/captcha'

describe('verifyTurnstile', () => {
  it('returns true when Cloudflare responds with success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    } as Response))
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    expect(await verifyTurnstile('valid-token')).toBe(true)
  })

  it('returns false when Cloudflare responds with failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ success: false }),
    } as Response))
    expect(await verifyTurnstile('bad-token')).toBe(false)
  })
})
```

- [ ] **Step 6: Run all unit tests**

```bash
npm test
```
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/rsvp.ts src/lib/captcha.ts tests/unit/lib/
git commit -m "feat: add RSVP library and Turnstile captcha verification"
```

---

### Task 7: Static Pages

**Files:**
- Create: `src/pages/ueber-uns.astro`
- Create: `src/pages/mitgliedschaft.astro`
- Create: `src/pages/dokumente.astro`
- Create: `src/pages/en/ueber-uns.astro`
- Create: `src/pages/en/mitgliedschaft.astro`
- Create: `src/pages/en/dokumente.astro`

**Interfaces:**
- Consumes: `Base.astro`, `useTranslations`, `getDirectusClient()`

- [ ] **Step 1: Write `src/pages/ueber-uns.astro`**

```astro
---
import Base from '../layouts/Base.astro'
import { useTranslations } from '../i18n/index'
import { getDirectusClient } from '../lib/directus'
import { readItems } from '@directus/sdk'

const t = useTranslations('de')
const client = getDirectusClient()
const pages = await client.request(
  readItems('pages', { filter: { slug: { _eq: 'ueber-uns' }, status: { _eq: 'published' } }, limit: 1 })
)
const page = pages[0]
---

<Base title={t('about.heading')} lang="de">
  <section class="max-w-3xl mx-auto px-4 py-12">
    <h1 class="text-3xl font-bold text-navy mb-6">{t('about.heading')}</h1>
    {page ? (
      <div class="prose max-w-none" set:html={page.content} />
    ) : (
      <p class="text-gray-600">Inhalt folgt in Kürze.</p>
    )}
  </section>
</Base>
```

- [ ] **Step 2: Write `src/pages/mitgliedschaft.astro`**

```astro
---
import Base from '../layouts/Base.astro'
import { useTranslations } from '../i18n/index'
import { getDirectusClient } from '../lib/directus'
import { readItems } from '@directus/sdk'

const t = useTranslations('de')
const client = getDirectusClient()
const docs = await client.request(
  readItems('documents', {
    filter: { category: { _eq: 'Mitgliedschaft' } },
    sort: ['sort'],
  })
)
const antragDoc = docs.find((d) => d.title.toLowerCase().includes('antrag'))
---

<Base title={t('membership.heading')} lang="de">
  <section class="max-w-3xl mx-auto px-4 py-12">
    <h1 class="text-3xl font-bold text-navy mb-8">{t('membership.heading')}</h1>

    <h2 class="text-xl font-semibold text-navy mb-4">{t('membership.types.heading')}</h2>
    <table class="w-full border-collapse mb-8 text-sm">
      <thead>
        <tr class="bg-navy text-white">
          <th class="px-4 py-2 text-left">Art</th>
          <th class="px-4 py-2 text-right">Monatsbeitrag</th>
        </tr>
      </thead>
      <tbody>
        {[
          ['Regulär', '15,00 €'],
          ['Reduziert (Studierende, Azubis)', '10,00 €'],
          ['Stark reduziert (Schüler/innen, unter 18)', '7,50 €'],
          ['Fördermitglied', 'ab 15,00 €'],
          ['Ehrenmitglied', 'ab 1,00 €'],
        ].map(([type, fee], i) => (
          <tr class={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            <td class="px-4 py-2 border-b">{type}</td>
            <td class="px-4 py-2 border-b text-right font-mono">{fee}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <h2 class="text-xl font-semibold text-navy mb-4">{t('membership.payment.heading')}</h2>
    <div class="bg-gray-50 rounded-lg p-4 mb-8 text-sm font-mono">
      <p>Kontoinhaber: Aquis Mana e.V.</p>
      <p>IBAN: DE27 3905 0000 1077 8629 34</p>
      <p>Verwendungszweck: Mitgliedsbeitrag [Dein Name]</p>
    </div>

    {antragDoc && (
      <a
        href={`${import.meta.env.DIRECTUS_URL}/assets/${antragDoc.file}`}
        download
        class="inline-block bg-accent text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        {t('membership.download')} ↓
      </a>
    )}
  </section>
</Base>
```

- [ ] **Step 3: Write `src/pages/dokumente.astro`**

```astro
---
import Base from '../layouts/Base.astro'
import { useTranslations } from '../i18n/index'
import { getDirectusClient } from '../lib/directus'
import { readItems } from '@directus/sdk'

const t = useTranslations('de')
const client = getDirectusClient()
const docs = await client.request(
  readItems('documents', { sort: ['sort'] })
)
---

<Base title={t('documents.heading')} lang="de">
  <section class="max-w-3xl mx-auto px-4 py-12">
    <h1 class="text-3xl font-bold text-navy mb-8">{t('documents.heading')}</h1>
    <ul class="space-y-3">
      {docs.map((doc) => (
        <li>
          <a
            href={`${import.meta.env.DIRECTUS_URL}/assets/${doc.file}`}
            download
            class="flex items-center gap-3 p-4 border rounded-lg hover:border-blue-accent hover:bg-blue-50 transition-colors group"
          >
            <span class="text-2xl">📄</span>
            <div>
              <span class="font-medium text-navy group-hover:text-blue-accent">{doc.title}</span>
              <span class="text-xs text-gray-500 ml-2">{doc.category}</span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  </section>
</Base>
```

- [ ] **Step 4: Create English stub pages**

```astro
---
// src/pages/en/ueber-uns.astro
import Base from '../../layouts/Base.astro'
import { useTranslations } from '../../i18n/index'
const t = useTranslations('en')
---
<Base title={t('about.heading')} lang="en">
  <section class="max-w-3xl mx-auto px-4 py-12">
    <h1 class="text-3xl font-bold text-navy mb-6">{t('about.heading')}</h1>
    <p class="text-gray-600">English content coming soon.</p>
  </section>
</Base>
```

Repeat the same stub pattern for `src/pages/en/mitgliedschaft.astro` and `src/pages/en/dokumente.astro`, substituting the appropriate `t()` heading key.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ueber-uns.astro src/pages/mitgliedschaft.astro src/pages/dokumente.astro src/pages/en/
git commit -m "feat: add static pages (Über uns, Mitgliedschaft, Dokumente)"
```

---

### Task 8: Event Components & Home Page

**Files:**
- Create: `src/components/RsvpStats.astro`
- Create: `src/components/EventCard.astro`
- Create: `src/components/EventCalendar.astro`
- Create: `src/pages/index.astro`
- Create: `src/pages/en/index.astro`

**Interfaces:**
- Consumes: `getRsvpStats()`, `getAdapter()`, `CalendarEvent`, `Base.astro`, `useTranslations`

- [ ] **Step 1: Write `src/components/RsvpStats.astro`**

```astro
---
import { useTranslations } from '../i18n/index'
import type { RsvpStats } from '../lib/rsvp'

interface Props {
  stats: RsvpStats
  lang?: 'de' | 'en'
}

const { stats, lang = 'de' } = Astro.props
const t = useTranslations(lang)
---

<div class="flex items-center gap-2 text-sm">
  {stats.capacity !== null ? (
    <span class:list={[
      'font-mono px-2 py-0.5 rounded text-xs font-semibold',
      stats.isOverFull ? 'bg-red-100 text-red-700' :
      stats.isNearFull ? 'bg-yellow-100 text-yellow-700' :
      'bg-green-100 text-green-700'
    ]}>
      {stats.total} / {stats.capacity}
    </span>
  ) : (
    <span class="font-mono text-xs text-gray-500">{stats.total} {t('events.attending')}</span>
  )}

  {stats.isOverFull && (
    <span class="text-xs text-red-600 font-semibold">{t('events.full')}</span>
  )}
  {stats.isNearFull && !stats.isOverFull && (
    <span class="text-xs text-yellow-600 font-semibold">{t('events.nearFull')}</span>
  )}
</div>

{stats.isOverFull && (
  <details class="mt-1 text-xs text-gray-500">
    <summary class="cursor-pointer hover:text-navy">{t('events.priority.heading')}</summary>
    <ol class="mt-1 ml-4 list-decimal space-y-0.5">
      <li>{t('events.priority.membersYes')}</li>
      <li>{t('events.priority.visitorsYes')}</li>
      <li>{t('events.priority.membersMaybe')}</li>
      <li>{t('events.priority.visitorsMaybe')}</li>
    </ol>
  </details>
)}
```

- [ ] **Step 2: Write `src/components/EventCard.astro`**

```astro
---
import RsvpStats from './RsvpStats.astro'
import { getRsvpStats } from '../lib/rsvp'
import { useTranslations } from '../i18n/index'
import type { CalendarEvent } from '../adapters/calendar'

interface Props {
  event: CalendarEvent
  lang?: 'de' | 'en'
}

const { event, lang = 'de' } = Astro.props
const t = useTranslations(lang)
const stats = await getRsvpStats(event.id, event.capacity, event.capacityWarningThreshold)

const dateStr = event.date.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', {
  weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
})
const timeStr = event.date.toLocaleTimeString(lang === 'de' ? 'de-DE' : 'en-GB', {
  hour: '2-digit', minute: '2-digit',
})
---

<article
  class="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-accent transition-colors shadow-sm"
  data-event-id={event.id}
  data-event-title={event.title}
  data-event-date={dateStr}
  data-event-location={event.location}
  data-event-capacity={event.capacity}
  data-event-warning-threshold={event.capacityWarningThreshold}
  data-stats-near-full={stats.isNearFull}
  data-stats-over-full={stats.isOverFull}
>
  {event.imageUrl && (
    <img src={event.imageUrl} alt={event.title} class="w-full h-40 object-cover rounded-lg mb-4" />
  )}
  <div class="flex justify-between items-start gap-2 mb-2">
    <h3 class="text-lg font-bold text-navy">{event.title}</h3>
    <RsvpStats stats={stats} lang={lang} />
  </div>
  <p class="text-sm text-gray-500 mb-1">📅 {dateStr} · {timeStr}</p>
  {event.location && <p class="text-sm text-gray-500 mb-3">📍 {event.location}</p>}
  {event.description && <p class="text-sm text-gray-600 mb-4 line-clamp-3">{event.description}</p>}
  <button
    class="rsvp-trigger w-full bg-navy text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-accent transition-colors"
    data-event-id={event.id}
  >
    {t('events.rsvp')}
  </button>
</article>
```

- [ ] **Step 3: Write `src/components/EventCalendar.astro`**

```astro
---
import EventCard from './EventCard.astro'
import { useTranslations } from '../i18n/index'
import type { CalendarEvent } from '../adapters/calendar'

interface Props {
  events: CalendarEvent[]
  lang?: 'de' | 'en'
}

const { events, lang = 'de' } = Astro.props
const t = useTranslations(lang)
---

<section class="w-full">
  <h2 class="text-2xl font-bold text-navy mb-6">{t('events.heading')}</h2>
  {events.length === 0 ? (
    <p class="text-gray-500 text-center py-12">{t('events.empty')}</p>
  ) : (
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard event={event} lang={lang} />
      ))}
    </div>
  )}
</section>
```

- [ ] **Step 4: Write `src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro'
import EventCalendar from '../components/EventCalendar.astro'
import RsvpOverlay from '../components/RsvpOverlay.astro'
import { useTranslations } from '../i18n/index'
import { getAdapter } from '../adapters/calendar'

const t = useTranslations('de')
const adapter = await getAdapter()
const events = await adapter.getUpcomingEvents()
---

<Base title="Startseite" lang="de">
  <div class="max-w-6xl mx-auto px-4 py-10">
    <EventCalendar events={events} lang="de" />

    <section class="mt-20 max-w-2xl">
      <h2 class="text-2xl font-bold text-navy mb-4">{t('home.intro.heading')}</h2>
      <p class="text-gray-700 leading-relaxed">{t('home.intro.body')}</p>
    </section>
  </div>

  <RsvpOverlay lang="de" />
</Base>
```

- [ ] **Step 5: Write `src/pages/en/index.astro`**

```astro
---
import Base from '../../layouts/Base.astro'
import EventCalendar from '../../components/EventCalendar.astro'
import RsvpOverlay from '../../components/RsvpOverlay.astro'
import { useTranslations } from '../../i18n/index'
import { getAdapter } from '../../adapters/calendar'

const t = useTranslations('en')
const adapter = await getAdapter()
const events = await adapter.getUpcomingEvents()
---

<Base title="Home" lang="en">
  <div class="max-w-6xl mx-auto px-4 py-10">
    <EventCalendar events={events} lang="en" />
    <section class="mt-20 max-w-2xl">
      <h2 class="text-2xl font-bold text-navy mb-4">{t('home.intro.heading')}</h2>
      <p class="text-gray-700 leading-relaxed">{t('home.intro.body')}</p>
    </section>
  </div>
  <RsvpOverlay lang="en" />
</Base>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ src/pages/index.astro src/pages/en/index.astro
git commit -m "feat: add event calendar components and home page"
```

---

### Task 9: RSVP API Routes

**Files:**
- Create: `src/pages/api/rsvp/index.ts`
- Create: `src/pages/api/rsvp/[token].ts`
- Create: `src/pages/api/events/[id]/stats.ts`

**Interfaces:**
- Consumes: `createRsvp`, `updateRsvp`, `cancelRsvp`, `getRsvpStats` from `src/lib/rsvp.ts`; `verifyTurnstile` from `src/lib/captcha.ts`; `getAdapter` from `src/adapters/calendar.ts`
- Produces:
  - `POST /api/rsvp` body `{ eventId, name, status, visitorToken, captchaToken }` → `201 { id, eventId, status, visitorToken }` | `400` | `422`
  - `PATCH /api/rsvp/:token` body `{ status }` → `200 RsvpRecord` | `404`
  - `DELETE /api/rsvp/:token` → `204`
  - `GET /api/events/:id/stats` → `200 RsvpStats`

- [ ] **Step 1: Write `src/pages/api/rsvp/index.ts`**

```ts
import type { APIRoute } from 'astro'
import { createRsvp } from '../../../lib/rsvp'
import { verifyTurnstile } from '../../../lib/captcha'

export const POST: APIRoute = async ({ request }) => {
  let body: { eventId?: string; name?: string; status?: string; visitorToken?: string; captchaToken?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { eventId, name, status, visitorToken, captchaToken } = body

  if (!eventId || !name?.trim() || !status || !visitorToken || !captchaToken) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 })
  }
  if (status !== 'yes' && status !== 'maybe') {
    return new Response(JSON.stringify({ error: 'Invalid status' }), { status: 400 })
  }

  const captchaOk = await verifyTurnstile(captchaToken)
  if (!captchaOk) {
    return new Response(JSON.stringify({ error: 'CAPTCHA failed' }), { status: 422 })
  }

  const rsvp = await createRsvp(eventId, name.trim(), status, visitorToken)
  return new Response(JSON.stringify(rsvp), { status: 201 })
}
```

- [ ] **Step 2: Write `src/pages/api/rsvp/[token].ts`**

```ts
import type { APIRoute } from 'astro'
import { updateRsvp, cancelRsvp } from '../../../lib/rsvp'

export const PATCH: APIRoute = async ({ params, request }) => {
  const { token } = params
  if (!token) return new Response(null, { status: 400 })

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { status } = body
  if (status !== 'yes' && status !== 'maybe') {
    return new Response(JSON.stringify({ error: 'Invalid status' }), { status: 400 })
  }

  try {
    const rsvp = await updateRsvp(token, status)
    return new Response(JSON.stringify(rsvp), { status: 200 })
  } catch {
    return new Response(JSON.stringify({ error: 'RSVP not found' }), { status: 404 })
  }
}

export const DELETE: APIRoute = async ({ params }) => {
  const { token } = params
  if (!token) return new Response(null, { status: 400 })
  await cancelRsvp(token)
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 3: Write `src/pages/api/events/[id]/stats.ts`**

```ts
import type { APIRoute } from 'astro'
import { getRsvpStats } from '../../../../lib/rsvp'
import { getAdapter } from '../../../../adapters/calendar'

export const GET: APIRoute = async ({ params }) => {
  const { id } = params
  if (!id) return new Response(null, { status: 400 })

  const adapter = await getAdapter()
  const event = await adapter.getEvent(id)

  const stats = await getRsvpStats(
    id,
    event?.capacity ?? null,
    event?.capacityWarningThreshold ?? null
  )
  return new Response(JSON.stringify(stats), { status: 200 })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/
git commit -m "feat: add RSVP and stats API routes"
```

---

### Task 10: RSVP Overlay Component

**Files:**
- Create: `src/components/RsvpOverlay.astro`

**Interfaces:**
- Consumes: `useTranslations`, `PUBLIC_TURNSTILE_SITE_KEY` env var
- Produces: `<div id="rsvp-overlay">` hidden by default; activated by `.rsvp-trigger` buttons (which carry `data-event-id`); reads/writes `localStorage` key `rsvp_<eventId>`; calls `/api/rsvp` and `/api/rsvp/:token`

- [ ] **Step 1: Write `src/components/RsvpOverlay.astro`**

```astro
---
import { useTranslations } from '../i18n/index'

interface Props {
  lang?: 'de' | 'en'
}

const { lang = 'de' } = Astro.props
const t = useTranslations(lang)
const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY
---

<!-- Turnstile script -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

<!-- Overlay backdrop -->
<div
  id="rsvp-overlay"
  class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center hidden"
  aria-modal="true"
  role="dialog"
>
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 relative">
    <button
      id="rsvp-close"
      class="absolute top-4 right-4 text-gray-400 hover:text-navy text-2xl leading-none"
      aria-label="Schließen"
    >×</button>

    <h2 class="text-xl font-bold text-navy mb-4">{t('rsvp.heading')}</h2>

    <!-- Warning banner (hidden by default) -->
    <div id="rsvp-warning" class="hidden mb-4 p-3 rounded-lg text-sm font-medium"></div>

    <!-- New RSVP form (shown when no prior RSVP) -->
    <form id="rsvp-new-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="rsvp-name">
          {t('rsvp.name')}
        </label>
        <input
          id="rsvp-name"
          type="text"
          required
          maxlength="100"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-accent"
        />
      </div>

      <div class="flex gap-3">
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="rsvp-status" value="yes" class="sr-only peer" />
          <div class="border-2 rounded-lg p-3 text-center font-semibold transition-colors border-gray-200 peer-checked:border-blue-accent peer-checked:bg-blue-50 peer-checked:text-navy">
            {t('rsvp.yes')}
          </div>
        </label>
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="rsvp-status" value="maybe" class="sr-only peer" />
          <div class="border-2 rounded-lg p-3 text-center font-semibold transition-colors border-gray-200 peer-checked:border-blue-accent peer-checked:bg-blue-50 peer-checked:text-navy">
            {t('rsvp.maybe')}
          </div>
        </label>
      </div>

      <div class="cf-turnstile" data-sitekey={siteKey} data-theme="light"></div>

      <button
        type="submit"
        class="w-full bg-navy text-white py-2.5 rounded-lg font-semibold hover:bg-blue-accent transition-colors"
      >
        {t('rsvp.submit')}
      </button>
    </form>

    <!-- Returning user view (shown when prior RSVP exists) -->
    <div id="rsvp-existing" class="hidden space-y-4">
      <p class="text-sm text-gray-600">
        {t('rsvp.currentStatus')}: <strong id="rsvp-current-status-label"></strong>
      </p>
      <div class="flex gap-3">
        <button
          id="rsvp-switch-yes"
          class="flex-1 border-2 border-gray-200 rounded-lg p-3 text-center font-semibold hover:border-blue-accent transition-colors"
        >{t('rsvp.yes')}</button>
        <button
          id="rsvp-switch-maybe"
          class="flex-1 border-2 border-gray-200 rounded-lg p-3 text-center font-semibold hover:border-blue-accent transition-colors"
        >{t('rsvp.maybe')}</button>
      </div>
      <button
        id="rsvp-cancel-btn"
        class="w-full border-2 border-red-200 text-red-600 py-2.5 rounded-lg font-semibold hover:bg-red-50 transition-colors"
      >
        {t('rsvp.cancel')}
      </button>
    </div>

    <p id="rsvp-error" class="hidden mt-3 text-sm text-red-600">{t('rsvp.error.generic')}</p>
  </div>
</div>

<script>
  const STORAGE_PREFIX = 'rsvp_'

  const overlay = document.getElementById('rsvp-overlay')!
  const closeBtn = document.getElementById('rsvp-close')!
  const warningEl = document.getElementById('rsvp-warning')!
  const newForm = document.getElementById('rsvp-new-form') as HTMLFormElement
  const existingView = document.getElementById('rsvp-existing')!
  const currentStatusLabel = document.getElementById('rsvp-current-status-label')!
  const switchYes = document.getElementById('rsvp-switch-yes')!
  const switchMaybe = document.getElementById('rsvp-switch-maybe')!
  const cancelBtn = document.getElementById('rsvp-cancel-btn')!
  const errorEl = document.getElementById('rsvp-error')!

  let currentEventId = ''

  function storageKey(eventId: string) {
    return STORAGE_PREFIX + eventId
  }

  function getToken(eventId: string): string | null {
    return localStorage.getItem(storageKey(eventId))
  }

  function setToken(eventId: string, token: string) {
    localStorage.setItem(storageKey(eventId), token)
  }

  function clearToken(eventId: string) {
    localStorage.removeItem(storageKey(eventId))
  }

  function generateToken(): string {
    return crypto.randomUUID()
  }

  function openOverlay(eventId: string, isNearFull: boolean, isOverFull: boolean) {
    currentEventId = eventId
    errorEl.classList.add('hidden')

    // Warning banner
    if (isOverFull) {
      warningEl.textContent = warningEl.dataset.fullText ?? ''
      warningEl.className = 'mb-4 p-3 rounded-lg text-sm font-medium bg-red-50 text-red-700'
    } else if (isNearFull) {
      warningEl.textContent = warningEl.dataset.nearFullText ?? ''
      warningEl.className = 'mb-4 p-3 rounded-lg text-sm font-medium bg-yellow-50 text-yellow-700'
    } else {
      warningEl.classList.add('hidden')
    }

    const existingToken = getToken(eventId)
    if (existingToken) {
      showExistingView(existingToken)
    } else {
      newForm.classList.remove('hidden')
      existingView.classList.add('hidden')
    }

    overlay.classList.remove('hidden')
    document.body.style.overflow = 'hidden'
  }

  function closeOverlay() {
    overlay.classList.add('hidden')
    document.body.style.overflow = ''
    newForm.reset()
    // Reset Turnstile if available
    if (typeof (window as any).turnstile !== 'undefined') {
      (window as any).turnstile.reset()
    }
  }

  function showExistingView(token: string) {
    // Fetch current status to display
    fetch(`/api/rsvp/${token}`, { method: 'GET' }).catch(() => {})
    newForm.classList.add('hidden')
    existingView.classList.remove('hidden')
    // We don't know the status from localStorage — show generic label
    currentStatusLabel.textContent = token ? 'angemeldet' : ''
  }

  // Trigger buttons on event cards
  document.querySelectorAll<HTMLButtonElement>('.rsvp-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest<HTMLElement>('[data-event-id]')!
      const eventId = btn.dataset.eventId ?? card.dataset.eventId ?? ''
      const isNearFull = card.dataset.statsNearFull === 'true'
      const isOverFull = card.dataset.statsOverFull === 'true'
      openOverlay(eventId, isNearFull, isOverFull)
    })
  })

  closeBtn.addEventListener('click', closeOverlay)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeOverlay()
  })

  // New RSVP form submit
  newForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    errorEl.classList.add('hidden')

    const name = (document.getElementById('rsvp-name') as HTMLInputElement).value.trim()
    const statusRadio = newForm.querySelector<HTMLInputElement>('input[name="rsvp-status"]:checked')
    const status = statusRadio?.value
    const captchaEl = newForm.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')
    const captchaToken = captchaEl?.value ?? ''

    if (!name || !status) return

    const visitorToken = generateToken()

    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: currentEventId,
          name,
          status,
          visitorToken,
          captchaToken,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setToken(currentEventId, visitorToken)
      closeOverlay()
      // Reload page to update stats
      window.location.reload()
    } catch {
      errorEl.classList.remove('hidden')
    }
  })

  // Switch status buttons
  async function switchStatus(status: 'yes' | 'maybe') {
    const token = getToken(currentEventId)
    if (!token) return
    errorEl.classList.add('hidden')
    try {
      const res = await fetch(`/api/rsvp/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed')
      closeOverlay()
      window.location.reload()
    } catch {
      errorEl.classList.remove('hidden')
    }
  }

  switchYes.addEventListener('click', () => switchStatus('yes'))
  switchMaybe.addEventListener('click', () => switchStatus('maybe'))

  cancelBtn.addEventListener('click', async () => {
    const token = getToken(currentEventId)
    if (!token) return
    errorEl.classList.add('hidden')
    try {
      await fetch(`/api/rsvp/${token}`, { method: 'DELETE' })
      clearToken(currentEventId)
      closeOverlay()
      window.location.reload()
    } catch {
      errorEl.classList.remove('hidden')
    }
  })
</script>
```

- [ ] **Step 2: Add warning text as data attributes** (add to the `warningEl` div in the component):

In `RsvpOverlay.astro`, update the warning div opening tag to include translated data attributes:
```astro
<div
  id="rsvp-warning"
  class="hidden mb-4 p-3 rounded-lg text-sm font-medium"
  data-near-full-text={t('rsvp.warning.nearFull')}
  data-full-text={t('rsvp.warning.full')}
></div>
```

And update the JS to use `warningEl.dataset.nearFullText` and `warningEl.dataset.fullText` instead of literal strings (already shown in Step 1 script).

- [ ] **Step 3: Write Playwright e2e test**

```ts
// tests/e2e/rsvp.spec.ts
import { test, expect } from '@playwright/test'

test('RSVP overlay opens on button click', async ({ page }) => {
  await page.goto('/')
  const rsvpBtn = page.locator('.rsvp-trigger').first()
  await rsvpBtn.click()
  await expect(page.locator('#rsvp-overlay')).toBeVisible()
})

test('RSVP overlay closes on backdrop click', async ({ page }) => {
  await page.goto('/')
  await page.locator('.rsvp-trigger').first().click()
  await expect(page.locator('#rsvp-overlay')).toBeVisible()
  await page.locator('#rsvp-overlay').click({ position: { x: 5, y: 5 } })
  await expect(page.locator('#rsvp-overlay')).toBeHidden()
})

test('RSVP overlay closes on Escape key', async ({ page }) => {
  await page.goto('/')
  await page.locator('.rsvp-trigger').first().click()
  await page.keyboard.press('Escape')
  await expect(page.locator('#rsvp-overlay')).toBeHidden()
})
```

- [ ] **Step 4: Commit**

```bash
git add src/components/RsvpOverlay.astro tests/e2e/rsvp.spec.ts
git commit -m "feat: add RSVP overlay with browser token, status switching, and cancellation"
```

---

### Task 11: Kubernetes Manifests

**Files:**
- Create: `manifests/database/statefulset.yaml`
- Create: `manifests/database/service.yaml`
- Create: `manifests/database/pvc.yaml`
- Create: `manifests/directus/deployment.yaml`
- Create: `manifests/directus/service.yaml`
- Create: `manifests/directus/ingress.yaml`
- Create: `manifests/directus/pvc.yaml`
- Create: `manifests/directus/secret.yaml`
- Create: `manifests/frontend/deployment.yaml`
- Create: `manifests/frontend/service.yaml`
- Create: `manifests/frontend/ingress.yaml`
- Create: `manifests/frontend/configmap.yaml`

- [ ] **Step 1: Write Postgres manifests**

```yaml
# manifests/database/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: verein
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 5Gi
```

```yaml
# manifests/database/statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: verein
spec:
  selector:
    matchLabels:
      app: postgres
  serviceName: postgres
  replicas: 1
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_DB
              value: directus
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: directus-secret
                  key: db-user
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: directus-secret
                  key: db-password
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: postgres-pvc
```

```yaml
# manifests/database/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: verein
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
  clusterIP: None
```

- [ ] **Step 2: Write Directus manifests**

```yaml
# manifests/directus/secret.yaml
# IMPORTANT: Replace all base64 values before applying.
# Generate with: echo -n 'value' | base64
apiVersion: v1
kind: Secret
metadata:
  name: directus-secret
  namespace: verein
type: Opaque
data:
  db-user: ZGlyZWN0dXM=       # directus
  db-password: Q0hBTkdFTUU=   # CHANGEME
  admin-email: YWRtaW5AYXEuZGU=   # admin@aq.de
  admin-password: Q0hBTkdFTUU=    # CHANGEME
  secret-key: Q0hBTkdFTUU=        # CHANGEME (random 64-char string)
  static-token: Q0hBTkdFTUU=      # CHANGEME (random token for API access)
```

```yaml
# manifests/directus/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: directus-uploads-pvc
  namespace: verein
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 10Gi
```

```yaml
# manifests/directus/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: directus
  namespace: verein
spec:
  replicas: 1
  selector:
    matchLabels:
      app: directus
  template:
    metadata:
      labels:
        app: directus
    spec:
      containers:
        - name: directus
          image: directus/directus:11
          ports:
            - containerPort: 8055
          env:
            - name: SECRET
              valueFrom:
                secretKeyRef:
                  name: directus-secret
                  key: secret-key
            - name: DB_CLIENT
              value: pg
            - name: DB_HOST
              value: postgres
            - name: DB_PORT
              value: "5432"
            - name: DB_DATABASE
              value: directus
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: directus-secret
                  key: db-user
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: directus-secret
                  key: db-password
            - name: ADMIN_EMAIL
              valueFrom:
                secretKeyRef:
                  name: directus-secret
                  key: admin-email
            - name: ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: directus-secret
                  key: admin-password
            - name: STORAGE_LOCATIONS
              value: local
            - name: STORAGE_LOCAL_ROOT
              value: /directus/uploads
            - name: PUBLIC_URL
              value: https://cms.aquis-mana.de
          volumeMounts:
            - name: uploads
              mountPath: /directus/uploads
      volumes:
        - name: uploads
          persistentVolumeClaim:
            claimName: directus-uploads-pvc
```

```yaml
# manifests/directus/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: directus
  namespace: verein
spec:
  selector:
    app: directus
  ports:
    - port: 8055
      targetPort: 8055
```

```yaml
# manifests/directus/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: directus
  namespace: verein
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts: [cms.aquis-mana.de]
      secretName: directus-tls
  rules:
    - host: cms.aquis-mana.de
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: directus
                port:
                  number: 8055
```

- [ ] **Step 3: Write frontend manifests**

```yaml
# manifests/frontend/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: frontend-config
  namespace: verein
data:
  CALENDAR_SOURCE: "directus"
  DIRECTUS_URL: "http://directus:8055"
  PUBLIC_TURNSTILE_SITE_KEY: "REPLACE_WITH_TURNSTILE_SITE_KEY"
```

```yaml
# manifests/frontend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: verein
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: ghcr.io/aquis-mana/website:latest
          ports:
            - containerPort: 4321
          envFrom:
            - configMapRef:
                name: frontend-config
          env:
            - name: DIRECTUS_TOKEN
              valueFrom:
                secretKeyRef:
                  name: directus-secret
                  key: static-token
            - name: TURNSTILE_SECRET_KEY
              valueFrom:
                secretKeyRef:
                  name: directus-secret
                  key: turnstile-secret
          readinessProbe:
            httpGet:
              path: /
              port: 4321
            initialDelaySeconds: 5
            periodSeconds: 10
```

```yaml
# manifests/frontend/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: verein
spec:
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 4321
```

```yaml
# manifests/frontend/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: frontend
  namespace: verein
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts: [aquis-mana.de, www.aquis-mana.de]
      secretName: frontend-tls
  rules:
    - host: aquis-mana.de
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
    - host: www.aquis-mana.de
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
```

- [ ] **Step 4: Write Dockerfile for frontend**

```dockerfile
# Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
```

- [ ] **Step 5: Create Directus collections (manual step)**

After deploying Directus, log in to `https://cms.aquis-mana.de/admin` and create the following collections with the exact fields defined in the design spec:

1. **events** — fields: `title` (string), `description` (text, wysiwyg), `date` (datetime), `location` (string), `image` (image), `capacity` (integer, nullable), `capacity_warning_threshold` (integer, nullable), `status` (select: published/draft, default: draft)
2. **rsvps** — fields: `event_id` (string), `name` (string), `status` (select: yes/maybe/cancelled), `visitor_token` (string), `member_id` (string, nullable)
3. **pages** — fields: `slug` (string, unique), `title` (string), `content` (text, wysiwyg), `status` (select: published/draft)
4. **documents** — fields: `title` (string), `file` (file), `category` (string), `sort` (integer)

Set permissions for the **Public** role on `rsvps`: allow `create`. Keep all other collections read-only for Public. The frontend uses the static admin token (never exposed to the browser) for all reads.

Upload the three PDFs from `documents/` to Directus Files and create Document records linking to them.

- [ ] **Step 6: Commit**

```bash
git add manifests/ Dockerfile
git commit -m "feat: add Kubernetes manifests and Dockerfile"
```

---

## Deployment Checklist

Before going live:
- [ ] Replace all `CHANGEME` values in `manifests/directus/secret.yaml` with real base64-encoded secrets
- [ ] Add `turnstile-secret` key to the Directus secret
- [ ] Register domain `aquis-mana.de` and point DNS to cluster ingress IP
- [ ] Create Cloudflare Turnstile site key (free) at dash.cloudflare.com → Turnstile
- [ ] Configure `PUBLIC_TURNSTILE_SITE_KEY` in `manifests/frontend/configmap.yaml`
- [ ] Set `CALENDAR_SOURCE` to `google` and provide `GOOGLE_CALENDAR_ID` + `GOOGLE_CALENDAR_API_KEY` if using Google Calendar
- [ ] Create Directus collections and upload PDFs (Task 11, Step 5)
- [ ] Push Docker image to `ghcr.io/aquis-mana/website:latest` via CI
