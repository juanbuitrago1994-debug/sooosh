import { writeFileSync } from "node:fs"
import path from "node:path"
import { it } from "vitest"
import { z } from "zod"
import { getProvider } from "@/lib/ai"
import { bodyPrompt, corpusOf, focusesFor, isGroundedMiddle, neutralize, ungroundedTerms, type BodyInput } from "@/lib/apply/body-ai"
import { DEFAULT_SETTINGS, TONES } from "@/lib/apply/body-settings"
import { styleIssues } from "@/lib/apply/guidelines"

/**
 * Efecto de la guía de redacción (docs/CONOCIMIENTO-UX-CONTENT.md) en las propuestas del cuerpo del correo, contra el Ollama REAL.
 * Para cada tono × ángulo × repetición se pide el párrafo central SIN guía y CON guía (mismo caso, mismos ajustes) y se mide tiempo y qué
 * porcentaje pasa (a) el verificador de datos de antes y (b) el verificador completo (datos + estilo). Son métricas por reglas: no miden
 * si el texto «suena mejor»; los textos quedan en docs/bench-email-body.json para leerlos.
 * Ejecutar: BENCH_RUNS=2 pnpm exec vitest run --config vitest.bench.config.mts bench/email-guide.test.ts
 */
const RUNS = Number(process.env.BENCH_RUNS ?? 2)
const VARIANTS: (boolean | "min")[] = process.env.BENCH_VARIANTS ? (process.env.BENCH_VARIANTS.split(",").map((v) => (v === "min" ? "min" : v === "full")) as (boolean | "min")[]) : [false, true]
const input: BodyInput = {
  title: "Diseñador/a UX/UI",
  company: "Vos Consultora",
  requirements: ["Experiencia comprobable en diseño de interfaces (UI) e investigación de experiencia de usuario (UX)", "Dominio de Figma y sistemas de diseño (Design Systems)", "Trabajo en equipo junto a desarrolladores y áreas de producto"],
  covered: ["Figma", "Design Systems"],
  facts: { headline: "Diseñadora UX/UI", skills: ["Figma", "Design Systems", "Investigación de usuarios", "Prototipado"], roles: [{ role: "Diseñadora de producto", company: "Estudio Alfa" }, { role: "Diseñadora UI", company: "Beta Digital" }], languages: ["Español", "Inglés"] },
  lang: "es",
}
const schema = z.object({ text: z.string().min(1).max(1800) })
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0)

type Sample = { tone: string; angle: number; run: number; guide: boolean | "min"; ms: number; text: string | null; words: number; groundedOld: boolean; groundedFull: boolean; issues: string[]; ungrounded: string[] }

it("guía de redacción: sin guía vs con guía", async () => {
  const provider = getProvider({ temperature: 0.9 })
  await provider.generateStructured({ system: 'Responde {"text":"ok"}', user: "ok", schema, options: { numPredict: 10 } }).catch(() => null) // calentar el modelo
  const samples: Sample[] = []
  for (const tone of TONES) {
    const settings = { ...DEFAULT_SETTINGS, ...tone.settings, focus: "variado" as const }
    for (let run = 0; run < RUNS; run++) {
      for (const [angle, focus] of focusesFor("variado").entries()) {
        for (const guide of VARIANTS) {
          const { system, user } = bodyPrompt(input, settings, [], focus, angle, { guide })
          const t0 = Date.now()
          let text: string | null = null
          try {
            const { data } = await provider.generateStructured({ system, user, schema, options: { numPredict: 420 } })
            text = neutralize(data.text.trim())
          } catch {
            /* sin respuesta */
          }
          const ms = Date.now() - t0
          samples.push({
            tone: tone.value, angle, run, guide, ms, text,
            words: text ? text.split(/\s+/).filter(Boolean).length : 0,
            groundedOld: !!text && isGroundedMiddle(text, input, settings.length, false),
            groundedFull: !!text && isGroundedMiddle(text, input, settings.length, true),
            issues: text ? styleIssues(text, "es") : ["sin respuesta"],
            ungrounded: text ? ungroundedTerms(text, corpusOf(input)) : [],
          })
        }
      }
    }
  }
  const summary = VARIANTS.map((guide) => {
    const xs = samples.filter((s) => s.guide === guide)
    const pct = (f: (s: Sample) => boolean) => Math.round((100 * xs.filter(f).length) / xs.length)
    const issues: Record<string, number> = {}
    for (const s of xs) for (const i of s.issues) issues[i] = (issues[i] ?? 0) + 1
    return {
      guide, n: xs.length, medianMs: median(xs.map((s) => s.ms)), meanMs: Math.round(xs.reduce((a, s) => a + s.ms, 0) / xs.length), meanWords: Math.round(xs.reduce((a, s) => a + s.words, 0) / xs.length),
      passDataPct: pct((s) => s.groundedOld), passFullPct: pct((s) => s.groundedFull), withUngroundedPct: pct((s) => s.ungrounded.length > 0), issues,
    }
  })
  writeFileSync(path.join(__dirname, process.env.BENCH_OUT ?? "../docs/bench-email-body.json"), JSON.stringify({ at: new Date().toISOString(), runs: RUNS, summary, samples }, null, 1))
  console.log(JSON.stringify(summary, null, 1))
})
