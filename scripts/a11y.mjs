// Auditoría de accesibilidad: axe-core (contraste, etiquetas, landmarks…) + teclado, en 3 anchos × claro/oscuro.
// Uso: pnpm a11y   (usa tu `pnpm dev` en :3000; no inicia servidores). Sale con código 1 si hay fallos.
import { chromium } from "playwright"
import AxeBuilder from "@axe-core/playwright"
import { BASE as base, LONG, closeDialog, ensureServer, hideDevOverlay, mockApi, noToast, openHistory } from "./lib.mjs"

await ensureServer()
const widths = [375, 768, 1280]
const themes = ["light", "dark"]
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]

let failures = 0
let checks = 0
const fail = (where, msg) => { failures++; console.error(`✗ ${where}: ${msg}`) }

async function axe(page, where) {
  checks++
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  for (const v of r.violations) {
    const nodes = v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")
    fail(where, `[axe ${v.impact}] ${v.id}: ${v.help} → ${nodes}`)
  }
}

/** Recorre el foco con Tab: todo lo interactivo es alcanzable y cada foco se ve (anillo/contorno). */
async function keyboard(page, where) {
  checks++
  // Tras un clic o blur, Chrome sigue desde ese punto: se reinicia al inicio del documento.
  await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); document.body.removeAttribute("tabindex") })
  const seen = new Set()
  const noRing = []
  for (let i = 0; i < 140; i++) {
    await page.keyboard.press("Tab")
    const info = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const cs = getComputedStyle(el)
      const ring = cs.boxShadow !== "none" || (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0)
      el.setAttribute("data-a11y-seen", "1")
      const r = el.getBoundingClientRect()
      return { id: `${el.tagName}|${(el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 40)}|${Math.round(r.x)},${Math.round(r.y)}`, ring, label: `${el.tagName.toLowerCase()} «${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}»` }
    })
    if (!info) continue
    if (seen.has(info.id)) break // dio la vuelta completa
    seen.add(info.id)
    if (!info.ring) noRing.push(info.label)
  }
  if (noRing.length) fail(where, `foco SIN indicador visible en: ${noRing.join(", ")}`)
  const unreached = await page.evaluate(() => {
    const vis = (e) => {
      const r = e.getBoundingClientRect()
      const cs = getComputedStyle(e)
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !e.closest("[aria-hidden='true'],[inert]")
    }
    return [...document.querySelectorAll("button:not([disabled]), a[href], input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex='0']")]
      .filter((e) => e.tabIndex >= 0 && vis(e) && e.getAttribute("role") !== "tab" && e.getAttribute("aria-disabled") !== "true" && !e.hasAttribute("data-disabled") && !e.hasAttribute("data-a11y-seen"))
      .map((e) => `${e.tagName.toLowerCase()} «${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 40)}»`)
  })
  // Los elementos fuera de la pantalla (barra pegajosa) también deben ser alcanzables con Tab.
  if (unreached.length) fail(where, `no alcanzable con Tab: ${unreached.join(", ")}`)
  await page.evaluate(() => document.querySelectorAll("[data-a11y-seen]").forEach((e) => e.removeAttribute("data-a11y-seen")))
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur() })
}

const browser = await chromium.launch()
const combos = themes.flatMap((theme) => widths.map((w) => ({ theme, w })))
// Las 6 combinaciones corren en paralelo (cada una con su propio contexto).
await Promise.all(combos.map(async ({ theme, w }) => {
  {
    const tag = `${w}px ${theme}`
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, colorScheme: theme })
    await hideDevOverlay(ctx)
    const page = await ctx.newPage()
    page.setDefaultTimeout(12000)
    await page.addInitScript((t) => { try { localStorage.setItem("theme", t) } catch {} }, theme)
    const state = { rewriteMode: "error", delay: 0 }
    await mockApi(page, state)
    await page.goto(base, { waitUntil: "networkidle" })

    // 1) Enlace de salto: primer Tab → "Saltar al contenido"; Enter mueve el foco al contenido.
    await page.keyboard.press("Tab")
    const first = await page.evaluate(() => document.activeElement?.textContent?.trim())
    if (first !== "Saltar al contenido") fail(tag, `el primer Tab debería ir a «Saltar al contenido», fue «${first}»`)
    await page.keyboard.press("Enter")
    if (await page.evaluate(() => document.activeElement?.id) !== "contenido") fail(tag, "«Saltar al contenido» no movió el foco al contenido")
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur() })

    await axe(page, `subir CV ${tag}`)
    await keyboard(page, `subir CV ${tag}`)

    await page.getByRole("button", { name: "Lo que he aprendido" }).click()
    await page.getByRole("dialog").getByLabel("Texto de la regla").waitFor()
    await page.waitForTimeout(450)
    await axe(page, `memoria de preferencias (diálogo) ${tag}`)
    await closeDialog(page)

    await openHistory(page)
    await axe(page, `historial vacío (diálogo) ${tag}`)
    await closeDialog(page)

    state.delay = 4000
    await page.locator('input[type="file"]').first().setInputFiles("tests/fixtures/sample.txt")
    await page.getByText("Leyendo el archivo").waitFor()
    await axe(page, `leyendo el CV (IA trabajando) ${tag}`)
    state.delay = 0
    await page.getByRole("heading", { level: 1, name: "Así leímos tu CV" }).waitFor({ timeout: 15000 })
    await noToast(page)
    await axe(page, `perfil (diagnóstico) ${tag}`)
    await keyboard(page, `perfil (diagnóstico) ${tag}`)
    await page.getByRole("button", { name: /^Continuar a Oferta/ }).click()

    // Oferta: corta, error de URL y analizada.
    await page.getByLabel("Texto de la oferta").fill("Oferta muy corta")
    await axe(page, `oferta corta ${tag}`)
    await page.getByRole("tab", { name: "Desde URL" }).click()
    await page.getByLabel("Enlace de la oferta").fill("https://sitio.ejemplo/empleo/1")
    await page.getByRole("button", { name: "Traer oferta" }).click()
    await page.getByText("No pudimos continuar").waitFor()
    await axe(page, `oferta error de URL ${tag}`)
    await page.getByRole("button", { name: "Pegar texto" }).click()
    await page.getByLabel("Texto de la oferta").fill(LONG)
    await page.getByRole("button", { name: "Analizar oferta" }).click()
    await page.getByText("Ver lo que entendí").waitFor({ timeout: 15000 })
    await noToast(page)
    await axe(page, `oferta analizada ${tag}`)
    await keyboard(page, `oferta analizada ${tag}`)

    // Avance SOLO con teclado: Tab hasta «Continuar a Análisis» y Enter → el foco va al contenido.
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab")
      if (await page.evaluate(() => document.activeElement?.textContent?.trim().startsWith("Continuar a"))) break
    }
    await page.keyboard.press("Enter")
    await page.getByText(/puntos de la oferta ya tienen respaldo/).waitFor({ timeout: 15000 })
    if (await page.evaluate(() => document.activeElement?.id) !== "contenido") fail(tag, "al cambiar de paso con el teclado el foco no pasó al contenido")
    await axe(page, `análisis ${tag}`)
    await keyboard(page, `análisis ${tag}`)
    await page.getByRole("button", { name: /^Continuar a Revisión/ }).click()

    // Revisión: error de Ollama, IA trabajando, propuestas, edición rechazada.
    await page.getByRole("button", { name: "Proponer cambios para esta oferta" }).click()
    await page.getByText("No pudimos usar el modelo local").waitFor()
    await axe(page, `revisión · error de Ollama ${tag}`)
    state.rewriteMode = "slow"
    await page.getByRole("button", { name: "Reintentar" }).click()
    await page.getByText("Reescribiendo: Resumen").waitFor()
    await axe(page, `revisión · IA trabajando ${tag}`)
    await page.getByText(/^Cambio 1 de/).waitFor({ timeout: 15000 })
    await axe(page, `revisión · propuestas ${tag}`)
    await keyboard(page, `revisión · propuestas ${tag}`)
    await page.getByRole("button", { name: /^Aceptar/ }).click()
    await page.getByRole("button", { name: /^Editar/ }).click()
    await page.getByLabel(/^Editar:/).fill("Construí tableros con Kubernetes y 60% más rápido.")
    await page.getByRole("button", { name: "Guardar edición" }).click()
    await axe(page, `revisión · edición rechazada ${tag}`)
    await page.getByRole("button", { name: "Cancelar" }).click()
    await page.getByRole("button", { name: /^Rechazar/ }).click()
    await axe(page, `revisión · rechazo con motivo ${tag}`)
    await page.getByRole("button", { name: /^Continuar a Exportar/ }).click()

    // Exportar (descarga real) e historial.
    await page.getByRole("heading", { level: 1, name: "Tu CV adaptado" }).waitFor()
    await axe(page, `exportar ${tag}`)
    await keyboard(page, `exportar ${tag}`)
    await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.getByRole("button", { name: "Descargar PDF" }).click()])
    await page.getByText(/^PDF de \d+ página/).waitFor()
    await noToast(page)
    await axe(page, `exportar · PDF listo ${tag}`)
    await openHistory(page)
    await page.getByRole("dialog").getByText("Cobertura", { exact: false }).first().waitFor()
    await axe(page, `historial con adaptaciones ${tag}`)
    await page.getByRole("dialog").getByRole("button", { name: /^Eliminar la adaptación/ }).click()
    await page.getByText("¿Eliminar esta adaptación?").waitFor()
    await axe(page, `historial · confirmar borrado ${tag}`)
    await page.keyboard.press("Escape") // el diálogo de confirmación se cierra con Escape
    await page.getByText("¿Eliminar esta adaptación?").waitFor({ state: "detached" })
    await closeDialog(page)
    await page.evaluate(() => localStorage.removeItem("cv-tailor:history:v1"))

    // 6) Página 404.
    await page.goto(`${base}/ruta-que-no-existe`, { waitUntil: "networkidle" })
    await page.getByText("No encontramos esa página").waitFor()
    await axe(page, `404 ${tag}`)
    await keyboard(page, `404 ${tag}`)
    await ctx.close()
  }
}))
await browser.close()
console.log(failures ? `\n${failures} problema(s) de accesibilidad en ${checks} comprobaciones.` : `\n✓ Accesibilidad: ${checks} comprobaciones (axe + teclado) sin problemas, 3 anchos × claro/oscuro.`)
process.exit(failures ? 1 : 0)
