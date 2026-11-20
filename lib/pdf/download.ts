import type { CV } from "@/lib/schemas/cv"
import type { ExportFormat } from "@/lib/export/formats"
import { cvFileName } from "./filename"
import type { PdfLang } from "./template"

/** Pide el CV a /api/export (PDF, Word, TXT o Markdown) y lo descarga. Devuelve el nombre y, en PDF, el número de páginas. */
export async function downloadCv(cv: CV, company: string | undefined, lang: PdfLang, format: ExportFormat = "pdf"): Promise<{ fileName: string; pages: number | null }> {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cv, company, lang, format }),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error ?? "No se pudo crear el archivo.")
  }
  const fileName = cvFileName(cv.header.fullName, company, format)
  const pages = Number(res.headers.get("X-Pdf-Pages")) || null
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { fileName, pages }
}

/** Compatibilidad con el nombre anterior. */
export const downloadPdf = (cv: CV, company: string | undefined, lang: PdfLang) => downloadCv(cv, company, lang, "pdf")
