import { addEntry, parseHistory, readRaw, removeEntry, type HistoryEntry } from "@/lib/history"
import { lexicalCoverage } from "@/lib/match/engine"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"
import type { TailoredAts } from "./client"

/**
 * Guarda en el repositorio de CV por oferta el CV ATS que se generó para ella. Hay UNO por oferta (mismo título y empresa): generarlo de nuevo
 * reemplaza al anterior. Sin revisión de cambios (p. ej. desde el detalle de la oferta) la revisión queda vacía.
 */
export function saveAtsEntry(a: { offer: Offer; offerText: string; originalCv: CV; tailored: TailoredAts; review?: HistoryEntry["review"]; acceptedChanges?: number }): HistoryEntry | null {
  for (const e of parseHistory(readRaw())) if (e.ats && e.offer.title === a.offer.title && (e.offer.company ?? "") === (a.offer.company ?? "")) removeEntry(e.id)
  return addEntry({
    offerText: a.offerText,
    offer: a.offer,
    originalCv: a.originalCv,
    cv: a.tailored.cv,
    review: a.review ?? { items: [], decisions: {} },
    lang: a.offer.language === "en" ? "en" : "es",
    coverageBefore: lexicalCoverage(a.originalCv, a.offer),
    coverageAfter: a.tailored.coverage,
    acceptedChanges: a.acceptedChanges ?? 0,
    ats: { percent: a.tailored.percent },
  })
}
