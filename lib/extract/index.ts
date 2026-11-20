import { readFile } from "node:fs/promises"
import { ExtractError } from "./errors"
import { ocrImagesTimed, type OcrResult } from "./ocr"
import { cleanOcrText } from "./ocr-clean"
import { sliceIntoStrips } from "./strips"

export { ExtractError } from "./errors"

export type ExtractMethod = "pdf" | "pdf-ocr" | "docx" | "odt" | "rtf" | "text" | "image-ocr"

export type ExtractResult = { text: string; method: ExtractMethod; /** solo si hubo OCR: cuánto tardó, por página */ ocr?: Pick<OcrResult, "ms" | "pages" | "perPageMs" | "workers"> }

/** Texto mínimo para considerar que un PDF "trae texto". Por debajo se asume escaneado. */
const MIN_PDF_TEXT = 40
const MAX_OCR_PAGES = 5

const UNSUPPORTED: Record<string, string> = {
  doc: "Los archivos .doc (Word antiguo) no se pueden leer sin herramientas externas. Ábrelo en Word y guárdalo como DOCX o PDF, y vuelve a subirlo.",
  heic: "Las fotos HEIC no se pueden leer sin herramientas externas. Expórtala como JPG o PNG (o guárdala como PDF) y vuelve a subirla.",
}

function clean(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

async function fromPdf(buf: Buffer): Promise<ExtractResult> {
  const { extractText, extractImages, getDocumentProxy } = await import("unpdf")
  let pdf
  try {
    pdf = await getDocumentProxy(new Uint8Array(buf))
  } catch {
    throw new ExtractError("unreadable", "No se pudo abrir el PDF. Puede estar dañado o protegido con contraseña.")
  }
  const { text, totalPages } = await extractText(pdf, { mergePages: true })
  const direct = clean(text)
  if (direct.length >= MIN_PDF_TEXT) return { text: direct, method: "pdf" }

  // Sin texto: probablemente un escaneo o un diseño exportado como imagen. Se RENDERIZA la página completa
  // (no solo la imagen incrustada más grande: así entran también el encabezado con el nombre y los textos
  // sobre fondos) y se le aplica OCR. Si el render falla, se cae a las imágenes incrustadas.
  const images: Uint8Array[] = []
  for (let p = 1; p <= Math.min(totalPages, MAX_OCR_PAGES); p++) {
    const page = await renderPage(pdf, p)
    if (page) images.push(...(await sliceIntoStrips(page)))
  }
  if (images.length === 0) {
    for (let p = 1; p <= Math.min(totalPages, MAX_OCR_PAGES); p++) {
      const found = await extractImages(pdf, p, { format: "png" })
      const biggest = found.sort((a, b) => b.width * b.height - a.width * a.height)[0]
      if (biggest) images.push(biggest.data)
    }
  }
  if (images.length === 0) {
    throw new ExtractError("empty", "El PDF no tiene texto ni imágenes legibles.")
  }
  const o = await ocrImagesTimed(images, undefined, "\n")
  return { text: cleanOcrText(clean(o.text)), method: "pdf-ocr", ocr: { ms: o.ms, pages: totalPages, perPageMs: o.perPageMs, workers: o.workers } }
}

/** Ancho objetivo (px) para el OCR: suficiente para letra pequeña sin disparar el tiempo. */
const OCR_TARGET_WIDTH = 2200
/** Alto máximo (px) de la imagen que se le da a Tesseract. */
const OCR_MAX_HEIGHT = 12_000

async function renderPage(pdf: Awaited<ReturnType<(typeof import("unpdf"))["getDocumentProxy"]>>, pageNumber: number): Promise<Uint8Array | null> {
  try {
    const { renderPageAsImage } = await import("unpdf")
    const page = await pdf.getPage(pageNumber)
    const { width, height } = page.getViewport({ scale: 1 })
    const scale = Math.min(OCR_TARGET_WIDTH / width, OCR_MAX_HEIGHT / height)
    return await renderPageAsImage(pdf, pageNumber, { canvasImport: () => import("@napi-rs/canvas"), scale })
  } catch {
    return null
  }
}

async function fromDocx(buf: Buffer): Promise<ExtractResult> {
  const mammoth = await import("mammoth")
  try {
    const { value } = await mammoth.extractRawText({ buffer: buf })
    return { text: clean(value), method: "docx" }
  } catch {
    throw new ExtractError("unreadable", "No se pudo leer el DOCX. Puede estar dañado.")
  }
}

async function fromOffice(buf: Buffer, fileType: "odt" | "rtf"): Promise<ExtractResult> {
  const { OfficeParser } = await import("officeparser")
  try {
    const ast = await OfficeParser.parseOffice(buf, { fileType })
    return { text: clean((await ast.to("text")).value), method: fileType }
  } catch {
    throw new ExtractError("unreadable", `No se pudo leer el archivo ${fileType.toUpperCase()}. Guárdalo como DOCX o PDF e inténtalo de nuevo.`)
  }
}

/** Extrae texto plano de un archivo según su extensión. Lanza ExtractError con mensaje en español. */
export async function extractTextFromFile(filePath: string, ext: string): Promise<ExtractResult> {
  ext = ext.toLowerCase().replace(/^\./, "")
  if (UNSUPPORTED[ext]) throw new ExtractError("unsupported_format", UNSUPPORTED[ext])

  const buf = await readFile(filePath)
  let result: ExtractResult
  switch (ext) {
    case "pdf":
      result = await fromPdf(buf)
      break
    case "docx":
      result = await fromDocx(buf)
      break
    case "odt":
    case "rtf":
      result = await fromOffice(buf, ext)
      break
    case "txt":
    case "md":
      result = { text: clean(buf.toString("utf8")), method: "text" }
      break
    case "jpg":
    case "jpeg":
    case "png":
      {
        const o = await ocrImagesTimed([new Uint8Array(buf)])
        result = { text: cleanOcrText(clean(o.text)), method: "image-ocr", ocr: { ms: o.ms, pages: o.pages, perPageMs: o.perPageMs, workers: o.workers } }
      }
      break
    default:
      throw new ExtractError("unsupported_format", `Formato .${ext} no soportado.`)
  }
  if (result.text.length < 20) {
    throw new ExtractError("empty", "No se encontró texto legible en el archivo. Si es una foto, intenta con más luz y enfocada.")
  }
  return result
}
