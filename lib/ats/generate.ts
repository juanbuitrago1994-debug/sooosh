import type { AIProvider } from "@/lib/ai"
import type { CV } from "@/lib/schemas/cv"
import type { AtsLang } from "./headings"
import { buildAtsDoc, type AtsDoc } from "./model"
import { generateSummary, type SummaryResult } from "./summary"

export type AtsGeneration = { doc: AtsDoc; summary: SummaryResult | null }

/**
 * Orquesta la versión ATS: el documento lo arma el código; la IA local solo propone el resumen cuando el CV no trae uno (y solo si pasa la
 * verificación). `ai: false` genera sin IA (plantilla pura).
 */
export async function generateAts(cv: CV, opts: { lang?: AtsLang; ai?: boolean; provider?: AIProvider; now?: Date; signal?: AbortSignal; /** avance real: 0 = ordenar, 1 = redactar el resumen (solo si hace falta) */ onStage?: (i: 0 | 1) => void } = {}): Promise<AtsGeneration> {
  opts.onStage?.(0)
  const base = buildAtsDoc(cv, { lang: opts.lang })
  if (base.summarySource === "cv" || opts.ai === false) return { doc: base, summary: null }
  opts.onStage?.(1)
  const summary = await generateSummary(cv, base.lang, { provider: opts.provider, now: opts.now, signal: opts.signal })
  return { doc: summary.summary ? buildAtsDoc(cv, { lang: opts.lang, summary: summary.summary }) : base, summary }
}
