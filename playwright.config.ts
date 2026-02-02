import { defineConfig, devices } from "@playwright/test";

/**
 * E2E Test Configuration
 *
 * Supports two modes:
 * - CI: Runs tests tagged with @ci (fast, essential tests)
 * - Local: Runs all tests including @slow edge cases
 *
 * Tag usage:
 * - No tag: Runs in both CI and local
 * - @slow: Runs only locally (excluded from CI via grep)
 * - Use test.describe.configure({ mode: 'serial' }) for tests that must run in order
 */

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? "github" : "html",

  // In CI, exclude tests tagged @slow
  grep: isCI ? /^(?!.*@slow)/ : undefined,

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },

  projects: [
    // Setup project runs first to prepare test data
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    // Firefox and WebKit only run locally (too slow for CI)
    ...(isCI
      ? []
      : [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
            dependencies: ["setup"],
          },
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
            dependencies: ["setup"],
          },
        ]),
  ],

  // Start both web frontend and API backend
  webServer: [
    {
      command: "VITE_API_URL=http://localhost:8001 npm run dev --workspace=apps/web",
      url: "http://localhost:5173",
      reuseExistingServer: !isCI,
      timeout: 120000,
      env: {
        VITE_API_URL: "http://localhost:8001",
      },
    },
    {
      // Run uvicorn from within the API venv. For local dev, assumes venv is activated.
      // For CI, the workflow installs packages globally.
      command: isCI
        ? "uvicorn city_api.main:app --host 0.0.0.0 --port 8001"
        : "source .venv/bin/activate && uvicorn city_api.main:app --host 0.0.0.0 --port 8001",
      url: "http://localhost:8001/health",
      reuseExistingServer: !isCI,
      cwd: "./apps/api",
      timeout: 120000,
      env: {
        DATABASE_URL:
          process.env.DATABASE_URL ||
          "postgresql+asyncpg://localhost/city_doodle_test",
        DATABASE_URL_SYNC:
          process.env.DATABASE_URL_SYNC ||
          "postgresql://localhost/city_doodle_test",
        AUTH_MODE: "dev",
        PYTHONPATH: "./src",
      },
    },
  ],
});
