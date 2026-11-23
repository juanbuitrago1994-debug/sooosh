import { getDocumentProxy, getResolvedPDFJS } from "unpdf"
import { readZip } from "./zip"

/**
 * Lector del archivo ATS ya generado (PDF o Word). El verificador mide el ARCHIVO, no los datos de entrada: aquí se lee lo que vería
 * cualquier lector (texto en orden de lectura, fuentes reales, tamaños, márgenes, imágenes, tablas, encabezado/pie, colores).
 */
export type Line = {
  text: string
  /** tamaño en pt (null si no se pudo leer) */
  size: number | null
  /** null = no se pudo saber */
  bold: boolean | null
  /** título de sección (PDF: texto más grande que el cuerpo, salvo el nombre; Word: estilo «Título 1») */
  heading: boolean
  page: number
  /** distancia desde el borde superior de la página, en pt (solo PDF) */
  yTop: number | null
  /** carácter de viñeta de una lista numerada de Word (en PDF la viñeta va en el texto) */
  bullet?: string | null
}

export type Extraction = {
  format: "pdf" | "docx"
  bytes: number
  /** null en Word: el número de páginas depende de quien lo abra */
  pages: number | null
  lines: Line[]
  /** familias de fuente reales, sin subconjunto ni variante («ArialMT», «Arial-BoldMT» → «arial») */
  fonts: string[]
  bodySize: number | null
  minSize: number | null
  /** márgenes medidos, en cm. `left`/`top` son donde EMPIEZA el texto; el resto son los mínimos hasta el borde */
  margins: { left: number | null; top: number | null; right: number | null; bottom: number | null } | null
  imageCount: number
  /** anotaciones que no son enlaces (formularios, sellos…) */
  oddAnnotations: number
  /** texto que viva en encabezado o pie de página (solo Word; en PDF se mide por posición) */
  headerFooterText: string[]
  hasTables: boolean
  hasTextBoxes: boolean
  /** columnas de página (Word) */
  columns: number
  /** líneas con huecos horizontales grandes (indicio de columnas en PDF) */
  wideGapLines: number
  colors: string[]
  letterSpacing: boolean | null
  /** separación antes del título de sección, en pt (Word: estilo «Título 1») */
  headingSpaceBefore: number | null
  text: string
  /** el lector no pudo asociar fuentes con líneas (negrita desconocida) */
  boldKnown: boolean
}

export const familyOf = (baseFont: string): string =>
  baseFont
    .replace(/^[A-Z]{6}\+/, "")
    .replace(/[-,](Bold|Italic|BoldItalic|BoldOblique|Oblique|Regular|Semibold|Light|Medium).*$/i, "")
    .replace(/(MT|PS)$/i, "")
    .replace(/\s+/g, "")
    .toLowerCase()

const PT_PER_CM = 28.3465

export async function extractPdf(buf: Buffer): Promise<Extraction> {
  const pdfjs = await getResolvedPDFJS()
  const OPS = pdfjs.OPS as Record<string, number>
  const doc = await getDocumentProxy(new Uint8Array(buf))
  // Nombres reales de fuente, en el orden en que el PDF las declara (los ids del texto son g_d1_f1, f2…).
  const names = [...new Set([...buf.toString("latin1").matchAll(/\/BaseFont\s*\/([A-Za-z0-9+\-,_]+)/g)].map((m) => m[1]))]
  const nameOf = (id: string): string | null => {
    const n = Number(id.match(/_f(\d+)$/)?.[1])
    return Number.isFinite(n) && names[n - 1] ? names[n - 1] : null
  }
  const imageOps = ["paintImageXObject", "paintInlineImageXObject", "paintImageMaskXObject", "paintImageXObjectRepeat", "paintImageMaskXObjectGroup", "paintImageMaskXObjectRepeat", "paintJpegXObject"].map((k) => OPS[k]).filter((x) => x != null)
  const colorOps = ["setFillRGBColor", "setStrokeRGBColor", "setFillGray", "setStrokeGray", "setFillCMYKColor", "setStrokeCMYKColor"].map((k) => [OPS[k], k] as const).filter(([n]) => n != null)

  const lines: Line[] = []
  const sizeChars = new Map<number, number>()
  let minSize: number | null = null
  let imageCount = 0
  let oddAnnotations = 0
  let wideGapLines = 0
  let left: number | null = null
  let top: number | null = null
  let right: number | null = null
  let bottom: number | null = null
  const colors = new Set<string>()
  let boldKnown = names.length > 0

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const [, , pw, ph] = page.view
    const tc = await page.getTextContent()
    type It = { s: string; x: number; y: number; w: number; h: number; f: string }
    const items: It[] = (tc.items as { str: string; transform: number[]; width: number; height: number; fontName: string }[])
      .filter((i) => i.str.trim())
      .map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height, f: i.fontName }))
      .sort((a, b) => b.y - a.y || a.x - b.x)
    const rows: It[][] = []
    for (const it of items) {
      const row = rows[rows.length - 1]
      if (row && Math.abs(row[0].y - it.y) <= 1.5) row.push(it)
      else rows.push([it])
    }
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x)
      let text = ""
      row.forEach((it, i) => {
        const prev = row[i - 1]
        if (prev) {
          const gap = it.x - (prev.x + prev.w)
          if (gap > 3 * Math.max(it.h, 1)) wideGapLines++
          if (gap > 0.15 * Math.max(it.h, 1) && !text.endsWith(" ")) text += " "
        }
        text += it.s
      })
      const main = row.reduce((a, b) => (b.s.length > a.s.length ? b : a))
      for (const it of row) {
        sizeChars.set(round(it.h), (sizeChars.get(round(it.h)) ?? 0) + it.s.length)
        minSize = minSize == null ? it.h : Math.min(minSize, it.h)
      }
      const fname = nameOf(main.f)
      if (!fname) boldKnown = false
      lines.push({ text: text.replace(/\s+/g, " ").trim(), size: round(main.h), bold: fname ? /bold/i.test(fname) : null, heading: false, page: p, yTop: ph - main.y })
      const x0 = Math.min(...row.map((r) => r.x))
      const x1 = Math.max(...row.map((r) => r.x + r.w))
      const yTopText = ph - (main.y + main.h * 0.9)
      left = left == null ? x0 : Math.min(left, x0)
      right = right == null ? pw - x1 : Math.min(right, pw - x1)
      bottom = bottom == null ? main.y : Math.min(bottom, main.y)
      if (p === 1 && top == null) top = yTopText
    }
    const ol = await page.getOperatorList()
    ol.fnArray.forEach((fn: number, k: number) => {
      if (imageOps.includes(fn)) imageCount++
      const c = colorOps.find(([n]) => n === fn)
      if (c) {
        const a = ol.argsArray[k] as unknown[]
        if (typeof a?.[0] === "string") colors.add(String(a[0]).toLowerCase())
        else if (c[1].includes("Gray")) colors.add(a?.[0] === 0 ? "#000000" : a?.[0] === 1 ? "#ffffff" : `gray:${a?.[0]}`)
        else colors.add(`${c[1]}:${JSON.stringify(a)}`)
      }
    })
    oddAnnotations += (await page.getAnnotations()).filter((a: { subtype?: string }) => a.subtype !== "Link").length
  }

  const bodySize = [...sizeChars.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  lines.forEach((l, i) => {
    l.heading = i > 0 && bodySize != null && l.size != null && l.size >= bodySize + 0.9 && l.page >= 1
  })
  const lastPageBottom = bottom
  return {
    format: "pdf",
    bytes: buf.length,
    pages: doc.numPages,
    lines,
    fonts: [...new Set(names.map(familyOf))],
    bodySize,
    minSize: minSize == null ? null : round(minSize),
    margins: { left: left == null ? null : left / PT_PER_CM, top: top == null ? null : top / PT_PER_CM, right: right == null ? null : right / PT_PER_CM, bottom: lastPageBottom == null ? null : lastPageBottom / PT_PER_CM },
    imageCount,
    oddAnnotations,
    headerFooterText: [],
    hasTables: false,
    hasTextBoxes: false,
    columns: 1,
    wideGapLines,
    colors: [...colors],
    letterSpacing: null,
    headingSpaceBefore: null,
    text: lines.map((l) => l.text).join("\n"),
    boldKnown,
  }
}

const round = (n: number) => Math.round(n * 100) / 100
const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")

export function extractDocx(buf: Buffer): Extraction {
  const zip = readZip(buf)
  const part = (n: string) => zip.get(n)?.toString("utf8") ?? ""
  const doc = part("word/document.xml")
  const styles = part("word/styles.xml")
  const numbering = part("word/numbering.xml")
  if (!doc) throw new Error("El .docx no tiene contenido (word/document.xml).")

  // viñetas: numId → carácter
  const bulletOf = new Map<string, string>()
  const absBullet = new Map<string, string>()
  for (const m of numbering.matchAll(/<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[\s\S]*?<\/w:abstractNum>/g)) {
    const lvl = m[0].match(/<w:numFmt w:val="bullet"\/>[\s\S]*?<w:lvlText w:val="([^"]*)"/) ?? m[0].match(/<w:lvlText w:val="([^"]*)"[\s\S]*?<w:numFmt w:val="bullet"/)
    if (lvl) absBullet.set(m[1], unxml(lvl[1]))
  }
  for (const m of numbering.matchAll(/<w:num\b[^>]*w:numId="(\d+)"[^>]*>\s*<w:abstractNumId w:val="(\d+)"\/>/g)) if (absBullet.has(m[2])) bulletOf.set(m[1], absBullet.get(m[2]) as string)

  const defSz = Number(styles.match(/<w:docDefaults>[\s\S]*?<w:sz w:val="(\d+)"/)?.[1]) / 2 || null
  const lines: Line[] = []
  const sizeChars = new Map<number, number>()
  for (const m of doc.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const p = m[0]
    const text = unxml([...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>/g)].map((t) => (t[1] ?? "\t")).join("")).replace(/\s+/g, " ").trim()
    if (!text) continue
    const style = p.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? ""
    const numId = p.match(/<w:numPr>[\s\S]*?<w:numId w:val="(\d+)"/)?.[1]
    const sz = Number(p.match(/<w:sz w:val="(\d+)"/)?.[1]) / 2 || defSz
    const bullet = numId ? (bulletOf.get(numId) ?? "") : null
    lines.push({ text: bullet ? `${bullet} ${text}` : text, size: sz, bold: /<w:b\/>|<w:b w:val="(?:1|true)"\/>/.test(p), heading: /^(Heading\d|Title)$/i.test(style), page: 1, yTop: null, bullet })
    if (sz != null) sizeChars.set(sz, (sizeChars.get(sz) ?? 0) + text.length)
  }

  // Solo cuentan los estilos que el documento usa (más los valores por defecto): Word trae «Título 2–6» definidos en azul aunque nadie los use.
  const used = new Set([...doc.matchAll(/<w:pStyle w:val="([^"]+)"/g)].map((m) => m[1]).concat(["Normal"]))
  const usedStyles = [...styles.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[\s\S]*?<\/w:style>/g)].filter((m) => used.has(m[1])).map((m) => m[0])
  const all = doc + (styles.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)?.[0] ?? "") + usedStyles.join("")
  const fonts = [...new Set([...all.matchAll(/w:ascii="([^"]+)"/g)].map((m) => familyOf(m[1])))]
  const twips = (a: string) => {
    const v = Number(doc.match(new RegExp(`<w:pgMar [^>]*w:${a}="(-?\\d+)"`))?.[1])
    return Number.isFinite(v) ? v / 567 : null
  }
  const sizes = [...sizeChars.keys()]
  const hf = [...zip.entries()].filter(([n]) => /^word\/(header|footer)\d*\.xml$/.test(n)).flatMap(([, b]) => [...b.toString("utf8").matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((t) => unxml(t[1]).trim()).filter(Boolean))
  const colors = [...all.matchAll(/<w:color w:val="([0-9A-Fa-f]{6}|auto)"/g)].map((m) => m[1].toLowerCase()).concat([...all.matchAll(/<w:shd [^>]*w:fill="([0-9A-Fa-f]{6}|auto)"/g)].map((m) => `fill:${m[1].toLowerCase()}`), /<w:highlight\b/.test(all) ? ["highlight"] : [])
  const h1 = styles.match(/<w:style\b[^>]*w:styleId="Heading1"[\s\S]*?<\/w:style>/)?.[0] ?? ""

  return {
    format: "docx",
    bytes: buf.length,
    pages: null,
    lines,
    fonts,
    bodySize: [...sizeChars.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? defSz,
    minSize: sizes.length ? Math.min(...sizes) : defSz,
    margins: { left: twips("left"), top: twips("top"), right: twips("right"), bottom: twips("bottom") },
    imageCount: [...zip.keys()].filter((n) => /^word\/media\//.test(n)).length + (/<w:drawing\b|<w:pict\b/.test(doc) ? 1 : 0),
    oddAnnotations: 0,
    headerFooterText: hf,
    hasTables: /<w:tbl\b/.test(doc),
    hasTextBoxes: /<w:txbxContent\b/.test(doc),
    columns: Math.max(1, ...[...doc.matchAll(/<w:cols\b[^>]*w:num="(\d+)"/g)].map((m) => Number(m[1]))),
    wideGapLines: 0,
    colors,
    letterSpacing: /<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*<w:spacing\s+w:val=/.test(all),
    headingSpaceBefore: h1 ? Number(h1.match(/<w:spacing\b[^>]*w:before="(\d+)"/)?.[1] ?? 0) / 20 : null,
    text: lines.map((l) => l.text).join("\n"),
    boldKnown: true,
  }
}

export async function extractFile(buf: Buffer): Promise<Extraction> {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return extractPdf(buf)
  if (buf.readUInt32LE(0) === 0x04034b50) return extractDocx(buf)
  throw new Error("El archivo no es un PDF ni un Word (.docx).")
}
