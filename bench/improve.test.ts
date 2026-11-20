import { writeFileSync } from "node:fs"
import path from "node:path"
import { it } from "vitest"
import { regenerateOne } from "@/lib/ai/rewrite-cv"
import { rewriteGroup } from "@/lib/ai/rewrite-cv"
import { improveWeak } from "@/lib/rebuild/improve"
import { cvCorpus } from "@/lib/rewrite/verify"
import { tagItems } from "@/lib/changes/propose"
import { mid, NOW, offer, strong } from "../tests/fixtures/fit-cases"

/**
 * Ciclo de calidad (K6) contra el Ollama REAL: reescribe las viñetas del puesto más reciente de 2 CV de referencia, puntúa cada
 * propuesta y regenera solo las débiles. Registra cuántas eran débiles antes/después, tiempos y llamadas. docs/bench-improve.json.
 */
it("ciclo de calidad de las propuestas", async () => {
  const rows: unknown[] = []
  for (const [name, cv] of [["fuerte", strong], ["medio", mid]] as const) {
    const t0 = Date.now()
    const proposals = tagItems(await rewriteGroup(cv, offer, "exp.0", undefined, cvCorpus(cv)))
    const tGen = Date.now() - t0
    let regenCalls = 0
    const t1 = Date.now()
    const r = await improveWeak({ cv, offer, items: proposals, source: cvCorpus(cv), now: NOW, regenerate: async (it, fb) => (regenCalls++, regenerateOne(cv, offer, it, fb)) })
    rows.push({ cv: name, proposals: proposals.length, changed: proposals.filter((p) => p.status === "changed").length, generationMs: tGen, improveMs: Date.now() - t1, regenCalls, report: r.report, impacts: r.items.map((i) => [i.id, i.status, i.impact?.overall ?? null]) })
  }
  writeFileSync(path.join(__dirname, "../docs/bench-improve.json"), JSON.stringify({ model: process.env.OLLAMA_MODEL, rows }, null, 2))
})
