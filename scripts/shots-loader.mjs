// Capturas del MatrixLoader mientras la IA trabaja. Uso: pnpm shots:loader [nombre]
// Usa el servidor de Juan (:3000); no inicia servidores. La lectura del CV se retiene para poder fotografiar el loader.
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { BASE, ensureServer, hideDevOverlay, overflow } from "./lib.mjs"

const name = process.argv[2] ?? "loader"
const out = `docs/shots/${name}`
mkdirSync(out, { recursive: true })
await ensureServer()
const browser = await chromium.launch()
let bad = 0
const problem = (m) => { bad++; console.error(`✗ ${m}`) }

/** Opacidad de cada punto: sirve para saber si la matriz anima. */
const dots = (page) => page.locator('[data-pattern] span').evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity).join(","))

async function run(theme, w, reduced) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, colorScheme: theme, reducedMotion: reduced ? "reduce" : "no-preference" })
  await hideDevOverlay(ctx)
  const page = await ctx.newPage()
  await page.addInitScript((t) => { try { localStorage.setItem("theme", t) } catch {} }, theme)
  let release
  const gate = new Promise((ok) => (release = ok))
  await page.route("**/api/cv/parse", async (r) => { await gate; await r.abort() })
  await page.goto(BASE, { waitUntil: "networkidle" })
  await page.locator('input[type="file"]').first().setInputFiles("tests/fixtures/sample.txt")
  await page.locator("[data-pattern]").waitFor()
  await page.waitForTimeout(900)
  const n = await page.locator("[data-pattern] span").count()
  if (n !== 16) problem(`${w}px ${theme}: la matriz tiene ${n} puntos (esperados 16)`)
  const a = await dots(page)
  await page.waitForTimeout(700)
  const b = await dots(page)
  if (reduced) a === b ? console.log(`  ✓ ${w} ${theme}: movimiento reducido → matriz quieta`) : problem(`${w}px ${theme}: movimiento reducido pero la matriz anima`)
  else {
    a !== b ? console.log(`  ✓ ${w} ${theme}: la matriz anima`) : problem(`${w}px ${theme}: la matriz no anima`)
    await page.screenshot({ path: `${out}/leyendo-${w}-${theme}.png`, fullPage: true })
  }
  if (await overflow(page)) problem(`SCROLL HORIZONTAL ${w}px ${theme}`)
  release()
  await ctx.close()
}

await Promise.all(["light", "dark"].flatMap((t) => [375, 768, 1280].map((w) => run(t, w, false))))
await run("light", 1280, true)
await browser.close()
console.log(bad ? `\n${bad} problema(s).` : "\n✓ Loader verificado.")
process.exit(bad ? 1 : 0)
