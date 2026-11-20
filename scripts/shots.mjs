// Capturas de pantalla: 375/768/1280 en claro y oscuro. Uso: pnpm shots <fase>
// Usa el servidor de desarrollo de Juan (pnpm dev, puerto 3000). No inicia servidores: si no responde, falla.
// Ollama se simula SOLO aquí (scripts/lib.mjs); el PDF, el historial y las páginas de error son reales.
import { chromium } from "playwright"
import { mkdirSync, readFileSync } from "node:fs"
import { BASE as base, LONG, auraDrift, hasAura, closeDialog, ensureServer, hideDevOverlay, mockApi, noToast, openHistory, overflow } from "./lib.mjs"

const phase = process.argv[2] ?? "actual"
const widths = [375, 768, 1280]
const themes = ["light", "dark"]
const out = `docs/shots/${phase}`
mkdirSync(out, { recursive: true })
await ensureServer()

let bad = 0
const problem = (msg) => { bad++; console.error(`✗ ${msg}`) }

const browser = await chromium.launch()

async function run(theme, w, reducedMotion = false) {
  const tag = `${w}-${theme}`
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, colorScheme: theme, reducedMotion: reducedMotion ? "reduce" : "no-preference" })
  await hideDevOverlay(ctx)
  const page = await ctx.newPage()
  page.setDefaultTimeout(12000)
  page.on("pageerror", (e) => console.error("pageerror", e.message))
  await page.addInitScript((t) => { try { localStorage.setItem("theme", t) } catch {} }, theme)
  const state = { rewriteMode: "error", delay: 0 }
  await mockApi(page, state)
  const shot = async (name, opts = {}) => {
    await page.waitForTimeout(450)
    await page.screenshot({ path: `${out}/${name}-${tag}.png`, fullPage: true, ...opts })
    if (await overflow(page)) problem(`SCROLL HORIZONTAL en ${name} ${w}px ${theme}`)
  }

  await page.goto(base, { waitUntil: "networkidle" })
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily.split(",")[0])
  console.log(w, theme, font, reducedMotion ? "(movimiento reducido)" : "")
  await shot("1-subir")

  if (reducedMotion) {
    // Con movimiento reducido el aura NO deriva: su transformación es idéntica en dos instantes.
    state.delay = 6000
    await page.locator('input[type="file"]').first().setInputFiles("tests/fixtures/sample.txt")
    await page.getByText("Leyendo tu CV con el modelo local").waitFor()
    const g1 = await auraDrift(page)
    await page.waitForTimeout(700)
    const g2 = await auraDrift(page)
    if (!g1) problem("movimiento reducido: no apareció el aura")
    else if (g1 !== g2) problem("movimiento reducido: el aura SIGUE derivando")
    else console.log("  ✓ movimiento reducido: aura estática")
    await ctx.close()
    return
  }

  // Historial vacío (diálogo)
  await openHistory(page)
  await page.getByText("Aún no hay adaptaciones guardadas").waitFor()
  await shot("0-historial-vacio")
  await closeDialog(page)

  // ── Leer el CV: IA trabajando (aura + ticker) ──
  state.delay = 6000
  await page.locator('input[type="file"]').first().setInputFiles("tests/fixtures/sample.txt")
  await page.getByText("Leyendo tu CV con el modelo local").waitFor()
  await page.waitForTimeout(500)
  await shot("2a-leyendo-ia")
  const g1 = await auraDrift(page)
  await page.waitForTimeout(600)
  const g2 = await auraDrift(page)
  if (!g1) problem("IA trabajando: no hay aura (AiAura)")
  else if (g1 === g2) problem("IA trabajando: el aura no deriva")
  state.delay = 0
  await page.getByText("Revisa tus datos").waitFor({ timeout: 15000 })
  await noToast(page)
  await page.waitForTimeout(600)
  await shot("2-revisar")
  // al terminar, el aura desaparece (la IA ya no trabaja)
  await page.waitForTimeout(700)
  if (await hasAura(page)) problem("el aura sigue visible con la IA en reposo")
  await page.getByRole("button", { name: "Guardar y continuar" }).click()

  // ── Oferta ──
  await page.getByRole("heading", { level: 1, name: "Pega la oferta" }).waitFor()
  await shot("3-oferta")
  await page.getByLabel("Texto de la oferta").fill("Oferta muy corta")
  await shot("3b-corta")
  await page.getByRole("tab", { name: "Desde URL" }).click()
  await page.getByLabel("Enlace de la oferta").fill("https://sitio.ejemplo/empleo/1")
  await page.getByRole("button", { name: "Traer oferta" }).click()
  await page.getByText("No pudimos continuar").waitFor()
  await shot("3c-url-error")
  await page.getByRole("button", { name: "Pegar texto" }).click()
  await page.getByLabel("Texto de la oferta").fill(LONG)
  state.delay = 6000
  await page.getByRole("button", { name: "Analizar oferta" }).click()
  await page.getByText("Leyendo la oferta con el modelo local").waitFor()
  await shot("3d-analizando-ia")
  state.delay = 0
  await page.getByText("Ver lo que entendí").waitFor({ timeout: 15000 })
  await noToast(page)
  await page.waitForTimeout(600)
  await shot("3e-analizada")
  await page.getByRole("button", { name: /^Continuar a Análisis/ }).click()

  // ── Análisis ──
  await page.getByRole("heading", { level: 1, name: "Qué tanto encaja" }).waitFor()
  await shot("4-analisis")
  await page.getByRole("button", { name: /^Continuar a Revisión/ }).click()

  // ── Revisión ──
  await page.getByRole("heading", { level: 1, name: "Revisa los cambios" }).waitFor()
  await shot("5-revision")
  await page.getByRole("button", { name: "Reescribir para esta oferta" }).click()
  await page.getByText("No pudimos usar el modelo local").waitFor()
  await shot("5b-error-ollama")
  state.rewriteMode = "slow"
  await page.getByRole("button", { name: "Reintentar" }).click()
  await page.getByText("Reescribiendo: Resumen").waitFor()
  await shot("5c-reescribiendo-paso-1")
  // El ticker avanza con el pipeline real: el segundo grupo cambia el mensaje.
  await page.getByText(/Reescribiendo: Desarrolladora/).waitFor({ timeout: 8000 })
  await shot("5c-reescribiendo-paso-2")
  await page.getByText("cambios propuestos").waitFor({ timeout: 15000 })
  await shot("5d-propuestas")
  await page.getByRole("button", { name: "Aceptar", exact: true }).first().click()
  await page.getByRole("button", { name: "Editar", exact: true }).nth(1).click()
  await page.getByLabel(/^Editar:/).fill("Construí tableros de ventas con Kubernetes y un 60% más de rapidez.")
  await page.getByRole("button", { name: "Guardar edición" }).click()
  await shot("5e-edicion-rechazada")
  await page.getByRole("button", { name: "Cancelar" }).click()
  await page.getByRole("button", { name: "Rechazar", exact: true }).nth(1).click()
  await shot("5f-decididas")
  await page.getByRole("button", { name: /^Continuar a Exportar/ }).click()

  // ── Exportar (descarga REAL del PDF) ──
  await page.getByRole("heading", { level: 1, name: "Tu CV adaptado" }).waitFor()
  await shot("6-exportar")
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.getByRole("button", { name: "Descargar PDF" }).click()])
  const file = `${out}/descarga-${tag}.pdf`
  await dl.saveAs(file)
  const head = readFileSync(file).subarray(0, 5).toString()
  if (dl.suggestedFilename() !== "CV-Ana-Ejemplo-Empresa-Ejemplo.pdf" || head !== "%PDF-") problem(`DESCARGA INCORRECTA en ${w}px ${theme}: ${dl.suggestedFilename()} ${head}`)
  await page.getByText(/^PDF de \d+ página/).waitFor()
  await noToast(page)
  await shot("6b-descargado")
  await page.getByRole("tab", { name: "English" }).click()
  await shot("6c-english")

  // ── Historial real ──
  await openHistory(page)
  const dialog = page.getByRole("dialog")
  await dialog.getByText("Cobertura", { exact: false }).first().waitFor()
  await shot("7a-historial")
  const [dl2] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), dialog.getByRole("button", { name: "Descargar PDF" }).click()])
  if (dl2.suggestedFilename() !== "CV-Ana-Ejemplo-Empresa-Ejemplo.pdf") problem(`DESCARGA DEL HISTORIAL INCORRECTA: ${dl2.suggestedFilename()}`)
  await noToast(page)
  await dialog.getByRole("button", { name: /^Eliminar la adaptación/ }).click()
  await page.getByText("¿Eliminar esta adaptación?").waitFor()
  await shot("7b-confirmar-borrado")
  await page.getByRole("button", { name: "Cancelar" }).click()
  await dialog.getByRole("button", { name: "Reabrir" }).click()
  await page.getByText("cambios propuestos").waitFor()
  await noToast(page)
  const restored = await page.getByRole("button", { name: "Aceptar", exact: true }).first().getAttribute("aria-pressed")
  if (restored !== "true") problem(`REABRIR no restauró las decisiones (aria-pressed=${restored})`)
  await shot("7c-reabierta")
  await openHistory(page)
  await page.getByRole("dialog").getByRole("button", { name: /^Eliminar la adaptación/ }).click()
  await page.getByRole("button", { name: "Eliminar", exact: true }).click()
  await page.getByText("Aún no hay adaptaciones guardadas").waitFor()
  await noToast(page)
  await shot("7d-historial-vacio")

  // ── 404 en español ──
  await page.goto(`${base}/esta-pagina-no-existe`, { waitUntil: "networkidle" })
  await page.getByText("No encontramos esa página").waitFor()
  await shot("8-no-encontrada")
  await ctx.close()
}

// Las 6 combinaciones en paralelo; el chequeo de movimiento reducido aparte.
await Promise.all(themes.flatMap((theme) => widths.map((w) => run(theme, w))))
await run("light", 1280, true)
await browser.close()
console.log(bad ? `\n${bad} problema(s).` : "\n✓ Capturas completas sin problemas.")
process.exit(bad ? 1 : 0)
