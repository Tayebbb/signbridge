import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["tests/unit/**/*.test.ts", "tests/contract/**/*.test.ts", "tests/race/**/*.test.ts"], testTimeout: 30_000, hookTimeout: 30_000, maxWorkers: 1, fileParallelism: false },
});
