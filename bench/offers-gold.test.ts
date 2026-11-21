import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { it } from "vitest"
import { parseOfferText } from "@/lib/ai/parse-offer"
import { applyChannels, detectApply } from "@/lib/jobs/apply"
import { fold } from "@/lib/keywords/normalize"
import { cleanOfferText } from "@/lib/offer/clean"
import { refineIdentity } from "@/lib/offer/identity"
import type { Offer } from "@/lib/schemas/offer"

/**
 * Conjunto de prueba del analizador de ofertas (A4): publicaciones con la respuesta esperada (bench/gold/offers.json), contra el Ollama REAL.
 * Por cada caso se corre el pipeline completo (limpieza + estructura) UNA vez por repetición y se mide DOS veces sobre esa misma salida del modelo:
 * sin conciliar y conciliando las listas con los bloques del texto. Así la diferencia es solo la conciliación, no el azar del modelo.
 * Métricas: cargo, empresa, recall de cada lista, intrusos (líneas que NO deben estar en ninguna lista) y vías de postulación.
 * Escribe docs/bench-offers.json. Ejecutar: pnpm exec vitest run --config vitest.bench.config.mts bench/offers-gold.test.ts
 */
type Expect = { title: string | null; titleSource: string; company: string | null; requirements: string[]; responsibilities: string[]; niceToHave: string[]; mustNot: string[]; email?: string; form?: boolean }
type Case = { id: string; nota: string; text?: string; file?: string; expect: Expect }
const cases = JSON.parse(readFileSync(path.join(__dirname, "gold/offers.json"), "utf8")) as Case[]
const RUNS = Number(process.env.BENCH_RUNS ?? 2)

const norm = (s: string) => fold(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim()
const has = (list: string[], want: string) => list.some((x) => norm(x).includes(norm(want)))

function score(c: Case, offer: Offer, text: string) {
  const e = c.expect
  const id = refineIdentity(offer, text)
  const titleOk = e.title ? norm(id.title) === norm(e.title) && id.titleSource === e.titleSource : id.titleSource !== "texto"
  const companyOk = e.company ? !!id.company && norm(id.company).includes(norm(e.company)) : !id.company
  const rec = (list: string[], want: string[]) => want.filter((w) => has(list, w)).length
  const wantTotal = e.requirements.length + e.responsibilities.length + e.niceToHave.length
  const got = rec(offer.requirements, e.requirements) + rec(offer.responsibilities, e.responsibilities) + rec(offer.niceToHave, e.niceToHave)
  const all = [...offer.requirements, ...offer.responsibilities, ...offer.niceToHave]
  const leaks = e.mustNot.filter((m) => has(all, m))
  const intruders = leaks.length
  const channels = applyChannels(detectApply({ sourceUrl: "texto:x", text }))
  const emailOk = e.email ? channels.some((ch) => ch.email === e.email) : true
  const formOk = e.form ? channels.some((ch) => ch.method === "formulario") : true
  return { titleOk, companyOk, wantTotal, got, intruders, leaks, mustNot: e.mustNot.length, applyOk: emailOk && formOk }
}

it("conjunto de prueba del analizador de ofertas", async () => {
  // «sin» = limpieza como antes de A5 (el modelo decide todas las líneas); «con» = limpieza conservadora (líneas propias de la oferta protegidas).
  type Row = { id: string; run: number; mode: "sin" | "con"; ms: number; llm: boolean; titleOk: boolean; companyOk: boolean; got: number; wantTotal: number; intruders: number; leaks: string[]; mustNot: number; applyOk: boolean }
  const rows: Row[] = []
  for (const c of cases) {
    const text = c.text ?? readFileSync(path.join(__dirname, "../tests/fixtures", c.file!), "utf8")
    for (let run = 1; run <= RUNS; run++) {
      for (const mode of ["sin", "con"] as const) {
        const t0 = Date.now()
        const cleaned = await cleanOfferText(text, { protect: mode === "con" })
        const parsed = await parseOfferText(cleaned.text, undefined)
        rows.push({ id: c.id, run, mode, ms: Date.now() - t0, llm: cleaned.llm, ...score(c, parsed.data, text) })
      }
    }
  }
  const sum = (mode: "sin" | "con") => {
    const r = rows.filter((x) => x.mode === mode)
    const n = r.length
    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 100)
    return {
      mode,
      muestras: n,
      cargo: pct(r.filter((x) => x.titleOk).length, n),
      empresa: pct(r.filter((x) => x.companyOk).length, n),
      recallListas: pct(r.reduce((a, x) => a + x.got, 0), r.reduce((a, x) => a + x.wantTotal, 0)),
      intrusos: r.reduce((a, x) => a + x.intruders, 0),
      intrusosPosibles: r.reduce((a, x) => a + x.mustNot, 0),
      postulacion: pct(r.filter((x) => x.applyOk).length, n),
      msMedio: Math.round(r.reduce((a, x) => a + x.ms, 0) / n),
      sinLlamarAlModelo: r.filter((x) => !x.llm).length,
    }
  }
  const summary = { fecha: new Date().toISOString().slice(0, 10), modelo: process.env.OLLAMA_MODEL, repeticiones: RUNS, casos: cases.length, sin: sum("sin"), con: sum("con"), filas: rows }
  writeFileSync(path.join(__dirname, "../docs/bench-offers.json"), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ sin: summary.sin, con: summary.con }, null, 1))
})
