import type { CV } from "@/lib/schemas/cv"
import type { AtsExtras } from "./enrich"
import type { VerifyView } from "./verify"

/** Cliente de `/api/ats`: genera la versión ATS (con el avance real por etapas), la verifica y guarda los archivos. */
export const ATS_STAGES = ["Leyendo a fondo tu CV y ordenando fechas", "Redactando el resumen", "Armando el PDF y el Word"] as const

export type AtsBundle = {
  pdf: { blob: Blob; name: string; base64: string }
  docx: { blob: Blob; name: string; base64: string }
  pages: number
  /** lo que la lectura profunda recuperó del texto original (se reenvía a verificar) */
  extras: AtsExtras | null
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

/** Lecturas profundas en curso, por CV: «Generar» espera a la que ya empezó al subir el CV en vez de lanzar otra (Ollama es uno solo). */
const inflight = new Map<string, Promise<AtsExtras | null>>()
const keyOf = (cv: CV, sourceText: string) => `${cv.header.fullName}|${sourceText.length}|${sourceText.slice(0, 64)}|${sourceText.slice(-64)}`

/** Pide la lectura profunda sin generar archivos. Devuelve null si no se pudo (sin IA, sin texto, sin conexión): la versión ATS sale igual, sin ese extra. */
export function readExtrasClient(cv: CV, sourceText: string): Promise<AtsExtras | null> {
  const key = keyOf(cv, sourceText)
  const hit = inflight.get(key)
  if (hit) return hit
  const p = fetch("/api/ats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", cv, sourceText }) })
    .then(async (res) => (res.ok ? ((await res.json()) as { extras?: AtsExtras }).extras ?? null : null))
    .catch(() => null)
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

export const pendingExtras = (cv: CV, sourceText: string | undefined): Promise<AtsExtras | null> | undefined => (sourceText ? inflight.get(keyOf(cv, sourceText)) : undefined)

export async function generateAtsClient(cv: CV, sourceText: string | undefined, onStage: (i: number) => void, signal?: AbortSignal, priorExtras?: AtsExtras | null): Promise<AtsBundle> {
  // Si la lectura profunda ya está en curso (se lanzó al subir el CV), se espera a esa en vez de repetirla.
  const waiting = priorExtras ? undefined : pendingExtras(cv, sourceText)
  if (waiting) priorExtras = await waiting
  let res: Response
  try {
    res = await fetch("/api/ats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate", cv, sourceText, extras: priorExtras ?? undefined }), signal })
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
    extras: r.extras && typeof r.extras === "object" ? (r.extras as AtsExtras) : null,
    summary: typeof r.summary === "string" ? r.summary : null,
    summaryFromCv: r.summaryFromCv === true,
    summaryReason: typeof r.summaryReason === "string" ? r.summaryReason : null,
    warnings: Array.isArray(r.warnings) ? r.warnings.map(String) : [],
  }
}

export async function verifyAtsClient(cv: CV, sourceText: string | undefined, bundle: AtsBundle, signal?: AbortSignal): Promise<VerifyView> {
  let res: Response
  try {
    res = await fetch("/api/ats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", cv, summary: bundle.summary ?? undefined, sourceText, extras: bundle.extras ?? undefined, pdf: bundle.pdf.base64, docx: bundle.docx.base64 }), signal })
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

/** Afinidad del archivo ORIGINAL con el formato ATS (para la etapa de validación). `null` = no se puede medir (otro formato o sin texto). */
export type OriginalAts = { percent: number; label: "listo" | "casi" | "cambios" | "esencial"; labelText: string }
export async function originalAtsClient(cv: CV, fileId: string, fileName: string, sourceText: string | undefined, signal?: AbortSignal): Promise<OriginalAts | null> {
  const res = await fetch("/api/ats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "original", cv, fileId, fileName, sourceText }), signal })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || typeof j.percent !== "number") return null
  return j as OriginalAts
}

/** CV ATS adaptado a UNA oferta (orden pensado para ella, sin inventar), ya verificado. */
export type TailoredAts = {
  cv: CV
  percent: number
  label: "listo" | "casi" | "cambios" | "esencial"
  labelText: string
  /** cumple el 90 % de formato ATS */
  meets90: boolean
  /** cobertura léxica de la oferta (0–100) */
  coverage: number
  moved: { skillsMoved: number; bulletsMoved: number }
  /** el resumen: `adapted` si lo reescribió la IA local para esta oferta; `hits` = lo que pide la oferta y ya dice el resumen; `reason` si se pidió y no se pudo */
  summary: { adapted: boolean; text: string | null; reason: string | null; hits: string[] }
  pages: number
  pdf: { blob: Blob; name: string; base64: string }
  docx: { blob: Blob; name: string; base64: string }
}
export async function tailorAtsClient(cv: CV, offer: unknown, sourceText: string | undefined, extras: AtsExtras | null | undefined, signal?: AbortSignal, opts: { adaptSummary?: boolean } = {}): Promise<TailoredAts> {
  let res: Response
  try {
    res = await fetch("/api/ats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "tailor", cv, offer, sourceText, extras: extras ?? undefined, adaptSummary: opts.adaptSummary }), signal })
  } catch (e) {
    throw new Error(friendly((e as Error).message))
  }
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error ?? "No se pudo crear el CV para esta oferta.")
  const file = (b64: unknown, name: unknown, type: string) => ({ blob: toBlob(String(b64), type), name: String(name), base64: String(b64) })
  return { cv: j.cv, percent: j.percent, label: j.label, labelText: j.labelText, meets90: !!j.meets90, coverage: j.coverage, moved: j.moved, summary: j.summary ?? { adapted: false, text: null, reason: null, hits: [] }, pages: Number(j.pages) || 1, pdf: file(j.pdf, j.pdfName, PDF), docx: file(j.docx, j.docxName, DOCX) }
}
