import path from "node:path"
import { mapWithLimit } from "@/lib/util/pool"
import { ExtractError } from "./errors"

const LANG_CACHE = path.join(process.cwd(), "data", "tessdata")

export type OcrResult = { text: string; ms: number; pages: number; perPageMs: number[]; workers: number }

/** Páginas que se leen a la vez. Cada worker de Tesseract usa un núcleo y ~100 MB: 2 deja margen en un Mac de 16 GB. */
export const OCR_CONCURRENCY = Number(process.env.OCR_CONCURRENCY ?? 2)

/**
 * OCR local con tesseract.js (español + inglés), **por página y en paralelo con límite**.
 * La primera vez descarga los datos de idioma (~15 MB) y los guarda en data/tessdata. Devuelve cuánto tardó cada página.
 */
export async function ocrImagesTimed(images: Uint8Array[], concurrency = OCR_CONCURRENCY, separator = "\n\n"): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js")
  const { mkdir } = await import("node:fs/promises")
  await mkdir(LANG_CACHE, { recursive: true })
  const t0 = Date.now()
  const n = Math.max(1, Math.min(concurrency, images.length))
  const workers = await Promise.all(Array.from({ length: n }, () => createWorker(["spa", "eng"], 1, { cachePath: LANG_CACHE })))
  try {
    const free = [...workers]
    const perPageMs: number[] = []
    const parts = await mapWithLimit(images, n, async (img, i) => {
      const w = free.pop()!
      const t = Date.now()
      try {
        const { data } = await w.recognize(Buffer.from(img))
        return data.text
      } finally {
        perPageMs[i] = Date.now() - t
        free.push(w)
      }
    })
    return { text: parts.join(separator), ms: Date.now() - t0, pages: images.length, perPageMs, workers: n }
  } catch (e) {
    throw new ExtractError("ocr_failed", `No se pudo aplicar OCR a la imagen (${(e as Error).message}). Prueba con un PDF o DOCX con texto.`)
  } finally {
    await Promise.all(workers.map((w) => w.terminate()))
  }
}

export async function ocrImages(images: Uint8Array[]): Promise<string> {
  return (await ocrImagesTimed(images)).text
}
