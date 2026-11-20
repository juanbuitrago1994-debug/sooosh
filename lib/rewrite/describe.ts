import { termsIn } from "@/lib/keywords"
import { injectionTerms } from "@/lib/match/terms"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"
import type { Risk } from "./groups"

/** Todos los fragmentos de texto del CV (para citar evidencia exacta). */
function fragments(cv: CV): string[] {
  return [
    cv.summary ?? "",
    ...cv.experience.flatMap((e) => e.bullets),
    ...cv.projects.flatMap((p) => [p.description ?? "", ...p.bullets]),
    ...cv.skills.flatMap((g) => g.items),
  ].filter(Boolean)
}

/**
 * Motivo, evidencia y riesgo de una reformulación (determinista, sin gastar tokens del modelo).
 * Evidencia = el texto original + el fragmento del CV que respalda cada término de la oferta que se incorporó.
 */
export function describeChange(cv: CV, offer: Offer, original: string, proposed: string): { reason: string; evidence: string[]; risk: Risk } {
  const terms = injectionTerms(offer)
  const before = new Set(termsIn(original, terms).map((t) => t.key))
  const introduced = termsIn(proposed, terms).filter((t) => !before.has(t.key))
  const evidence = [original]
  for (const t of introduced) {
    const frag = fragments(cv).find((f) => termsIn(f, [t]).length > 0)
    if (frag && !evidence.includes(frag)) evidence.push(frag)
  }
  const ratio = original.length ? proposed.length / original.length : 1
  const risk: Risk = introduced.length <= 1 && ratio <= 1.35 ? "bajo" : introduced.length <= 2 && ratio <= 1.5 ? "medio" : "alto"
  const reason = introduced.length
    ? `Usa ${introduced.map((t) => `«${t.term}»`).join(" y ")}, que ya está en tu CV, para acercarlo a lo que pide la oferta.`
    : "Reordena y reformula lo que ya dices para que el resultado se lea primero, sin añadir nada nuevo."
  return { reason, evidence, risk }
}
