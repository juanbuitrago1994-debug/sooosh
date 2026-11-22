/**
 * Lo que la oferta pide en el correo de postulación, SIN IA («envía tu CV con aspiración salarial y disponibilidad»). Un correo que ignora esas
 * instrucciones suele descartarse, así que el panel de correo avisa y deja completarlas. Es conservador: cada dato necesita su frase clave y una
 * instrucción en la misma frase («envía», «indica», «incluye», «adjunta»…); «rango salarial» o «salario competitivo» NO cuentan (eso es lo que
 * ofrece la empresa, no lo que pide).
 */
export const ASK_KEYS = ["salario", "disponibilidad", "linkedin", "portafolio", "referencias"] as const
export type AskKey = (typeof ASK_KEYS)[number]

export const ASK_LABEL: Record<AskKey, string> = {
  salario: "Aspiración salarial",
  disponibilidad: "Disponibilidad",
  linkedin: "Perfil de LinkedIn",
  portafolio: "Portafolio",
  referencias: "Referencias",
}

const INSTRUCTION = /\b(?:env[ií]\w*|manda\w*|adjunt\w*|indic\w*|inclu[iy]\w*|especific\w*|mencion\w*|señal\w*|inform\w*|anot\w*|aport\w*|detall\w*|compart\w*|remit\w*|presenta\w*|postul\w*|interesad\w*|deber[aá]n?|debes|favor|con (?:tu|su|sus)|junto con|send|include|attach|provide|state|mention|share)\b/i

const PHRASES: Record<AskKey, RegExp> = {
  salario: /(?:aspiraci[oó]n(?:es)?|pretensi[oó]n(?:es)?|expectativa(?:s)?) (?:salarial(?:es)?|econ[oó]mic[ao]s?)|remuneraci[oó]n pretendida|salary expectations?|expected salary|desired salary/i,
  disponibilidad: /disponibilidad|fecha de inicio|cu[aá]ndo (?:puedes|podr[ií]as|podr[aá]s) (?:iniciar|empezar|comenzar)|availability|start date|notice period|preaviso/i,
  linkedin: /perfil de linkedin|linkedin profile|(?:enlace|link|url|v[ií]nculo) (?:a |de |con )?(?:tu |su )?linkedin|linkedin url/i,
  portafolio: /portafolio|portfolio|behance|dribbble|muestras? de (?:tu |su )?trabajo|work samples?|github/i,
  referencias: /referencias (?:laborales|personales|profesionales)?|cartas? de recomendaci[oó]n|references/i,
}

/** Las frases se separan por un punto seguido de espacio, salto de línea o punto y coma (el punto de un correo o enlace no corta). */
const sentences = (text: string) => text.split(/(?<=[.!?])\s+|[\n;]+/).map((s) => s.trim()).filter(Boolean)

export function detectAsks(text?: string | null): AskKey[] {
  if (!text) return []
  const found = new Set<AskKey>()
  for (const s of sentences(text)) {
    if (!INSTRUCTION.test(s)) continue
    for (const key of ASK_KEYS) if (PHRASES[key].test(s)) found.add(key)
  }
  return ASK_KEYS.filter((k) => found.has(k))
}
