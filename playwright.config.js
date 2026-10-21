import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3100" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run e2e:serve",
    url: "http://localhost:3100",
    timeout: 240_000,
    reuseExistingServer: false,
    env: { TURSO_DATABASE_URL: "file:e2e.db", TURSO_AUTH_TOKEN: "", NEXT_PUBLIC_SITE_URL: "http://localhost:3100" },
  },
});
