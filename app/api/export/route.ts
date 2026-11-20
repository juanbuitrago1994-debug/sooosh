import { NextResponse } from "next/server"
import { FORMATS, MIME, toDocx, toMarkdown, toText, type ExportFormat } from "@/lib/export/formats"
import { cvFileName } from "@/lib/pdf/filename"
import { PdfError, renderCvPdf } from "@/lib/pdf/render"
import { cvSchema } from "@/lib/schemas/cv"
import { getDocumentProxy } from "unpdf"

/**
 * Body: `{ cv, company?, lang?, format? }` → el CV en PDF (por defecto), Word, texto plano o Markdown.
 * Cabeceras: `Content-Disposition` con `CV-<nombre>-<empresa>.<ext>`; en PDF, `X-Pdf-Pages` con el número de páginas.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { cv?: unknown; company?: unknown; lang?: unknown; format?: unknown } | null
  const cv = cvSchema.safeParse(body?.cv)
  if (!cv.success) return NextResponse.json({ error: "El CV no es válido o está incompleto." }, { status: 400 })
  const company = typeof body?.company === "string" ? body.company.slice(0, 80) : undefined
  const lang = body?.lang === "en" ? "en" : "es"
  const format: ExportFormat = FORMATS.includes(body?.format as ExportFormat) ? (body?.format as ExportFormat) : "pdf"
  const headers = (name: string, type: string) => ({ "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Access-Control-Expose-Headers": "Content-Disposition, X-Pdf-Pages", "Cache-Control": "no-store" })

  try {
    if (format !== "pdf") {
      const name = cvFileName(cv.data.header.fullName, company, format)
      const content = format === "docx" ? new Uint8Array(await toDocx(cv.data, lang)) : format === "txt" ? toText(cv.data, lang) : toMarkdown(cv.data, lang)
      return new Response(content, { headers: headers(name, MIME[format]) })
    }
    const pdf = await renderCvPdf(cv.data, lang)
    const pages = (await getDocumentProxy(new Uint8Array(pdf))).numPages
    const name = cvFileName(cv.data.header.fullName, company, "pdf")
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "X-Pdf-Pages": String(pages),
        "Access-Control-Expose-Headers": "Content-Disposition, X-Pdf-Pages",
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    if (e instanceof PdfError) return NextResponse.json({ error: e.message, code: e.code }, { status: 500 })
    console.error("[export]", e)
    return NextResponse.json({ error: "Error inesperado al crear el PDF." }, { status: 500 })
  }
}
