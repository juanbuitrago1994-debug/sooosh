import type { AtsDoc } from "./model"

/**
 * HTML del PDF ATS. Una columna, Arial 10,5 pt, márgenes de 20 mm, texto negro sobre blanco, sin tablas, imágenes, listas con marcadores
 * gráficos, bordes ni colores (reglas ATS-F3/F4/T1–T5). Las viñetas son el carácter «•» escrito en el texto, no un marcador de lista.
 * Nota: este CSS es del documento impreso, no de la interfaz de la app.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export const ATS_PDF = { fontFamily: "Arial", bodyPt: 10.5, marginMm: 20 } as const

const CSS = `
@page { size: A4; margin: ${ATS_PDF.marginMm}mm; }
* { box-sizing: border-box; }
html { color: #000; background: #fff; }
body { margin: 0; font-family: ${ATS_PDF.fontFamily}, Helvetica, sans-serif; font-size: ${ATS_PDF.bodyPt}pt; line-height: 1.35; }
h1 { font-size: 16pt; line-height: 1.2; margin: 0 0 2pt; font-weight: 700; }
h2 { font-size: 12pt; margin: 14pt 0 5pt; font-weight: 700; break-after: avoid; }
p { margin: 0 0 3pt; overflow-wrap: anywhere; }
.head { font-weight: 700; margin-top: 7pt; break-after: avoid; }
.bullet { padding-left: 5mm; text-indent: -3.5mm; }
`

export function renderAtsHtml(doc: AtsDoc): string {
  const body = doc.sections
    .map(
      (s) =>
        `<section><h2>${esc(s.title)}</h2>${s.blocks
          .map((b) => (b.kind === "para" ? `<p>${esc(b.text)}</p>` : `<p class="head">${esc(b.head)}</p>${b.lines.map((l) => `<p>${esc(l)}</p>`).join("")}${b.bullets.map((x) => `<p class="bullet">• ${esc(x)}</p>`).join("")}`))
          .join("")}</section>`,
    )
    .join("")
  const top = `<h1>${esc(doc.name)}</h1>${doc.headline ? `<p>${esc(doc.headline)}</p>` : ""}${doc.contact ? `<p>${esc(doc.contact)}</p>` : ""}`
  return `<!doctype html><html lang="${doc.lang}"><head><meta charset="utf-8"><title>${esc(doc.name)}</title><style>${CSS}</style></head><body><main>${top}${body}</main></body></html>`
}
