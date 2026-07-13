import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    // The integration test builds and boots the production server.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
