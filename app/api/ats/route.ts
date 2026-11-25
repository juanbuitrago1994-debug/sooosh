import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { renderAtsDocx } from "@/lib/ats/docx"
import { atsFileName } from "@/lib/ats/filename"
import { extractExtras, atsExtrasSchema, regroundExtras, EMPTY_EXTRAS, type AtsExtras } from "@/lib/ats/enrich"
import { generateAts } from "@/lib/ats/generate"
import { buildAtsDoc, withExtras } from "@/lib/ats/model"
import { renderAtsPdf } from "@/lib/ats/pdf"
import { atsToText } from "@/lib/ats/text"
import { combineReports, verifyAtsFile } from "@/lib/ats/verify"
import { PdfError } from "@/lib/pdf/render"
import { cvSchema } from "@/lib/schemas/cv"
import { STORED_ID_RE } from "@/lib/uploads"

const MAX_B64 = 8_000_000
const MAX_SOURCE = 60_000

/**
 * Versión ATS del CV. Body `{ action, cv, ... }`:
 *  - `generate` → NDJSON: `{t:"stage", i}` (avance real: 0 ordenar, 1 resumen con IA local si hace falta, 2 armar archivos),
 *    `{t:"result", summary, summaryReason, warnings, pages, pdf, docx, pdfName, docxName}` (archivos en base64) o `{t:"error", error}`.
 *  - `verify` (`{ cv, summary?, pdf, docx }` en base64) → `{ percent, label, labelText, validated, groups, formats, disclaimer }`, sin el detalle de reglas.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { action?: unknown; cv?: unknown; summary?: unknown; sourceText?: unknown; extras?: unknown; pdf?: unknown; docx?: unknown } | null
  const cv = cvSchema.safeParse(body?.cv)
  if (!cv.success) return NextResponse.json({ error: "El CV no es válido o está incompleto." }, { status: 400 })

  // Lectura profunda sola (sin archivos): se lanza al subir el CV; el resultado se guarda en el navegador y «generate» lo reutiliza.
  if (body?.action === "read") {
    const sourceText = typeof body.sourceText === "string" ? body.sourceText.slice(0, MAX_SOURCE) : undefined
    const r = await extractExtras(cv.data, sourceText, { signal: request.signal })
    return NextResponse.json({ extras: r.reason ? null : r.extras }, { headers: { "Cache-Control": "no-store" } })
  }

  // Afinidad del archivo ORIGINAL que subió la persona con el formato ATS (mismo verificador que la versión generada; solo PDF y Word con texto).
  if (body?.action === "original") {
    const fileId = typeof (body as { fileId?: unknown }).fileId === "string" ? ((body as { fileId?: string }).fileId as string) : ""
    if (!STORED_ID_RE.test(fileId)) return NextResponse.json({ error: "Identificador de archivo inválido." }, { status: 400 })
    const ext = path.extname(fileId).toLowerCase()
    if (ext !== ".pdf" && ext !== ".docx") return NextResponse.json({ percent: null, reason: "format" }, { headers: { "Cache-Control": "no-store" } })
    const file = await readFile(path.join(process.cwd(), "data", "uploads", fileId)).catch(() => null)
    if (!file) return NextResponse.json({ error: "No encontramos el archivo subido." }, { status: 404 })
    const name = typeof (body as { fileName?: unknown }).fileName === "string" ? ((body as { fileName?: string }).fileName as string).slice(0, 200) : fileId
    const source = typeof body.sourceText === "string" ? body.sourceText.slice(0, MAX_SOURCE) : undefined
    try {
      const report = await verifyAtsFile({ file, fileName: name, cv: cv.data, source })
      return NextResponse.json({ percent: report.percent, label: report.label, labelText: report.labelText }, { headers: { "Cache-Control": "no-store" } })
    } catch (e) {
      console.error("[ats/original]", e)
      return NextResponse.json({ percent: null, reason: "unreadable" }, { headers: { "Cache-Control": "no-store" } })
    }
  }

  if (body?.action === "verify") {
    const b64 = (x: unknown) => (typeof x === "string" && x.length > 0 && x.length < MAX_B64 ? Buffer.from(x, "base64") : null)
    const pdf = b64(body.pdf)
    const docx = b64(body.docx)
    if (!pdf || !docx) return NextResponse.json({ error: "Faltan los archivos a verificar." }, { status: 400 })
    const summary = typeof body.summary === "string" && body.summary.trim() ? body.summary.slice(0, 1200) : undefined
    const source = typeof body.sourceText === "string" ? body.sourceText.slice(0, MAX_SOURCE) : undefined
    // Los extras vienen del cliente: se vuelven a comprobar contra el texto original antes de usarlos.
    const parsed = atsExtrasSchema.safeParse(body.extras)
    const extras: AtsExtras = parsed.success && source ? regroundExtras(parsed.data, source) : EMPTY_EXTRAS
    try {
      const doc = buildAtsDoc(cv.data, { summary, extras })
      const effective = withExtras(cv.data, extras)
      const expectedText = atsToText(doc)
      const reports = await Promise.all([
        verifyAtsFile({ file: pdf, fileName: atsFileName(doc, "pdf"), cv: effective, expectedText, source }),
        verifyAtsFile({ file: docx, fileName: atsFileName(doc, "docx"), cv: effective, expectedText, source }),
      ])
      return NextResponse.json(combineReports(reports), { headers: { "Cache-Control": "no-store" } })
    } catch (e) {
      console.error("[ats/verify]", e)
      return NextResponse.json({ error: "No se pudo verificar el archivo. Genera la versión ATS de nuevo." }, { status: 500 })
    }
  }

  if (body?.action !== "generate") return NextResponse.json({ error: "Acción no válida." }, { status: 400 })

  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(o) + "\n"))
        } catch {
          /* el cliente cerró la conexión */
        }
      }
      try {
        const sourceText = typeof body?.sourceText === "string" ? body.sourceText.slice(0, MAX_SOURCE) : undefined
        // Si ya se leyó a fondo en esta sesión, el cliente devuelve lo recuperado (se vuelve a comprobar contra el texto) y no se repite la lectura.
        const known = atsExtrasSchema.safeParse(body?.extras)
        const prior = known.success && sourceText ? regroundExtras(known.data, sourceText) : undefined
        const g = await generateAts(cv.data, { sourceText, extras: prior, signal: request.signal, onStage: (i) => send({ t: "stage", i }) })
        send({ t: "stage", i: 2 })
        const [{ pdf, pages }, docx] = await Promise.all([renderAtsPdf(g.doc), renderAtsDocx(g.doc)])
        send({
          t: "result",
          summary: g.doc.summarySource === "ia" ? (g.doc.sections.find((s) => s.key === "summary")?.blocks[0] as { text?: string } | undefined)?.text ?? null : null,
          summaryFromCv: g.doc.summarySource === "cv",
          summaryReason: g.summary?.reason ?? null,
          warnings: g.doc.warnings.filter((w) => w.code === "title-abbrev" || w.code === "order-kept" || w.code === "summary-cut").map((w) => w.message),
          pages,
          extras: g.extras,
          pdf: Buffer.from(pdf).toString("base64"),
          docx: Buffer.from(docx).toString("base64"),
          pdfName: atsFileName(g.doc, "pdf"),
          docxName: atsFileName(g.doc, "docx"),
        })
      } catch (e) {
        if (!(e instanceof PdfError)) console.error("[ats/generate]", e)
        send({ t: "error", error: e instanceof PdfError ? e.message : "No se pudo crear la versión ATS. Inténtalo de nuevo." })
      } finally {
        try {
          controller.close()
        } catch {
          /* ya cerrado */
        }
      }
    },
  })
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } })
}
