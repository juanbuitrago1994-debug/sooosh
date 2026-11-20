import type { OfferTerm } from "./terms"
import type { Unit } from "./units"

/**
 * cubierto: el CV lo dice con las mismas palabras · otro-nombre: lo dice con otras palabras (sinónimo o idioma distinto)
 * reformulable: hay algo relacionado en el CV que se puede reescribir con las palabras de la oferta
 * ausente: no existe en el CV → BRECHA (jamás se inventa)
 */
export type MatchStatus = "cubierto" | "otro-nombre" | "reformulable" | "ausente"

export type Evidence = Pick<Unit, "id" | "section" | "text">

export type TermMatch = {
  term: OfferTerm
  status: MatchStatus
  /** 1 si hubo coincidencia léxica; si no, la similitud semántica (0–1) con la mejor evidencia */
  score: number
  how: "lexico" | "semantico" | "ninguno"
  evidence: Evidence[]
  /** frase corta, en español, que explica el estado */
  explanation: string
}

export type MatchResult = {
  /** 0–100, ponderado: obligatorio > deseable; cubierto y otro nombre = 1, reformulable = 0,5 */
  coverage: number
  terms: TermMatch[]
  groups: { fit: TermMatch[]; reformulable: TermMatch[]; gaps: TermMatch[] }
  method: "semantico" | "lexico"
  model?: string
  warnings: string[]
  timings: Record<string, number>
}
