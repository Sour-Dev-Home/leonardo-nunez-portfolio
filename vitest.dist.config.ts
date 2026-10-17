import { defineConfig } from "vitest/config";

// Tests over the built site in dist/. Run after `npm run build`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/dist/**/*.test.ts"],
  },
});
