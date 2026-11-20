import { z } from "zod"
import { getProvider } from "@/lib/ai"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"
import { computeFit, type FitResult, type JudgedCriterion } from "./fit"
import type { MatchResult } from "@/lib/match/types"

/**
 * Juez local de los criterios cualitativos de la rúbrica (Fase K4): fórmula del resumen, estructura acción-contexto-resultado de los
 * logros y habilidades transversales demostradas. UNA sola llamada con salida JSON estricta. El modelo solo puede juzgar lo que
 * ve y debe copiar la cita literal; `computeFit` descarta cualquier cita que no esté textualmente en el CV.
 */
const verdict = z.enum(["cumple", "parcial", "no-cumple"])
export const judgeSchema = z.object({
  criteria: z.array(z.object({ criterion: z.enum(["resumen-formula", "logro-formula", "soft-demostradas"]), verdict, evidence: z.number().int().default(-1), note: z.string().max(240).default("") })),
})

/** Tiempo máximo de la llamada: un modelo pequeño puede divagar; sin juez la ficha se calcula igual con las reglas. */
export const JUDGE_TIMEOUT_MS = 90_000

export const JUDGE_SYSTEM = `Eres un revisor de hojas de vida. Evalúas SOLO con los fragmentos numerados que recibes; no inventas nada.
Para cada criterio responde {"criterion", "verdict": "cumple" | "parcial" | "no-cumple", "evidence": NÚMERO del fragmento que mejor respalda el veredicto (-1 si ninguno), "note": una frase en español}.
Criterios:
- resumen-formula: el resumen dice quién es (rol y años reales), en qué es fuerte y qué valor aporta, en 2 a 4 frases.
- logro-formula: las viñetas dicen qué hizo, cómo y con qué resultado (no solo tareas).
- soft-demostradas: las habilidades transversales que pide la oferta se demuestran con hechos del CV, no solo se declaran.
Si no hay fragmento que lo respalde, verdict "no-cumple" y evidence -1. Responde solo el JSON {"criteria":[...]}.`

/** Los fragmentos se numeran: el modelo señala un número y la cita sale del CV tal cual (así nunca es inventada). */
export function judgeInput(cv: CV, offer: Offer): { user: string; asked: JudgedCriterion["criterion"][]; fragments: string[] } {
  const fragments: string[] = []
  const numbered = (texts: string[]) => texts.map((t) => `[${fragments.push(t) - 1}] ${t}`).join("\n")
  const bullets = [...cv.experience.flatMap((e) => e.bullets), ...cv.projects.flatMap((p) => p.bullets)].slice(0, 12)
  const asked: JudgedCriterion["criterion"][] = []
  const parts: string[] = []
  if (cv.summary?.trim()) {
    asked.push("resumen-formula")
    parts.push(`RESUMEN DEL CV:\n${numbered(cv.summary.trim().split(/(?<=[.!?])\s+/).filter(Boolean))}`)
  }
  if (bullets.length) {
    asked.push("logro-formula")
    parts.push(`VIÑETAS DEL CV:\n${numbered(bullets)}`)
  }
  if (offer.softSkills?.length && bullets.length) {
    asked.push("soft-demostradas")
    parts.push(`HABILIDADES TRANSVERSALES QUE PIDE LA OFERTA: ${offer.softSkills.join(", ")}`)
  }
  return { user: `${parts.join("\n\n")}\n\nCriterios a evaluar: ${asked.join(", ")}`, asked, fragments }
}

export async function judgeCv(cv: CV, offer: Offer, signal?: AbortSignal): Promise<JudgedCriterion[]> {
  const { user, asked, fragments } = judgeInput(cv, offer)
  if (asked.length === 0) return []
  const limit = AbortSignal.timeout(JUDGE_TIMEOUT_MS)
  const { data } = await getProvider().generateStructured({ system: JUDGE_SYSTEM, user, schema: judgeSchema, signal: signal ? AbortSignal.any([signal, limit]) : limit, options: { numPredict: 400 } })
  return data.criteria
    .filter((c) => asked.includes(c.criterion))
    .map((c) => ({ criterion: c.criterion, verdict: c.verdict, evidence: fragments[c.evidence] ?? null, note: c.note || "Sin comentario del modelo." }))
}

/** Ficha completa con el juez local; si el modelo no responde, la ficha se calcula con las reglas y se avisa. */
export async function fitWithJudge(cv: CV, offer: Offer, opts: { match?: MatchResult; signal?: AbortSignal; judge?: typeof judgeCv; now?: Date; rawOfferText?: string } = {}): Promise<FitResult> {
  let judged: JudgedCriterion[] = []
  let warn: string | null = null
  try {
    judged = await (opts.judge ?? judgeCv)(cv, offer, opts.signal)
  } catch (e) {
    if ((e as Error).name === "AbortError" && opts.signal?.aborted) throw e
    warn = "El juez local no respondió: los criterios cualitativos quedaron sin evaluar."
  }
  const r = computeFit(cv, offer, { match: opts.match, judged, now: opts.now, rawOfferText: opts.rawOfferText })
  return warn ? { ...r, warnings: [...r.warnings, warn] } : r
}
