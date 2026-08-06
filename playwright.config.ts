import { defineConfig, devices } from "@playwright/test";

const APP_PORT = 3101;
// Inngest's default dev-server port. The SDK auto-discovers a dev server
// here when not running in production — do not change this without also
// setting INNGEST_DEV on the app process to point at the new port.
const INNGEST_DEV_PORT = 8288;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  // Two servers: the app, and an Inngest Dev Server to actually execute
  // brandDiscovery (see src/lib/inngest/functions/brand-discovery.ts).
  // Onboarding now returns 202 and polls an Operation — without a worker
  // running, the event would sit unprocessed and every e2e assertion after
  // "Research & create project" would time out.
  webServer: [
    {
      name: "app",
      command: `NEXT_DIST_DIR=.next-e2e E2E_DISCOVERY_FIXTURE=true npm run dev -- --port ${APP_PORT}`,
      url: `http://127.0.0.1:${APP_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      name: "inngest-dev-server",
      command: `npx inngest-cli dev --no-discovery --port ${INNGEST_DEV_PORT} -u http://127.0.0.1:${APP_PORT}/api/inngest`,
      url: `http://127.0.0.1:${INNGEST_DEV_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
