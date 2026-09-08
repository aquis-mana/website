# Aquis Mana Website — Open Tasks

## Features

- [x] **Integrate Google Calendar** — add Google Calendar as an optional calendar source alongside Directus; configurable via `CALENDAR_SOURCE=google` and a service account or API key
- [x] **Calendar-style event display** — superseded: the front page now renders a sectioned list (`Heute` / `Anstehend` / `Andere Veranstaltungen`) via `EventList.astro` + `lib/event-groups.ts` instead of a card grid.
- [x] **Smarter event windowing for Google source** — `lib/event-groups.ts` shows the next instance of each recurring series (deduped by Google `recurringEventId` → `CalendarEvent.seriesId`) plus all one-off events within `EVENT_LOOKAHEAD_DAYS` (now default 90).
- [ ] **Refactor codebase** — clean up adapter layer, consolidate error handling, reduce duplication across API routes
- [x] **Hide EN locale while unimplemented** — suppress language switcher / EN routes until translations are complete; return 404 or redirect EN paths to DE
- [x] **Make pages dynamic from Directus** — `Über uns` and `Mitgliedschaft` page content should be loaded from Directus `pages` collection instead of being hardcoded
- [ ] **Kubernetes Job to initialize Directus collections** — create a one-shot Job that applies the Directus schema snapshot (`directus-schema.json`) on first deploy, so collections are set up without manual curl commands
- [ ] **OIDC-based login for members** — add a member login using an OIDC provider running in the cluster; gate member-only content/pages behind authentication
- [x] **Hide the Cloudflare Turnstile banner** — the "Protected by Cloudflare" badge/banner should not be visible on the page; investigate CSS or widget config option to suppress it
