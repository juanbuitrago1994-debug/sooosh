import { writeFileSync } from "node:fs"
import path from "node:path"
import { it } from "vitest"
import { computeFit } from "@/lib/analysis/fit"
import { judgeCv } from "@/lib/analysis/judge"
import { mid, NOW, offer, strong, weak } from "../tests/fixtures/fit-cases"

/**
 * Banco del juez local (K4) contra el Ollama REAL: por cada CV de referencia, 3 repeticiones; mide tiempo, estabilidad de veredictos
 * y cuántas citas son literales (las no literales se descartan en computeFit). Escribe docs/bench-fit.json. Resultado resumido en docs/BENCHMARKS.md.
 */
it("juez local de la rúbrica", async () => {
  const rows: unknown[] = []
  for (const [name, cv] of [["fuerte", strong], ["medio", mid], ["débil", weak]] as const) {
    const runs: { ms: number; verdicts: string; judged: number; literal: number; warnings: number; overall: number }[] = []
    for (let i = 0; i < 3; i++) {
      const t = Date.now()
      let judged: Awaited<ReturnType<typeof judgeCv>> = []
      try {
        judged = await judgeCv(cv, offer)
      } catch (e) {
        runs.push({ ms: Date.now() - t, verdicts: `ERROR ${(e as Error).message}`, judged: 0, literal: 0, warnings: 0, overall: 0 })
        continue
      }
      const ms = Date.now() - t
      const r = computeFit(cv, offer, { judged, now: NOW })
      const withQuote = judged.filter((j) => j.evidence)
      runs.push({ ms, verdicts: judged.map((j) => `${j.criterion}:${j.verdict}`).join(" "), judged: judged.length, literal: withQuote.length - r.warnings.length, warnings: r.warnings.length, overall: r.overall })
    }
    rows.push({ cv: name, runs })
  }
  writeFileSync(path.join(__dirname, "../docs/bench-fit.json"), JSON.stringify({ model: process.env.OLLAMA_MODEL, rows }, null, 2))
})
