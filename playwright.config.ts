import { defineConfig } from "@playwright/test";

const viewports = [
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
];

export default defineConfig({
  testDir: "e2e",
  // Visual baselines are made only in the Playwright container (Linux), so no
  // platform suffix: a baseline from another OS is never valid here.
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // 127.0.0.1, not localhost: "localhost" can resolve to IPv6 on one side and
  // IPv4 on the other, and the readiness check then never connects.
  use: { baseURL: "http://127.0.0.1:4321" },
  projects: viewports.map(({ name, width, height }) => ({
    name,
    use: { browserName: "chromium", viewport: { width, height } },
  })),
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4321",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: !process.env.CI,
  },
});
