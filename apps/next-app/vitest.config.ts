import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: [],
    globals: true,
    restoreMocks: true,
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": resolve(rootDir, "."),
    },
  },
});
