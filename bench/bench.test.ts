import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { it } from "vitest"
import { parseOfferText } from "@/lib/ai/parse-offer"
import { runCvPipeline } from "@/lib/cv/pipeline"
import { extractOffer } from "@/lib/offer/extract"
import { cleanOfferText } from "@/lib/offer/clean"
import { existsInSource } from "@/lib/offer/guard"

/**
 * Banco de pruebas: 3 CVs + 3 ofertas × cada modelo (BENCH_MODELS="a,b,c"), contra el Ollama real de OLLAMA_URL.
 * Calidad (0–1) = esquema válido (la llamada no falla) + guardia anti-invención (todo lo extraído existe en la fuente).
 * Escribe docs/bench-results.json; `pnpm bench` también regenera la tabla de docs/BENCHMARKS.md (sección automática).
 */
const fx = (f: string) => readFileSync(path.join(__dirname, "../tests/fixtures", f), "utf8")
const CVS = ["cv-tipico.txt", "cv-english.txt", "cv-sin-secciones.txt"]
const OFFERS: { name: string; load: () => string }[] = [
  { name: "texto.txt (limpia)", load: () => fx("offers/texto.txt") },
  { name: "linkedin-post-hilo (con ruido)", load: () => fx("offers/linkedin-post-hilo.txt") },
  { name: "main.html (página web)", load: () => extractOffer(fx("offers/main.html"))?.text ?? "" },
]
const MODELS = (process.env.BENCH_MODELS ?? "qwen2.5:7b-instruct,gemma4:e4b,qwen3.5:9b").split(",").map((s) => s.trim()).filter(Boolean)
const URL_ = (process.env.OLLAMA_URL ?? "").replace(/\/$/, "")

type Row = { model: string; task: string; input: string; ms: number; quality: number; detail: string; llmCalls?: number; firstMs?: number }

async function ps() {
  try {
    const j = (await (await fetch(`${URL_}/api/ps`)).json()) as { models: { name: string; size: number; size_vram: number; context_length?: number }[] }
    return j.models.map((m) => `${m.name} · ${(m.size / 1e9).toFixed(1)} GB · ${m.size_vram >= m.size ? "100% GPU" : `${Math.round((m.size_vram / m.size) * 100)}% GPU`} · ctx ${m.context_length ?? "?"}`).join("; ")
  } catch {
    return "n/d"
  }
}

it("banco de pruebas", async () => {
  const rows: Row[] = []
  const psByModel: Record<string, string> = {}
  for (const model of MODELS) {
    process.env.OLLAMA_MODEL = model
    // calentamiento (carga del modelo): se mide aparte para que el primer caso no la cargue
    const w0 = Date.now()
    await fetch(`${URL_}/api/generate`, { method: "POST", body: JSON.stringify({ model, prompt: "", keep_alive: "60m", options: { num_ctx: 8192 } }) })
    const loadMs = Date.now() - w0
    console.log(`\n== ${model} (carga ${loadMs} ms)`)
    for (const f of CVS) {
      const text = fx(f)
      const t0 = Date.now()
      try {
        const r = await runCvPipeline(text, { now: new Date("2026-11-17") })
        const ev = r.diagnosis.strengths.map((s) => s.evidence)
        const grounded = ev.filter((e) => existsInSource(e, text).ok).length
        const checks = [!!r.cv.header.fullName, r.cv.experience.length > 0, ev.length === 0 || grounded === ev.length]
        rows.push({ model, task: "CV", input: f, ms: Date.now() - t0, quality: checks.filter(Boolean).length / checks.length, detail: `${r.method}, ${r.llmCalls} llamadas LLM, ${r.cv.experience.length} puestos, fortalezas ancladas ${grounded}/${ev.length}`, llmCalls: r.llmCalls })
      } catch (e) {
        rows.push({ model, task: "CV", input: f, ms: Date.now() - t0, quality: 0, detail: `FALLÓ: ${(e as Error).message.slice(0, 80)}` })
      }
      console.log(rows[rows.length - 1])
    }
    for (const o of OFFERS) {
      const raw = o.load()
      const t0 = Date.now()
      try {
        const cleaned = await cleanOfferText(raw)
        const tClean = Date.now() - t0
        const r = await parseOfferText(cleaned.text)
        const items = [...r.data.requirements, ...r.data.niceToHave, ...r.data.responsibilities]
        const grounded = items.filter((x) => existsInSource(x, cleaned.text).ok).length
        const checks = [r.data.title.length > 2, r.data.requirements.length > 0, r.dropped.length === 0, items.length > 0 && grounded === items.length]
        rows.push({ model, task: "Oferta", input: o.name, ms: Date.now() - t0, quality: checks.filter(Boolean).length / checks.length, detail: `limpieza ${tClean} ms + estructura ${r.meta.ms} ms (${r.via}); ${r.data.requirements.length} req, ${r.data.niceToHave.length} des, ${r.data.responsibilities.length} func; descartados ${r.dropped.length}` })
      } catch (e) {
        rows.push({ model, task: "Oferta", input: o.name, ms: Date.now() - t0, quality: 0, detail: `FALLÓ: ${(e as Error).message.slice(0, 80)}` })
      }
      console.log(rows[rows.length - 1])
    }
    psByModel[model] = await ps()
    console.log("ollama ps:", psByModel[model])
    rows.push({ model, task: "Carga", input: "primera carga en memoria", ms: loadMs, quality: 1, detail: "" })
  }
  writeFileSync(path.join(__dirname, "../docs/bench-results.json"), JSON.stringify({ at: new Date().toISOString(), ollamaUrl: "local", models: MODELS, ps: psByModel, rows }, null, 2))
})
