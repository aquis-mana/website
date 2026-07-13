import { defineConfig } from 'astro/config'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  security: { checkOrigin: false },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Astro inlines small processed <script> tags straight into the HTML as
      // <script type="module">…</script>. Those inline scripts don't carry the
      // per-request CSP nonce our middleware sets, so a nonce-based
      // `script-src` blocks them (this silently broke the RSVP overlay).
      // Force scripts to be emitted as external files instead — they load from
      // the same origin, which `script-src 'self'` already allows. Returning
      // `undefined` for everything else keeps Astro's default inlining for CSS
      // and other assets.
      assetsInlineLimit: (filePath) =>
        filePath.endsWith('.js') ? false : undefined,
    },
  },
  i18n: {
    defaultLocale: 'de',
    locales: ['de', 'en'],
    routing: { prefixDefaultLocale: false },
  },
})
