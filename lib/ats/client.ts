import type { CV } from "@/lib/schemas/cv"
import type { VerifyView } from "./verify"

/** Cliente de `/api/ats`: genera la versión ATS (con el avance real por etapas), la verifica y guarda los archivos. */
export const ATS_STAGES = ["Ordenando secciones y fechas", "Redactando el resumen", "Armando el PDF y el Word"] as const

export type AtsBundle = {
  pdf: { blob: Blob; name: string; base64: string }
  docx: { blob: Blob; name: string; base64: string }
  pages: number
  /** resumen que escribió la IA local (null si el CV ya traía uno o no se generó) */
  summary: string | null
  summaryFromCv: boolean
  summaryReason: string | null
  warnings: string[]
}

type Ev = { t: "stage"; i: number } | ({ t: "result" } & Record<string, unknown>) | { t: "error"; error: string }

const toBlob = (b64: string, type: string) => {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}
const PDF = "application/pdf"
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const friendly = (m: string) => (/fetch|network|failed/i.test(m) ? "No se pudo conectar con el servidor. ¿Está la app corriendo?" : m)

export async function generateAtsClient(cv: CV, onStage: (i: number) => void, signal?: AbortSignal): Promise<AtsBundle> {
  let res: Response
  try {
    res = await fetch("/api/ats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate", cv }), signal })
  } catch (e) {
    throw new Error(friendly((e as Error).message))
  }
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.error ?? "No se pudo crear la versión ATS.")
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  let result: Record<string, unknown> | null = null
  const handle = (line: string) => {
    if (!line.trim()) return
    const ev = JSON.parse(line) as Ev
    if (ev.t === "stage") onStage(ev.i)
    else if (ev.t === "error") throw new Error(ev.error)
    else result = ev
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf("\n")) >= 0) {
      handle(buf.slice(0, nl))
      buf = buf.slice(nl + 1)
    }
  }
  handle(buf)
  if (!result) throw new Error("La generación terminó sin resultado. Inténtalo de nuevo.")
  const r = result as Record<string, unknown>
  const file = (b64: unknown, name: unknown, type: string) => ({ blob: toBlob(String(b64), type), name: String(name), base64: String(b64) })
  return {
    pdf: file(r.pdf, r.pdfName, PDF),
    docx: file(r.docx, r.docxName, DOCX),
    pages: Number(r.pages) || 1,
    summary: typeof r.summary === "string" ? r.summary : null,
    summaryFromCv: r.summaryFromCv === true,
    summaryReason: typeof r.summaryReason === "string" ? r.summaryReason : null,
    warnings: Array.isArray(r.warnings) ? r.warnings.map(String) : [],
  }
}

export async function verifyAtsClient(cv: CV, bundle: AtsBundle, signal?: AbortSignal): Promise<VerifyView> {
  let res: Response
  try {
    res = await fetch("/api/ats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", cv, summary: bundle.summary ?? undefined, pdf: bundle.pdf.base64, docx: bundle.docx.base64 }), signal })
  } catch (e) {
    throw new Error(friendly((e as Error).message))
  }
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error ?? "No se pudo verificar la versión ATS.")
  return j as VerifyView
}

/** Descarga un archivo ya generado (sin volver a pedirlo al servidor). */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
