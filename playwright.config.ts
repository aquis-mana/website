import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:4321',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
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
})
