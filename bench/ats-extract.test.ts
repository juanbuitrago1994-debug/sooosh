import { readFileSync, writeFileSync } from "node:fs"
import { it } from "vitest"
import { getProvider } from "@/lib/ai"
import { extractExtras } from "@/lib/ats/enrich"
import { cvSchema } from "@/lib/schemas/cv"

/**
 * Lectura profunda del CV (A8): tiempo y calidad por MODELO, contra el Ollama REAL y un CV real. El CV es un dato personal: NO está en el repositorio; se pasa por entorno.
 *   BENCH_CV_JSON=/ruta/parsed.json (con `cv` y `sourceText`)  BENCH_MODELS=a,b  BENCH_OUT=/ruta/salida.json
 *   BENCH_GOLD=Ueno,Monchis,Gopass,Alumnus,Iris,Zurich   (empresas que deben salir; las del CV de prueba de Juan)
 * Ejecutar: pnpm exec vitest run --config vitest.bench.config.mts bench/ats-extract.test.ts
 * Métricas por reglas (no miden si «suena mejor»): cuántas empresas esperadas salen, cuántos puestos traen fechas y viñetas, cuántas
 * habilidades y proyectos. Todo texto ya pasó por el anclaje al original, así que no hay inventos que contar.
 */
const file = process.env.BENCH_CV_JSON
const models = (process.env.BENCH_MODELS ?? "").split(",").filter(Boolean)
const gold = (process.env.BENCH_GOLD ?? "").split(",").filter(Boolean).map((g) => g.toLowerCase())

const OLLAMA = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, "")
/** Descarga de la memoria TODO modelo cargado: con 16 GB, dos modelos de 9 GB a la vez hacen que el equipo use el disco y los tiempos dejan de significar algo. */
async function unloadAll() {
  const ps = (await (await fetch(`${OLLAMA}/api/ps`)).json()) as { models?: { name: string }[] }
  for (const m of ps.models ?? []) await fetch(`${OLLAMA}/api/generate`, { method: "POST", body: JSON.stringify({ model: m.name, keep_alive: 0 }) })
  await new Promise((r) => setTimeout(r, 3000))
}

it.skipIf(!file || !models.length)("tiempo y calidad de la lectura profunda por modelo", async () => {
  const p = JSON.parse(readFileSync(file as string, "utf8"))
  const cv = cvSchema.parse(p.cv)
  const out: unknown[] = []
  for (const model of models) {
    {
      await unloadAll()
      const t0 = Date.now()
      const r = await extractExtras(cv, p.sourceText, { provider: getProvider({ model, temperature: 0 }) })
      const ms = Date.now() - t0
      const e = r.extras
      const names = e.roles.map((x) => x.company.toLowerCase())
      const row = {
        model,
        ms,
        reason: r.reason ?? null,
        roles: e.roles.length,
        goldFound: gold.filter((g) => names.some((n) => n.includes(g))).length,
        goldTotal: gold.length,
        withDates: e.roles.filter((x) => x.startDate).length,
        withBullets: e.roles.filter((x) => x.bullets.length).length,
        bullets: e.roles.reduce((s, x) => s + x.bullets.length, 0),
        skillGroups: e.skillGroups.length,
        skillItems: e.skillGroups.reduce((s, g) => s + g.items.length, 0),
        projects: e.projects.length,
        projectsWithText: e.projects.filter((x) => x.description).length,
        certs: e.certifications.length,
      }
      out.push(row)
      console.log("ROW", JSON.stringify(row))
      if (process.env.BENCH_OUT) writeFileSync(process.env.BENCH_OUT, JSON.stringify(out, null, 1))
    }
  }
})
