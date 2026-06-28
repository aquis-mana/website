# Google Calendar Sync — Design

**Date:** 2026-06-28
**Status:** Approved

## Goal

Add Google Calendar as an optional, read-only event source for the website,
selected via `CALENDAR_SOURCE=google`, while RSVPs continue to be stored in and
served from Directus. Directus remains the default source; nothing changes for
existing deployments unless `CALENDAR_SOURCE` is set to `google`.

## Decisions

- **Authentication:** API key against a **public** Google Calendar. No
  service account / OAuth. Config via `GOOGLE_CALENDAR_ID` and
  `GOOGLE_CALENDAR_API_KEY`.
- **RSVPs:** Continue to live in Directus. The `rsvps.event_id` field is a plain
  `string` (not a foreign key to the `events` collection), so RSVPs key off the
  Google event id with **no schema change**.
- **Capacity:** Google has no capacity field. Capacity is read from a
  `[capacity:N]` tag in the event description. The tag is stripped from the text
  shown on the event card.
- **Default capacity:** Source-agnostic. A shared `DEFAULT_EVENT_CAPACITY` env
  var provides a fallback used by **both** the Google and Directus adapters when
  an event specifies no explicit capacity.

## Components

### 1. `src/adapters/calendar.ts` — shared capacity resolution

Add an exported helper:

```ts
export function resolveCapacity(explicit: number | null): number | null
```

Returns `explicit` if non-null; otherwise the integer parsed from
`process.env.DEFAULT_EVENT_CAPACITY`; otherwise `null`. An unset or
non-numeric `DEFAULT_EVENT_CAPACITY` resolves to `null` (unlimited, no
warnings).

Resolution order per event: **explicit capacity → `DEFAULT_EVENT_CAPACITY` →
`null`**.

### 2. `src/adapters/google.ts` — rework the existing scaffold

- **Config validation:** read `GOOGLE_CALENDAR_ID` and
  `GOOGLE_CALENDAR_API_KEY` from `process.env`. Throw
  `Error('GOOGLE_CALENDAR_ID is not configured')` (and the analogous error for
  the API key) when missing. This mirrors the Directus adapter so the
  `index.astro` try/catch logs the error and renders an empty calendar.
- **`fetchEvents()`:** call Google Calendar API v3 `events.list`:
  `singleEvents=true&orderBy=startTime&timeMin=<now ISO>&maxResults=50`.
  Recurring events are auto-expanded and already ordered by start time. On a
  non-OK HTTP response, log the status and body and **throw** (same failure
  behavior as the Directus adapter).
- **`mapGoogleEvent()`:** map a Google event item to `CalendarEvent`:
  - `id`: Google event id
  - `title`: `summary ?? '(Kein Titel)'`
  - `date`: `new Date(start.dateTime ?? start.date ?? '')` (all-day supported)
  - `location`: `location ?? ''`
  - `imageUrl`: `null`
  - `description`: the `cleaned` text from `parseCapacity` (tag removed)
  - `capacity`: `resolveCapacity(parseCapacity(description).capacity)`
  - `capacityWarningThreshold`: `null` (so `getRsvpStats` auto-derives it as
    min 5 / 10%)

### 3. `parseCapacity(description)` — pure helper (exported, in `google.ts`)

```ts
export function parseCapacity(description: string): { capacity: number | null; cleaned: string }
```

- Regex `/\[capacity:\s*(\d+)\s*\]/i` extracts the first match.
- Returns the parsed integer (or `null` if no tag) and the description with the
  tag removed and surrounding whitespace tidied.
- Pure and side-effect free for straightforward unit testing. It only extracts
  the tag value; the `DEFAULT_EVENT_CAPACITY` fallback is applied separately by
  `resolveCapacity` so precedence lives in one place.

### 4. Directus adapter — apply the shared default

`src/adapters/directus.ts` builds its `CalendarEvent` with
`capacity: resolveCapacity(raw.capacity)` so the source-agnostic default also
applies to Directus events that have no capacity set.

### 5. RSVP path — unchanged

`EventCard` calls `getRsvpStats(event.id, event.capacity, event.capacityWarningThreshold)`
and the RSVP API treats `event_id` as an opaque string. Google event ids flow
through with zero code changes.

## Configuration / Deployment

Consumed only when `CALENDAR_SOURCE=google`; Directus stays the default.

- `GOOGLE_CALENDAR_ID` → `frontend-config` ConfigMap
- `GOOGLE_CALENDAR_API_KEY` → secret (`directus-secret` or a dedicated secret)
- `DEFAULT_EVENT_CAPACITY` → `frontend-config` ConfigMap (optional; source-agnostic)
- `CALENDAR_SOURCE` → set to `google` in the ConfigMap to activate

The manifest snippet is documented but the live source is **not** flipped as
part of this work.

## Testing (vitest, already configured)

- `resolveCapacity`: explicit value wins; falls back to `DEFAULT_EVENT_CAPACITY`;
  `null` when neither is set; non-numeric env resolves to `null`.
- `parseCapacity`: tag present / absent / with spaces / different case; tag
  stripped from `cleaned`.
- `mapGoogleEvent`: all-day vs timed event, missing `summary`/`location`,
  capacity extracted, description cleaned.
- `fetchEvents` with mocked `fetch`: happy path returns mapped events; non-OK
  response throws; missing config throws.

## Out of Scope (YAGNI)

- Service-account / private-calendar authentication
- Write-back to Google Calendar
- Event images from Google
- Editing capacity through Google's UI beyond the `[capacity:N]` tag convention
