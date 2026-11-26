import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // `server-only` lo resuelve Next al compilar; en las pruebas se sustituye por un módulo vacío.
  resolve: { alias: { "@": path.resolve(__dirname), "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") } },
  test: { testTimeout: 30_000, hookTimeout: 30_000, environment: "node", include: ["tests/**/*.test.{ts,tsx}"], env: { RESULT_CACHE: "off", LEARNING_DB_URL: ":memory:" } },
})
