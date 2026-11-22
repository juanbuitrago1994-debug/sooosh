import { toneOf, type BodySettings, type Lang } from "@/lib/apply/body-settings"

/**
 * Guía de redacción que se le da al modelo local y reglas de estilo que revisa el verificador. Sale de `docs/CONOCIMIENTO-UX-CONTENT.md`
 * (cada regla cita su código `R-…` allí). Es corta a propósito: cada token extra cuesta segundos en el modelo local.
 */

/** R-C1, R-C14, R-E2, R-E4, R-E5, R-E7, R-T7, R-T8, R-G3, R-N11, R-N12. */
export const GUIDE_ES = `Guía de redacción (síguela):
- Primera frase: lo más importante (qué cargo y por qué encajas). No empieces con «Mi nombre es», «Le escribo para» ni «Me dirijo a».
- Frases cortas (15 a 20 palabras), una idea por frase, voz activa y verbos en vez de sustantivos («analicé», no «realicé un análisis de»).
- Palabras corrientes: «usar», no «utilizar»; «para», no «con el objetivo de». Evita «brindar», «en aras de», «a nivel de», «llevar a cabo».
- Sin exclamaciones, sin emojis y sin adjetivos de relleno («excelente oportunidad», «prestigiosa empresa», «proactivo»).
- No encadenes acciones con gerundios al final («..., desarrollando X y logrando Y»): usa verbos conjugados.
- No repitas el CV palabra por palabra: señala lo que encaja con la oferta.`

/** Un ejemplo corto por tono, SOLO de estilo (R-N28): sus datos no son los de la persona. */
const EXAMPLE_ES: Record<string, string> = {
  cercano: "Me gusta tomar decisiones de diseño a partir de lo que la gente necesita, y veo que buscan justo eso. Disfruto ordenar la investigación y llevarla a una interfaz clara.",
  profesional: "Mi trayectoria combina investigación y diseño de interfaces, y responde a los requisitos de la vacante. Puedo aportar un proceso ordenado, desde el análisis hasta la entrega.",
  directo: "Diseño interfaces y manejo las herramientas que piden. Mi perfil responde a los requisitos principales de la vacante.",
}

/** Versión mínima (sin ejemplo): solo lo que el modelo no hace solo según la medición. */
export const GUIDE_MIN_ES = `Estilo: primera frase con lo más importante; frases cortas y en voz activa; sin exclamaciones, sin adjetivos de relleno ni gerundios al final («..., desarrollando X»). Respeta la extensión pedida.`

/** Bloque que se agrega al sistema del modelo (solo español: la guía en inglés aún no se midió). `min`: la versión mínima. */
export function guideBlock(settings: BodySettings, lang: Lang, mode: "full" | "min" = "full"): string {
  if (lang !== "es") return ""
  if (mode === "min") return GUIDE_MIN_ES
  const example = EXAMPLE_ES[toneOf(settings) ?? ""]
  return example ? `${GUIDE_ES}\nEjemplo solo de estilo (sus datos NO son los tuyos; no los uses): «${example}»` : GUIDE_ES
}

const FILLER_ES = [
  "excelente oportunidad", "gran oportunidad", "prestigiosa empresa", "prestigiosa compañía", "en el mundo acelerado", "entendemos que", "a quien corresponda",
  "llevar a cabo", "con el objetivo de", "brindar", "en aras de", "a nivel de", "utilizar",
]
const FILLER_EN = ["exciting opportunity", "great opportunity", "prestigious company", "to whom it may concern", "utilize", "in today's fast-paced"]
const wordsIn = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

/** Problemas de estilo del texto (vacío = cumple la guía). Reglas R-T7, R-T8, R-C14, R-E2, R-G3, R-N11, R-N12. */
export function styleIssues(text: string, lang: Lang): string[] {
  const t = text.toLowerCase()
  const out: string[] = []
  if (/[!¡]/.test(text)) out.push("exclamación")
  if (/\p{Extended_Pictographic}/u.test(text)) out.push("emoji")
  if (lang === "en" ? /^\s*(my name is|i am writing to|i'm writing to)/i.test(text) : /^\s*(mi nombre es|le escribo|me dirijo|me pongo en contacto)/i.test(text)) out.push("apertura de relleno")
  if ((lang === "en" ? FILLER_EN : FILLER_ES).some((f) => t.includes(f))) out.push("frase de relleno")
  if (lang === "es" && /,\s*(?:desarrollando|obteniendo|logrando|consiguiendo|generando|permitiendo|aportando|creando|mejorando)\b/i.test(text)) out.push("gerundio de posterioridad")
  if (text.split(/(?<=[.!?])\s+|\n+/).some((s) => wordsIn(s) > 35)) out.push("frase larga")
  return out
}
