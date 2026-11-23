import { AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun } from "docx"
import type { AtsDoc } from "./model"

/**
 * Word (.docx) del CV ATS: una columna, Arial 10,5 pt, márgenes de 2 cm, sin encabezado ni pie, sin tablas, cuadros de texto ni imágenes.
 * Títulos de sección con el estilo estándar «Título 1» (texto negro, sin el azul por defecto de Word); viñetas con lista numerada real «•».
 */
const FONT = "Arial"
const BODY = 21 // medios puntos: 10,5 pt
const MARGIN = 1134 // twips: 2 cm

export async function renderAtsDocx(doc: AtsDoc): Promise<Buffer> {
  const run = (text: string, o: { bold?: boolean; size?: number } = {}) => new TextRun({ text, bold: o.bold, size: o.size ?? BODY, font: FONT, color: "000000" })
  const body: Paragraph[] = [
    new Paragraph({ spacing: { after: 40 }, children: [run(doc.name, { bold: true, size: 32 })] }),
    ...(doc.headline ? [new Paragraph({ children: [run(doc.headline)] })] : []),
    ...(doc.contact ? [new Paragraph({ children: [run(doc.contact)] })] : []),
  ]
  for (const s of doc.sections) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(s.title, { bold: true, size: 24 })] }))
    for (const b of s.blocks) {
      if (b.kind === "para") {
        body.push(new Paragraph({ children: [run(b.text)] }))
        continue
      }
      body.push(new Paragraph({ keepNext: true, spacing: { before: 120 }, children: [run(b.head, { bold: true })] }))
      for (const l of b.lines) body.push(new Paragraph({ children: [run(l)] }))
      for (const x of b.bullets) body.push(new Paragraph({ numbering: { reference: "vinetas", level: 0 }, children: [run(x)] }))
    }
  }
  const file = new Document({
    creator: "Sooosh",
    title: doc.name,
    styles: {
      default: { document: { run: { font: FONT, size: BODY, color: "000000" }, paragraph: { alignment: AlignmentType.LEFT, spacing: { after: 60, line: 270 } } } },
      paragraphStyles: [{ id: "Heading1", name: "heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 24, bold: true, color: "000000" }, paragraph: { spacing: { before: 280, after: 100 }, keepNext: true, outlineLevel: 0 } }],
    },
    numbering: { config: [{ reference: "vinetas", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } }, children: body }],
  })
  return Packer.toBuffer(file)
}
