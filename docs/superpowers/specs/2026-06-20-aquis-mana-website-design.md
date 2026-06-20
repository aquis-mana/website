# Aquis Mana e.V. — Website Design Spec

**Date:** 2026-06-20
**Status:** Approved

---

## Overview

A public website for Aquis Mana e.V., a tabletop gaming club in Aachen, Germany. The primary goal is an event calendar with RSVP functionality. Secondary goals are club information and a membership section. Content is managed by non-technical editors via a headless CMS.

---

## Pages

| Page | Slug | Description |
|---|---|---|
| Home | `/` | Event calendar is the primary/hero content. Club intro is secondary. |
| Über uns | `/ueber-uns` | Club purpose, history, gaming groups welcome, accessibility focus for younger players. |
| Mitgliedschaft | `/mitgliedschaft` | Membership types with fees, IBAN payment info, PDF membership form download. |
| Dokumente | `/dokumente` | Downloadable PDFs: Satzung, Beitragsordnung, Mitgliedschaftsantrag. |

Individual event detail is surfaced via the RSVP overlay on the calendar — no separate event detail page.

---

## Event Calendar

The calendar is the hero feature on the home page. It displays all upcoming events with:

- Event title, date, location
- Attendee count (`X / CAP`) and status badge ("Ausgebucht" when over capacity)
- RSVP button that opens the RSVP overlay

### Calendar Backend (pluggable)

Controlled by environment variable `CALENDAR_SOURCE=google|directus`.

Both adapters implement the same `CalendarAdapter` interface:

```ts
interface CalendarEvent {
  id: string
  title: string
  description: string
  date: Date
  location: string
  imageUrl?: string
  capacity?: number
}

interface CalendarAdapter {
  getUpcomingEvents(): Promise<CalendarEvent[]>
  getEvent(id: string): Promise<CalendarEvent | null>
}
```

- **`DirectusCalendarAdapter`** — reads from the Directus `events` collection
- **`GoogleCalendarAdapter`** — reads from a public Google Calendar via the Google Calendar API (read-only, API key auth)

Swapping backends requires only changing the env var and providing the appropriate credentials. No code changes needed.

---

## RSVP System

### Flow

**New visitor (no prior RSVP from this browser):**
1. User clicks RSVP button on an event → overlay opens
2. Overlay shows: name field, Ja/Vielleicht toggle, CAPTCHA (Cloudflare Turnstile), submit button
3. If event is near or over capacity, a warning banner is shown inside the overlay (RSVP is still allowed, not blocked)
4. On submit: RSVP is stored, a visitor token (UUID) is saved to localStorage keyed by event ID

**Returning visitor (same browser, prior RSVP exists):**
1. User clicks RSVP button → overlay opens showing current status
2. Three actions available: switch to "Ja", switch to "Vielleicht", cancel RSVP ("Abmelden")
3. Changes are reflected immediately; cancellation removes the RSVP and clears the localStorage token

**Capacity warning threshold:** ≤10% of capacity remaining, or ≤5 spots remaining, whichever triggers first. Configurable per event in Directus.

### RSVP Statuses

- `yes` — confirmed attendance
- `maybe` — tentative attendance
- `cancelled` — soft-deleted, not counted in stats

### Capacity & Priority

When over capacity, the event shows a priority order (informational only, not enforced):

1. Members (OIDC logged-in) — Ja
2. Visitors (anonymous) — Ja
3. Members — Vielleicht
4. Visitors — Vielleicht

Member status is determined by OIDC login (future phase). Currently all users are Visitors. The `member_id` field is nullable so the priority logic activates without a schema migration.

### Deduplication

Browser-based: a UUID visitor token is stored in localStorage per event. The same token is used for edits and cancellation. A different browser or device can submit a new RSVP as a visitor (acceptable without login).

---

## Data Model (Directus Collections)

### `events`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| title | string | |
| description | text | Rich text |
| date | datetime | |
| location | string | |
| image | file (relation) | Optional |
| capacity | integer | Optional; null = unlimited |
| capacity_warning_threshold | integer | Optional; overrides global default |
| status | enum (published, draft) | |

### `rsvps`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| event_id | string | External event ID: Directus UUID or Google Calendar event ID depending on active adapter |
| name | string | |
| status | enum (yes, maybe, cancelled) | |
| visitor_token | string | UUID from browser localStorage |
| member_id | string (nullable) | Future: OIDC user ID |
| created_at | datetime | |
| updated_at | datetime | |

### `pages`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| slug | string | Unique |
| title | string | |
| content | text | Rich text (Über uns, etc.) |
| status | enum (published, draft) | |

### `documents`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| title | string | |
| file | file (relation) | PDF |
| category | string | e.g. "Mitgliedschaft", "Satzung" |
| sort | integer | Display order |

---

## Technical Architecture

### Services (Kubernetes)

| Service | Technology | Exposed at |
|---|---|---|
| Frontend | Astro (SSR, Node adapter) | `aquis-mana.de` |
| CMS | Directus | `cms.aquis-mana.de` (admin only) |
| Database | Postgres | Internal only |

### Astro API Routes (SSR)

- `POST /api/rsvp` — create RSVP (validates CAPTCHA, stores in Directus)
- `PATCH /api/rsvp/:token` — update status (yes/maybe) by visitor token
- `DELETE /api/rsvp/:token` — cancel RSVP by visitor token
- `GET /api/events/:id/stats` — returns attendee counts per status for an event

### CAPTCHA

Cloudflare Turnstile (free tier). No user interaction required, GDPR-friendly. Applied to RSVP creation only (not edits/cancellations, which require the visitor token already stored in the browser).

### i18n

Astro built-in i18n routing. German (`/de/`) is the default locale, served at root. English (`/en/`) is stubbed from the start with placeholder strings so adding translations requires no structural changes. URL structure: `/` → German, `/en/` → English.

### Kubernetes Manifests

- `frontend/deployment.yaml` + `service.yaml` + `ingress.yaml`
- `directus/deployment.yaml` + `service.yaml` + `ingress.yaml` + `pvc.yaml` (for file uploads)
- `database/statefulset.yaml` + `service.yaml` + `pvc.yaml`
- Secrets: Directus admin credentials, Postgres password, Turnstile secret key, Google Calendar API key (optional)

---

## Branding

- **Primary color:** Dark navy blue (from logo: ~`#0B1F4F`)
- **Accent color:** Bright/royal blue (~`#1E6FD9`)
- **Text/highlights:** White
- **Logo:** `documents/assets/aquis-mana_logo.jpeg`
- Tone: clean, approachable, gaming community — not corporate

---

## Membership Section

Displays membership types and fees from the Beitragsordnung:

| Type | Monthly fee |
|---|---|
| Regulär | €15 |
| Reduziert (Studierende/Azubis) | €10 |
| Stark reduziert (Schüler/innen, unter 18) | €7,50 |
| Fördermitglied | ≥ €15 |
| Ehrenmitglied | ≥ €1 |

Payment: bank transfer or PayPal (PayPal fees paid by member).
IBAN: DE27 3905 0000 1077 8629 34 — Verwendungszweck: "Mitgliedsbeitrag [Name]"

PDF download button links to the Mitgliedschaftsantrag file in Directus.

**Future:** Online membership form with name, address, email, phone, membership type and payment interval — submitted via email, CAPTCHA protected.

---

## Out of Scope (This Phase)

- OIDC login / member accounts
- Online membership form submission
- English translations (i18n structure is in place)
- Instagram image integration (manual asset management)
- Email notifications for RSVP
