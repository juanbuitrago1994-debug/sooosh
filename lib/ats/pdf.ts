import { chromium } from "playwright"
import { getDocumentProxy } from "unpdf"
import { PdfError } from "@/lib/pdf/render"
import { renderAtsHtml } from "./html"
import type { AtsDoc } from "./model"

/** PDF (A4) del CV ATS con el Chromium local de Playwright, sin red. Devuelve el archivo y su número de páginas (regla ATS-F6: ≤ 2; no se encoge nada para «caber»). */
export async function renderAtsPdf(doc: AtsDoc): Promise<{ pdf: Buffer; pages: number }> {
  let browser
  try {
    browser = await chromium.launch()
  } catch {
    throw new PdfError("no_browser", "No se encontró el navegador local para crear el PDF. Instálalo con: pnpm exec playwright install chromium")
  }
  try {
    const page = await browser.newPage()
    await page.route("**/*", (route) => (route.request().url().startsWith("data:") ? route.continue() : route.abort()))
    await page.setContent(renderAtsHtml(doc), { waitUntil: "load", timeout: 15_000 })
    await page.emulateMedia({ media: "print" })
    const pdf = await page.pdf({ format: "A4", printBackground: false, preferCSSPageSize: true })
    const pages = (await getDocumentProxy(new Uint8Array(pdf))).numPages
    return { pdf, pages }
  } catch {
    throw new PdfError("render_failed", "No se pudo generar el PDF. Inténtalo de nuevo.")
  } finally {
    await browser.close()
  }
}
