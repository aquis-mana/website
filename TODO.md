# Aquis Mana Website — Open Tasks

## Features

- [x] **Integrate Google Calendar** — add Google Calendar as an optional calendar source alongside Directus; configurable via `CALENDAR_SOURCE=google` and a service account or API key
- [ ] **Calendar-style event display** — show events in a calendar layout rather than a flat card grid. First iteration: a weekly view with rows for Mon–Sun. Later: add a separate "Future events" (upcoming) list below/alongside the weekly view for events beyond the current week.
- [ ] **Smarter event windowing for Google source** — currently shows all events within `EVENT_LOOKAHEAD_DAYS` (default 7). Desired: show the *next* instance of each recurring event, plus *all* single (non-recurring) events within a configurable time frame. Recurring instances share an underlying event id (Google `recurringEventId`); dedupe to the earliest upcoming instance per series while keeping single events unfiltered.
- [ ] **Refactor codebase** — clean up adapter layer, consolidate error handling, reduce duplication across API routes
- [x] **Hide EN locale while unimplemented** — suppress language switcher / EN routes until translations are complete; return 404 or redirect EN paths to DE
- [ ] **Make pages dynamic from Directus** — `Über uns` and `Mitgliedschaft` page content should be loaded from Directus `pages` collection instead of being hardcoded
- [ ] **Kubernetes Job to initialize Directus collections** — create a one-shot Job that applies the Directus schema snapshot (`directus-schema.json`) on first deploy, so collections are set up without manual curl commands
- [ ] **OIDC-based login for members** — add a member login using an OIDC provider running in the cluster; gate member-only content/pages behind authentication
- [x] **Hide the Cloudflare Turnstile banner** — the "Protected by Cloudflare" badge/banner should not be visible on the page; investigate CSS or widget config option to suppress it
