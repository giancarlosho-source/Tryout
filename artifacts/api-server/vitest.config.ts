import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./src/__tests__/global-setup.ts"],
    testTimeout: 15000,
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
