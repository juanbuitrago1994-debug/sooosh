// Utilidades compartidas por `pnpm shots` y `pnpm a11y`.
// Usan el servidor de desarrollo de Juan (pnpm dev, puerto 3000). Nunca inician servidores.
export const BASE = process.env.BASE_URL ?? "http://localhost:3000"

export async function ensureServer() {
  let ok = false
  try { ok = (await fetch(BASE)).ok } catch {}
  if (!ok) {
    console.error(`No responde ${BASE}. Arranca el servidor de desarrollo (pnpm dev) y vuelve a intentar. Este script no inicia servidores.`)
    process.exit(2)
  }
}

// Datos de ejemplo (ficticios). Ollama se simula SOLO aquí; /api/export y el historial son reales.
export const SAMPLE_CV = {
  header: { fullName: "Ana Ejemplo", headline: "Desarrolladora de software", email: "ana@ejemplo.com", phone: "+00 000 000 000", location: "Ciudad", links: [{ label: "GitHub", url: "github.com/ana-ejemplo" }] },
  summary: "Texto de ejemplo para las capturas.",
  experience: [{ company: "Empresa Ejemplo", role: "Desarrolladora", startDate: "2020", endDate: "Actual", bullets: ["Armé tableros de ventas en Excel.", "Redacté informes semanales para el equipo comercial."] }],
  education: [{ institution: "Universidad Ejemplo", degree: "Ingeniería", startDate: "2015", endDate: "2019", details: [] }],
  skills: [{ category: "Lenguajes", items: ["TypeScript", "Python", "SQL"] }],
  languages: [{ name: "Español", level: "Nativo" }],
  projects: [],
}
export const SAMPLE_OFFER = {
  title: "Analista de Datos Junior",
  company: "Empresa Ejemplo",
  language: "es",
  requirements: ["Dominio de Excel y SQL", "Capacidad de comunicar resultados a equipos no técnicos"],
  niceToHave: ["Power BI o Tableau"],
  responsibilities: ["Preparar reportes semanales de ventas", "Mantener tableros y consultas existentes"],
}
export const LONG = "Empresa Ejemplo busca una persona analista de datos para el área comercial. Requisitos: dominio de Excel y SQL, capacidad de comunicar resultados a equipos no técnicos. Se valora Power BI o Tableau. Responsabilidades: preparar reportes semanales de ventas y mantener tableros y consultas existentes."

export const SAMPLE_DIAGNOSIS = {
  language: "es",
  sections: [
    { kind: "summary", title: "Resumen", order: 0 },
    { kind: "experience", title: "Experiencia", order: 1 },
    { kind: "education", title: "Educación", order: 2 },
    { kind: "skills", title: "Habilidades", order: 3 },
    { kind: "languages", title: "Idiomas", order: 4 },
  ],
  style: { tone: "neutro", person: "primera", tenses: "pasado", bullets: "viñetas", metrics: { bulletsTotal: 2, bulletsWithMetrics: 0, ratio: 0 }, avgBulletWords: 7 },
  seniority: { label: "junior", years: 2, basis: "2020 – Actual en un puesto" },
  strengths: [{ text: "Experiencia con tableros de ventas", evidence: "Armé tableros de ventas en Excel." }],
  problems: [{ kind: "sin-cuantificar", text: "Ninguna viñeta incluye cifras", evidence: "Redacté informes semanales para el equipo comercial." }],
  atsRisks: [],
  confidence: { name: "alta", contact: "alta", experience: "alta", education: "alta", language: "alta" },
  question: null,
}

const term = (id, text, kind, weight) => ({ id, text, kind, weight })
const ev = (id, section, text) => ({ id, section, text })
const T = {
  excel: { term: term("t1", "Dominio de Excel y SQL", "requirement", 3), status: "cubierto", score: 1, how: "lexico", evidence: [ev("u1", "Experiencia", "Armé tableros de ventas en Excel.")], explanation: "Tu CV lo dice con las mismas palabras." },
  comunicar: { term: term("t2", "Capacidad de comunicar resultados a equipos no técnicos", "requirement", 3), status: "reformulable", score: 0.7, how: "semantico", evidence: [ev("u2", "Experiencia", "Redacté informes semanales para el equipo comercial.")], explanation: "Hay evidencia relacionada; se puede decir con las palabras de la oferta." },
  powerbi: { term: term("t3", "Power BI o Tableau", "niceToHave", 2), status: "ausente", score: 0.2, how: "ninguno", evidence: [], explanation: "No aparece en tu CV." },
  reportes: { term: term("t4", "Preparar reportes semanales de ventas", "responsibility", 1), status: "otro-nombre", score: 0.8, how: "semantico", evidence: [ev("u2", "Experiencia", "Redacté informes semanales para el equipo comercial.")], explanation: "Lo dices con otras palabras: «informes» por «reportes»." },
}
export const SAMPLE_MATCH = {
  coverage: 63,
  terms: Object.values(T),
  groups: { fit: [T.excel, T.reportes], reformulable: [T.comunicar], gaps: [T.powerbi] },
  method: "semantico",
  model: "bge-m3",
  warnings: [],
  timings: {},
}

const ndjson = (events) => events.map((e) => JSON.stringify(e)).join("\n") + "\n"

/**
 * Simula SOLO lo que depende de Ollama (lectura del CV, oferta, comparación, reescritura) y lo que escribiría en tu base local
 * (memoria de preferencias) o cargaría el modelo (precarga). /api/export (PDF) y el historial (localStorage) son reales.
 * state.rewriteMode: "error" | "slow" | "ok"; state.delay: ms de retraso de la lectura de CV, la oferta y la comparación
 * (para capturar «IA trabajando»).
 */
export async function mockApi(page, state) {
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms))
  await page.route("**/api/warmup", (r) => r.fulfill({ json: { ok: true } }))
  await page.route("**/api/cv/parse", async (r) => {
    if (state.delay) await wait(state.delay)
    // El servidor real emite una línea NDJSON por etapa y al final el resultado.
    const body = ndjson([
      ...[0, 1, 2, 3, 4, 5].map((i) => ({ t: "stage", i })),
      { t: "result", cv: SAMPLE_CV, diagnosis: SAMPLE_DIAGNOSIS, sourceText: "Ana Ejemplo\nDesarrolladora de software\nArmé tableros de ventas en Excel.\nRedacté informes semanales para el equipo comercial.", meta: { method: "text", pipeline: "estructurado", extractMs: 1, totalMs: 2000, timings: {}, llmCalls: 1, truncated: false } },
    ])
    return r.fulfill({ status: 200, contentType: "application/x-ndjson", body })
  })
  await page.route("**/api/offer", async (r) => {
    const b = r.request().postDataJSON()
    if (!b.url && state.delay) await wait(state.delay)
    if (b.url) return r.fulfill({ status: 422, json: { error: "Ese sitio no deja leer la oferta sin iniciar sesión. Copia el texto de la oferta y pégalo en la pestaña «Pegar texto»." } })
    return r.fulfill({ json: { offer: SAMPLE_OFFER, text: b.text, dropped: [], meta: {}, cleaning: { removed: 0, llm: true } } })
  })
  await page.route("**/api/match", async (r) => {
    if (state.delay) await wait(state.delay)
    return r.fulfill({ json: SAMPLE_MATCH })
  })
  await page.route("**/api/rewrite", async (r) => {
    const b = r.request().postDataJSON()
    if (state.rewriteMode === "error") {
      return r.fulfill({ status: 503, json: { error: "No se pudo conectar con Ollama en http://localhost:11434. ¿Está corriendo (ollama serve)?", code: "unreachable" } })
    }
    if (state.rewriteMode === "slow") await wait(2500)
    const items =
      b.group === "summary"
        ? [{ id: "summary", label: "Resumen", original: b.cv.summary, proposed: "Texto de ejemplo, orientado a las capturas de la oferta.", status: "changed", kind: "cambiar", section: "Resumen", reason: "Acerca el resumen al puesto usando tus propias palabras.", evidence: [b.cv.summary], risk: "bajo" }]
        : [
            { id: "exp.0.0", label: "Desarrolladora · Empresa Ejemplo — viñeta 1", original: b.cv.experience[0].bullets[0], proposed: "Construí tableros de ventas en Excel.", status: "changed", kind: "cambiar", section: "Experiencia", reason: "«Construí» describe mejor el resultado que «Armé».", evidence: [b.cv.experience[0].bullets[0]], risk: "medio" },
            { id: "exp.0.1", label: "Desarrolladora · Empresa Ejemplo — viñeta 2", original: b.cv.experience[0].bullets[1], proposed: b.cv.experience[0].bullets[1], status: "kept", reasons: ["La cifra «60» no aparece en tu CV."] },
          ]
    return r.fulfill({ json: { items } })
  })
  await page.route("**/api/cv/profile", (r) => r.fulfill({ json: { ok: true } }))
  // Memoria de preferencias: simulada para que las pruebas no escriban en data/learning.db.
  await page.route("**/api/learning**", (r) => {
    if (r.request().method() === "GET") {
      return r.fulfill({ json: { rules: [{ id: 1, text: "Viñetas de máximo dos líneas", source: "manual", enabled: true }], stats: { total: 12, accepted: 7, rejected: 3, edited: 2, sinceSummary: 2 }, every: 10 } })
    }
    return r.fulfill({ json: { ok: true } })
  })
}

/** Abre el historial (diálogo) desde el icono de la cabecera. */
export async function openHistory(page) {
  await page.getByRole("button", { name: /^Historial/ }).click()
  await page.getByRole("dialog").waitFor()
  await page.waitForTimeout(450)
}

export async function closeDialog(page) {
  await page.keyboard.press("Escape")
  await page.getByRole("dialog").waitFor({ state: "detached" })
}

/** Transformación (translate) de la mancha de luz del aura: cambia con el tiempo si deriva. null si no hay aura. */
export const auraDrift = (page) => page.evaluate(() => { const e = document.querySelector("[data-ai-drift]"); return e ? getComputedStyle(e).transform : null })
export const hasAura = (page) => page.evaluate(() => !!document.querySelector("[data-ai-aura]"))

export async function noToast(page) {
  await page.locator("[data-sonner-toast]").first().waitFor({ state: "detached", timeout: 9000 }).catch(() => {})
}

export const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)

/** Oculta el indicador de `next dev` (no existe en producción): intercepta clics y foco en las pruebas. */
export async function hideDevOverlay(ctx) {
  await ctx.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const st = document.createElement("style")
      st.textContent = "nextjs-portal{display:none!important}"
      document.head.append(st)
    })
  })
}
