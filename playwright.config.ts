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
  // Tests in one file run side by side too, not one after another.
  fullyParallel: true,
  // CI runs one job per viewport (PW_BLOB); each writes a blob report, and the
  // `e2e` job merges them into one HTML report.
  reporter: process.env.PW_BLOB ? [["list"], ["blob"]] : process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // 127.0.0.1, not localhost: "localhost" can resolve to IPv6 on one side and
  // IPv4 on the other, and the readiness check then never connects.
  // A failed test keeps a trace (frame-by-frame timeline: npx playwright
  // show-trace) and a video, which is how a brief glitch during load is diagnosed.
  use: { baseURL: "http://127.0.0.1:4321", trace: "retain-on-failure", video: "retain-on-failure" },
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
