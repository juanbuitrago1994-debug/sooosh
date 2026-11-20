import { AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph, TabStopType, TextRun } from "docx"
import type { PdfLang } from "@/lib/pdf/template"
import type { CV } from "@/lib/schemas/cv"
import { toDocModel } from "./model"

export const FORMATS = ["pdf", "docx", "txt", "md"] as const
export type ExportFormat = (typeof FORMATS)[number]
export const FORMAT_LABEL: Record<ExportFormat, string> = { pdf: "PDF", docx: "Word", txt: "Texto plano", md: "Markdown" }
export const FORMAT_HINT: Record<ExportFormat, string> = {
  pdf: "Listo para enviar. Una columna y texto real, legible por filtros ATS.",
  docx: "Editable en Word, Google Docs o Pages. Una columna, sin tablas ni imágenes.",
  txt: "Máxima compatibilidad con ATS y formularios que piden pegar el texto.",
  md: "Para guardar o publicar en notas, GitHub o tu sitio personal.",
}
export const MIME: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
}

/** Texto plano: títulos en mayúsculas, viñetas con guion. Es la variante ATS de máxima compatibilidad. */
export function toText(cv: CV, lang: PdfLang = "es"): string {
  const m = toDocModel(cv, lang)
  const out: string[] = [m.name, ...(m.headline ? [m.headline] : []), ...(m.contact.length ? [m.contact.join(" | ")] : [])]
  for (const s of m.sections) {
    out.push("", s.title.toUpperCase())
    for (const b of s.blocks) {
      if (b.kind === "para") out.push(b.text)
      else {
        out.push([b.title, b.meta].filter(Boolean).join(" — "))
        if (b.sub) out.push(b.sub)
        out.push(...b.bullets.map((x) => `- ${x}`))
        out.push("")
      }
    }
    while (out[out.length - 1] === "") out.pop()
  }
  return out.join("\n") + "\n"
}

export function toMarkdown(cv: CV, lang: PdfLang = "es"): string {
  const m = toDocModel(cv, lang)
  const out: string[] = [`# ${m.name}`, ...(m.headline ? ["", `**${m.headline}**`] : []), ...(m.contact.length ? ["", m.contact.join(" · ")] : [])]
  for (const s of m.sections) {
    out.push("", `## ${s.title}`)
    for (const b of s.blocks) {
      if (b.kind === "para") out.push("", b.text)
      else {
        out.push("", `### ${b.title}${b.meta ? ` (${b.meta})` : ""}`)
        if (b.sub) out.push(`*${b.sub}*`)
        if (b.bullets.length) out.push("", ...b.bullets.map((x) => `- ${x}`))
      }
    }
  }
  return out.join("\n") + "\n"
}

/** Word (.docx): una sola columna, estilos estándar de título y lista, sin tablas ni imágenes (así lo leen los ATS). */
export async function toDocx(cv: CV, lang: PdfLang = "es"): Promise<Buffer> {
  const m = toDocModel(cv, lang)
  const body: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: m.name, bold: true })] }),
    ...(m.headline ? [new Paragraph({ children: [new TextRun({ text: m.headline })] })] : []),
    ...(m.contact.length ? [new Paragraph({ children: [new TextRun({ text: m.contact.join(" | "), size: 19 })] })] : []),
  ]
  for (const s of m.sections) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 80 }, children: [new TextRun({ text: s.title.toUpperCase(), bold: true })] }))
    for (const b of s.blocks) {
      if (b.kind === "para") body.push(new Paragraph({ children: [new TextRun({ text: b.text })] }))
      else {
        body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, tabStops: [{ type: TabStopType.RIGHT, position: 9000 }], children: [new TextRun({ text: b.title, bold: true }), ...(b.meta ? [new TextRun({ text: `\t${b.meta}` })] : [])] }))
        if (b.sub) body.push(new Paragraph({ children: [new TextRun({ text: b.sub, italics: true })] }))
        for (const x of b.bullets) body.push(new Paragraph({ numbering: { reference: "viñetas", level: 0 }, children: [new TextRun({ text: x })] }))
      }
    }
  }
  const doc = new Document({
    creator: "Sooosh",
    title: m.name,
    styles: { default: { document: { run: { font: "Arial", size: 20 }, paragraph: { alignment: AlignmentType.LEFT, spacing: { after: 60 } } } } },
    numbering: { config: [{ reference: "viñetas", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
    sections: [{ properties: { page: { margin: { top: 907, bottom: 907, left: 907, right: 907 } } }, children: body }],
  })
  return Packer.toBuffer(doc)
}
