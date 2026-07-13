# Aquis Mana Website

Website for **Aquis Mana e.V.**, a club in Aachen offering space for tabletop
gaming communities. The site states the club's purpose, links the membership
application (PDF), and — most importantly — shows the club's event calendar with
RSVP.

Built with [Astro](https://astro.build) (SSR, Node adapter) and Tailwind CSS.
Content is managed in [Directus](https://directus.io); the calendar can be
sourced from Directus or Google Calendar.

## Requirements

- Node.js ≥ 22.12
- A reachable Directus instance (for events, pages, documents, RSVP storage)

## Local development

```sh
npm install
npm run dev        # dev server at http://localhost:4321
```

Provide the environment variables below (e.g. via a `.env` file) before running.

## Commands

| Command             | Action                                             |
| :------------------ | :------------------------------------------------- |
| `npm run dev`       | Start the dev server at `localhost:4321`           |
| `npm run build`     | Build the production server bundle to `./dist/`    |
| `npm run start`     | Run the built server (`node ./dist/server/entry.mjs`) |
| `npm run preview`   | Preview the build locally                          |
| `npm test`          | Run unit + integration tests (Vitest)             |
| `npm run test:e2e`  | Run end-to-end tests (Playwright)                 |

## Environment variables

| Variable                    | Required | Default    | Description |
| :-------------------------- | :------- | :--------- | :---------- |
| `DIRECTUS_URL`              | yes      | —          | Base URL of the Directus instance (private; reached server-side). |
| `DIRECTUS_TOKEN`            | yes      | —          | Static token for Directus API access. |
| `CALENDAR_SOURCE`           | no       | `directus` | Event source: `directus` or `google`. |
| `GOOGLE_CALENDAR_ID`        | if google| —          | Google Calendar id. |
| `GOOGLE_CALENDAR_API_KEY`   | if google| —          | Google Calendar API key. |
| `EVENT_LOOKAHEAD_DAYS`      | no       | `7`        | Look-ahead window for the Google source. |
| `DEFAULT_EVENT_CAPACITY`    | no       | —          | Fallback capacity when an event has none set. |
| `PUBLIC_TURNSTILE_SITE_KEY` | yes      | —          | Cloudflare Turnstile site key (public). Widget is configured in **Invisible** mode. |
| `TURNSTILE_SECRET_KEY`      | yes      | —          | Cloudflare Turnstile secret (server-side verification). |
| `LOG_LEVEL`                 | no       | `info`     | `debug` \| `info` \| `warn` \| `error`. `debug` surfaces per-request logs. |
| `HOST` / `PORT`             | no       | `0.0.0.0` / `4321` | Bind address/port for the built server. |

Browser-facing Directus assets (event images, documents) are proxied through the
app at `/cms-assets/<id>`, since Directus itself is not publicly reachable.

## Project structure

```text
src/
├── adapters/     # calendar sources (directus, google) behind CalendarAdapter
├── components/   # Astro components (EventCard, RsvpOverlay, …)
├── i18n/         # translations (DE only for now; EN suppressed)
├── layouts/      # Base layout
├── lib/          # directus client, rsvp, captcha, logger, cms-assets, datetime
├── pages/        # routes + API endpoints (/api/rsvp, /cms-assets, …)
└── middleware.ts # nonce-based CSP, EN→DE redirect
manifests/        # Kubernetes manifests (frontend, directus, database)
tests/            # unit, integration, e2e (Playwright)
```

## Deployment

The site runs in a Kubernetes cluster, deployed via ArgoCD from `manifests/`.
CI (`.github/workflows/deploy.yml`) builds and pushes the container image
(`ghcr.io/aquis-mana/website`). TLS is terminated at the nginx ingress with a
Let's Encrypt certificate (cert-manager). See `TODO.md` for outstanding work.
