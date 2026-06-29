# Responsive Design Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Aquis Mana website render cleanly from ~320px phones through desktop by fixing the concrete responsive gaps (mobile nav, overflowing table, footer/heading polish).

**Architecture:** Targeted Tailwind v4 utility changes plus a small hamburger-menu toggle (plain inline `<script>`, the existing no-framework pattern). Shared `Base.astro` fixes the nav/footer for every page at once. Verified with a Playwright spec at mobile and desktop viewports.

**Tech Stack:** Astro 6, Tailwind CSS v4 (`@tailwindcss/vite`), Playwright (`@playwright/test`, already a dev dependency).

## Global Constraints

- Tailwind v4 default breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
- No new runtime dependencies; mobile menu uses a plain inline `<script is:inline>` (same pattern as the existing Turnstile/RSVP scripts).
- Localized strings go through the existing `t()` helper; add keys to BOTH `src/i18n/de.ts` and `src/i18n/en.ts`.
- Commit style: `<type>(scope): description`. Do NOT add any Claude/Co-authored-by signature.
- Work on branch `claude/2026-06-28`.
- e2e tests live in `tests/e2e/`; run with `npx playwright test` (config auto-starts `npm run dev` on :4321 and reuses an existing server).
- The `/en` content pages are stubs ("content coming soon"); only their shared chrome (nav/footer) and `h1` sizing change.

## File Structure

- `src/i18n/de.ts`, `src/i18n/en.ts` — Modify: add `nav.menu` key.
- `src/layouts/Base.astro` — Modify: nav links array, desktop nav `hidden md:flex`, hamburger button, mobile menu panel, toggle script, footer stacking.
- `src/pages/mitgliedschaft.astro` — Modify: wrap membership `<table>` in `overflow-x-auto`; responsive `h1`.
- `src/pages/ueber-uns.astro`, `src/pages/dokumente.astro` — Modify: responsive `h1`.
- `src/pages/en/mitgliedschaft.astro`, `src/pages/en/ueber-uns.astro`, `src/pages/en/dokumente.astro` — Modify: responsive `h1`.
- `tests/e2e/responsive.spec.ts` — Create: viewport assertions for nav + no-overflow.

---

### Task 1: Mobile hamburger navigation

**Files:**
- Modify: `src/i18n/de.ts`, `src/i18n/en.ts`
- Modify: `src/layouts/Base.astro` (header `<nav>` + add mobile menu panel + toggle script)
- Test: `tests/e2e/responsive.spec.ts` (create)

**Interfaces:**
- Consumes: existing `t()` helper, `lang`, `altLang`, `altHref` already defined in `Base.astro` frontmatter.
- Produces: DOM ids `#menu-toggle` (button) and `#mobile-menu` (panel); a frontmatter `navLinks` array `{ href: string; label: string }[]`.

- [ ] **Step 1: Ensure the Playwright browser is installed (one-time)**

Run: `npx playwright install chromium`
Expected: completes (downloads Chromium if missing, otherwise no-op).

- [ ] **Step 2: Write the failing e2e test**

Create `tests/e2e/responsive.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.describe('responsive layout', () => {
  test('mobile: hamburger visible, desktop nav hidden, toggle reveals menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.locator('#menu-toggle')).toBeVisible()
    await expect(page.locator('header nav ul')).toBeHidden()
    await expect(page.locator('#mobile-menu')).toBeHidden()
    await page.locator('#menu-toggle').click()
    await expect(page.locator('#mobile-menu')).toBeVisible()
  })

  test('desktop: nav visible, hamburger hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await expect(page.locator('header nav ul')).toBeVisible()
    await expect(page.locator('#menu-toggle')).toBeHidden()
  })

  test('mobile: home page has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx playwright test responsive`
Expected: FAIL — `#menu-toggle` / `#mobile-menu` do not exist yet.

- [ ] **Step 4: Add the `nav.menu` translation key**

In `src/i18n/de.ts`, add after the `'nav.documents'` line:

```ts
  'nav.menu': 'Menü',
```

In `src/i18n/en.ts`, add after the `'nav.documents'` line:

```ts
  'nav.menu': 'Menu',
```

- [ ] **Step 5: Add a `navLinks` array to the Base.astro frontmatter**

In `src/layouts/Base.astro`, inside the frontmatter (`---` block), after the
`const altHref = ...` line, add:

```ts
const navLinks = [
  { href: lang === 'en' ? '/en' : '/', label: t('nav.home') },
  { href: lang === 'en' ? '/en/ueber-uns' : '/ueber-uns', label: t('nav.about') },
  { href: lang === 'en' ? '/en/mitgliedschaft' : '/mitgliedschaft', label: t('nav.membership') },
  { href: lang === 'en' ? '/en/dokumente' : '/dokumente', label: t('nav.documents') },
]
```

- [ ] **Step 6: Replace the header markup with the responsive nav**

In `src/layouts/Base.astro`, replace the entire `<header>...</header>` block with:

```astro
    <header class="bg-navy text-white">
      <nav class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href={lang === 'en' ? '/en' : '/'} class="flex items-center gap-3">
          <img src="/logo.jpeg" alt="Aquis Mana" class="h-10 w-10 rounded-full" />
          <span class="font-bold text-lg tracking-wide">Aquis Mana</span>
        </a>
        <ul class="hidden md:flex gap-6 text-sm font-medium items-center">
          {navLinks.map((l) => (
            <li><a href={l.href} class="hover:text-blue-accent transition-colors">{l.label}</a></li>
          ))}
          <li><a href={altHref} class="text-blue-accent hover:underline text-xs uppercase tracking-wider">{altLang.toUpperCase()}</a></li>
        </ul>
        <button
          id="menu-toggle"
          class="md:hidden inline-flex items-center justify-center p-2 -mr-2 text-white"
          aria-label={t('nav.menu')}
          aria-controls="mobile-menu"
          aria-expanded="false"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </nav>
      <div id="mobile-menu" class="hidden md:hidden bg-navy">
        <ul class="max-w-5xl mx-auto px-4 pb-4 flex flex-col gap-3 text-sm font-medium">
          {navLinks.map((l) => (
            <li><a href={l.href} class="block hover:text-blue-accent transition-colors">{l.label}</a></li>
          ))}
          <li><a href={altHref} class="block text-blue-accent hover:underline text-xs uppercase tracking-wider">{altLang.toUpperCase()}</a></li>
        </ul>
      </div>
    </header>
```

- [ ] **Step 7: Add the toggle script**

In `src/layouts/Base.astro`, immediately before the closing `</body>` tag, add:

```astro
    <script is:inline>
      (function () {
        const toggle = document.getElementById('menu-toggle')
        const menu = document.getElementById('mobile-menu')
        if (!toggle || !menu) return
        toggle.addEventListener('click', function () {
          const open = menu.classList.toggle('hidden') === false
          toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
        })
        menu.querySelectorAll('a').forEach(function (a) {
          a.addEventListener('click', function () {
            menu.classList.add('hidden')
            toggle.setAttribute('aria-expanded', 'false')
          })
        })
      })()
    </script>
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx playwright test responsive`
Expected: PASS — all three tests green.

- [ ] **Step 9: Commit**

```bash
git add src/i18n/de.ts src/i18n/en.ts src/layouts/Base.astro tests/e2e/responsive.spec.ts
git commit -m "feat(responsive): add mobile hamburger navigation"
```

---

### Task 2: Membership table horizontal-scroll wrapper

**Files:**
- Modify: `src/pages/mitgliedschaft.astro`
- Test: `tests/e2e/responsive.spec.ts` (extend)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Add the failing e2e test**

In `tests/e2e/responsive.spec.ts`, add this test inside the
`test.describe('responsive layout', ...)` block:

```ts
  test('mobile: membership page has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/mitgliedschaft')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
```

- [ ] **Step 2: Run it (may already pass or fail depending on content width)**

Run: `npx playwright test responsive -g "membership"`
Expected: Record the result. If the table currently overflows at 375px it FAILS; if it happens not to, the test still guards against regressions. Proceed regardless.

- [ ] **Step 3: Wrap the table in an overflow container**

In `src/pages/mitgliedschaft.astro`, change the table opening from:

```astro
    <table class="w-full border-collapse mb-8 text-sm">
```

to:

```astro
    <div class="overflow-x-auto mb-8">
      <table class="w-full border-collapse text-sm">
```

And change the matching table close from:

```astro
    </table>
```

to:

```astro
      </table>
    </div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test responsive -g "membership"`
Expected: PASS — no horizontal overflow at 375px.

- [ ] **Step 5: Commit**

```bash
git add src/pages/mitgliedschaft.astro tests/e2e/responsive.spec.ts
git commit -m "fix(responsive): make membership table scroll horizontally on mobile"
```

---

### Task 3: Footer stacking and responsive headings

**Files:**
- Modify: `src/layouts/Base.astro` (footer)
- Modify: `src/pages/dokumente.astro`, `src/pages/ueber-uns.astro`, `src/pages/mitgliedschaft.astro`
- Modify: `src/pages/en/dokumente.astro`, `src/pages/en/ueber-uns.astro`, `src/pages/en/mitgliedschaft.astro`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Stack the footer on narrow screens**

In `src/layouts/Base.astro`, change the footer inner div from:

```astro
      <div class="max-w-5xl mx-auto px-4 py-6 flex justify-between items-center">
```

to:

```astro
      <div class="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
```

- [ ] **Step 2: Scale the page headings down on mobile**

Make each `h1` step down on mobile. Apply these exact replacements (each string is
unique within its file):

`src/pages/dokumente.astro`:
```astro
    <h1 class="text-3xl font-bold text-navy mb-8">{t('documents.heading')}</h1>
```
→
```astro
    <h1 class="text-2xl sm:text-3xl font-bold text-navy mb-8">{t('documents.heading')}</h1>
```

`src/pages/ueber-uns.astro`:
```astro
    <h1 class="text-3xl font-bold text-navy mb-6">{t('about.heading')}</h1>
```
→
```astro
    <h1 class="text-2xl sm:text-3xl font-bold text-navy mb-6">{t('about.heading')}</h1>
```

`src/pages/mitgliedschaft.astro`:
```astro
    <h1 class="text-3xl font-bold text-navy mb-8">{t('membership.heading')}</h1>
```
→
```astro
    <h1 class="text-2xl sm:text-3xl font-bold text-navy mb-8">{t('membership.heading')}</h1>
```

`src/pages/en/dokumente.astro`:
```astro
    <h1 class="text-3xl font-bold text-navy mb-6">{t('documents.heading')}</h1>
```
→
```astro
    <h1 class="text-2xl sm:text-3xl font-bold text-navy mb-6">{t('documents.heading')}</h1>
```

`src/pages/en/ueber-uns.astro`:
```astro
    <h1 class="text-3xl font-bold text-navy mb-6">{t('about.heading')}</h1>
```
→
```astro
    <h1 class="text-2xl sm:text-3xl font-bold text-navy mb-6">{t('about.heading')}</h1>
```

`src/pages/en/mitgliedschaft.astro`:
```astro
    <h1 class="text-3xl font-bold text-navy mb-6">{t('membership.heading')}</h1>
```
→
```astro
    <h1 class="text-2xl sm:text-3xl font-bold text-navy mb-6">{t('membership.heading')}</h1>
```

- [ ] **Step 3: Verify the build succeeds**

Run: `npm run build`
Expected: `astro build` completes with no errors.

- [ ] **Step 4: Verify the responsive suite still passes**

Run: `npx playwright test responsive`
Expected: PASS — all responsive tests (nav + both overflow checks) green; the footer/heading changes introduce no horizontal overflow.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/Base.astro src/pages/dokumente.astro src/pages/ueber-uns.astro src/pages/mitgliedschaft.astro src/pages/en/dokumente.astro src/pages/en/ueber-uns.astro src/pages/en/mitgliedschaft.astro
git commit -m "feat(responsive): stack footer and scale headings on mobile"
```

---

## Self-Review

**Spec coverage:**
- Hamburger nav (desktop unchanged, mobile toggle, a11y, closes on link click) → Task 1. ✓
- `nav.menu` i18n key in de + en → Task 1. ✓
- Membership table `overflow-x-auto` (DE only; EN is a stub) → Task 2. ✓
- Footer stacking → Task 3. ✓
- `h1` `text-2xl sm:text-3xl` across the 6 content pages → Task 3. ✓
- Event grid / RSVP modal unchanged → no task (correct). ✓
- Verification: `astro build` + Playwright at 375 and 1280 → Tasks 1–3. ✓

**Placeholder scan:** No TBD/vague steps; every code step shows full code; exact file paths and commands throughout. ✓

**Type consistency:** `navLinks` is `{ href, label }[]` defined and consumed only in Task 1's Base.astro. DOM ids `#menu-toggle`/`#mobile-menu` are consistent between the markup (Step 6), script (Step 7), and tests (Task 1 Step 2). The no-overflow assertion (`scrollWidth - innerWidth <= 1`) is identical across Tasks 1–2. ✓
