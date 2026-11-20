import { chromium } from "playwright"
import type { CV } from "@/lib/schemas/cv"
import { renderCvHtml, type PdfLang } from "./template"

export class PdfError extends Error {
  constructor(
    public code: "no_browser" | "render_failed",
    message: string,
  ) {
    super(message)
    this.name = "PdfError"
  }
}

/** Genera el PDF (A4) del CV con el Chromium local de Playwright. Sin red ni servicios externos. */
export async function renderCvPdf(cv: CV, lang: PdfLang = "es"): Promise<Buffer> {
  let browser
  try {
    browser = await chromium.launch()
  } catch {
    throw new PdfError("no_browser", "No se encontró el navegador local para crear el PDF. Instálalo con: pnpm exec playwright install chromium")
  }
  try {
    const page = await browser.newPage()
    await page.route("**/*", (route) => (route.request().url().startsWith("data:") ? route.continue() : route.abort()))
    await page.setContent(renderCvHtml(cv, lang), { waitUntil: "load", timeout: 15_000 })
    await page.emulateMedia({ media: "print" })
    return await page.pdf({ format: "A4", printBackground: false, preferCSSPageSize: true })
  } catch {
    throw new PdfError("render_failed", "No se pudo generar el PDF. Inténtalo de nuevo.")
  } finally {
    await browser.close()
  }
}
