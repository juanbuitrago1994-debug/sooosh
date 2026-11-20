import { readFileSync } from "node:fs"
import path from "node:path"
import { defineConfig } from "vitest/config"

/** `pnpm bench`: banco de pruebas contra el Ollama REAL (no simulado). Ver bench/bench.test.ts y docs/BENCHMARKS.md. */
const local: Record<string, string> = {}
try {
  for (const line of readFileSync(path.join(__dirname, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m) local[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
} catch {}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["bench/**/*.test.ts"],
    testTimeout: 60 * 60_000,
    hookTimeout: 60 * 60_000,
    env: { OLLAMA_URL: local.OLLAMA_URL ?? "", OLLAMA_MODEL: local.OLLAMA_MODEL ?? "", RESULT_CACHE: "off", LEARNING_DB_URL: ":memory:" },
  },
})
