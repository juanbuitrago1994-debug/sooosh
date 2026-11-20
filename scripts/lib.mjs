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

/** state.rewriteMode: "error" | "slow" | "ok"; state.delay: ms de retraso de la lectura de CV y de la oferta (para capturar "IA trabajando"). */
export async function mockApi(page, state) {
  await page.route("**/api/cv/parse", async (r) => {
    if (state.delay) await new Promise((ok) => setTimeout(ok, state.delay))
    return r.fulfill({ json: { cv: SAMPLE_CV, sourceText: "Ana Ejemplo\nDesarrolladora\n(texto de muestra)", meta: { model: "muestra", ms: 1, extractMs: 1, totalMs: 1000, method: "text", truncated: false, attempts: 1 } } })
  })
  await page.route("**/api/offer", async (r) => {
    const b = r.request().postDataJSON()
    if (!b.url && state.delay) await new Promise((ok) => setTimeout(ok, state.delay))
    if (b.url) return r.fulfill({ status: 422, json: { error: "Ese sitio no deja leer la oferta sin iniciar sesión. Copia el texto de la oferta y pégalo en la pestaña «Pegar texto»." } })
    return r.fulfill({ json: { offer: SAMPLE_OFFER, meta: {} } })
  })
  await page.route("**/api/rewrite", async (r) => {
    const b = r.request().postDataJSON()
    if (state.rewriteMode === "error") {
      return r.fulfill({ status: 503, json: { error: "No se pudo conectar con Ollama en http://localhost:11434. ¿Está corriendo (ollama serve)?", code: "unreachable" } })
    }
    if (state.rewriteMode === "slow") await new Promise((ok) => setTimeout(ok, 2500))
    const items =
      b.group === "summary"
        ? [{ id: "summary", label: "Resumen", original: b.cv.summary, proposed: "Texto de ejemplo, orientado a las capturas.", status: "changed" }]
        : [
            { id: "exp.0.0", label: "Desarrolladora · Empresa Ejemplo — viñeta 1", original: b.cv.experience[0].bullets[0], proposed: "Construí tableros de ventas en Excel.", status: "changed" },
            { id: "exp.0.1", label: "Desarrolladora · Empresa Ejemplo — viñeta 2", original: b.cv.experience[0].bullets[1], proposed: b.cv.experience[0].bullets[1], status: "kept", reasons: ["La cifra «60» no aparece en tu CV."] },
          ]
    return r.fulfill({ json: { items } })
  })
  await page.route("**/api/cv/profile", (r) => r.fulfill({ json: { ok: true } }))
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
