/**
 * Asunto del correo que pide una oferta, SIN IA («en el asunto: Diseñador UX», «con el asunto "REF-123"», «subject: …»).
 * Es conservador: si el texto solo da una instrucción («indica el cargo en el asunto») no hay asunto y se devuelve `undefined`.
 * Mejor vacío que equivocado: el panel de correo prellena una plantilla cuando no hay asunto detectado.
 */
const MAX_LEN = 100

const OPEN = "[\"“«'‘]"
const CLOSE = "[\"”»'’]"
const TRIGGER = String.raw`(?:(?:con|en|como|bajo)\s+(?:el\s+)?asunto|asunto|subject(?:\s+line)?|t[ií]tulo del (?:correo|e-?mail|mensaje))`

/** Asunto entre comillas justo tras el disparador: «en el asunto "X"», «con asunto: «X»». */
const QUOTED_AFTER = new RegExp(`${TRIGGER}\\s*[:\\-–—]?\\s*${OPEN}([^"”»'’\\n]{3,${MAX_LEN}})${CLOSE}`, "i")
/** Asunto entre comillas justo antes del disparador: «"X" como asunto», ««X» en el asunto». */
const QUOTED_BEFORE = new RegExp(`${OPEN}([^"”»'’\\n]{3,${MAX_LEN}})${CLOSE}\\s*(?:como|en el|en)\\s+asunto`, "i")
/** Asunto sin comillas: solo con dos puntos tras el disparador («Asunto: Diseñador UX/UI»). */
const COLON = new RegExp(`${TRIGGER}\\s*:\\s*([^\\n]{3,${MAX_LEN * 2}})`, "i")
/** Código de referencia que piden poner en el asunto: «incluye la referencia DIS-123 en el asunto». */
const REF = /(?:referencia|ref\.?|c[oó]digo)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\-_/.]{2,30}\d[A-Za-z0-9\-_/.]*)[^.\n]{0,40}?\ben el asunto/i

/** Palabras de una instrucción, no de un asunto («el cargo», «tu nombre»…). */
const INSTRUCTION = /^(?:(?:el|la|los|las|tu|su|un|una|del|de la|de tu|lo)\s+|(?:cargo|nombre|puesto|vacante|posici[oó]n|referencia|c[oó]digo|t[ií]tulo)\b)/i

function clean(raw: string): string | undefined {
  let s = raw.replace(/\s+/g, " ").trim()
  // Corta en la primera frase: un punto seguido de espacio, «;», o el inicio de otra instrucción («… y adjunta tu CV»).
  s = s.split(/\.(?:\s|$)|;|\s+(?:y|e|o)\s+(?:tu|tus|el|la|adjunt\w*|env\w*|incl\w*|escrib\w*)\b/i)[0]
  s = s.replace(/^[\s"“«'‘\-–—]+|[\s"”»'’\-–—.,:]+$/g, "")
  if (s.length < 3 || s.length > MAX_LEN || !/\p{L}/u.test(s)) return undefined
  if (INSTRUCTION.test(s)) return undefined
  return s
}

export function detectSubject(text?: string | null): string | undefined {
  if (!text) return undefined
  const quoted = text.match(QUOTED_AFTER)?.[1] ?? text.match(QUOTED_BEFORE)?.[1]
  if (quoted) return clean(quoted)
  const ref = text.match(REF)?.[1]
  if (ref) return clean(ref)
  const colon = text.match(COLON)?.[1]
  return colon ? clean(colon) : undefined
}

/** Marcadores de plantilla que dejan algunas ofertas («[Tu nombre]», «{cargo}», «(nombre)»). */
const PLACEHOLDER = /[[{(]\s*(tu\s+nombre|nombre(?:\s+completo)?|nombre y apellido|cargo|puesto|vacante|posici[oó]n)\s*[\]})]/gi

/** Reemplaza los marcadores con datos reales; si falta el dato, el marcador queda y `pending` lo dice (nunca se inventa). */
export function fillSubject(subject: string, data: { name?: string; title?: string }): { text: string; pending: boolean } {
  let pending = false
  const text = subject.replace(PLACEHOLDER, (m, key: string) => {
    const k = key.toLowerCase()
    const value = /nombre/.test(k) ? data.name : data.title
    if (value?.trim()) return value.trim()
    pending = true
    return m
  })
  return { text, pending }
}
