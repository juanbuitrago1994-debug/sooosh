/**
 * Limpieza del texto salido de OCR: quita las líneas de ruido que Tesseract produce al leer
 * decoraciones, íconos o degradados (p. ej. `TT LIT TT TIAS SJ YJ`). Es determinista y solo ELIMINA
 * líneas; nunca modifica ni añade texto.
 */
const VOWEL = /[aeiouáéíóúüy]/i

/** Palabras cortas legítimas (es/en y siglas de diseño/producto): sin esto «de», «en», «mí» o «UI» contarían como ruido. */
const SHORT = new Set("a y de la el en un al lo se es me mi mí su ya no si ni to of in on at by or an as is it we do up ui ul ux qa pm ia ai ti".split(" "))

/** Una palabra "con pinta de palabra": solo letras, con vocal, ≥ 3 caracteres (o una palabra corta conocida). */
const STROKES = /^[ITLJFilj1|]+$/ // ruido típico de texturas: «III», «TIT», «LLL»
const isWordlike = (t: string) => (t.length < 3 ? SHORT.has(t.toLowerCase()) : true) && /^\p{L}+$/u.test(t) && VOWEL.test(t) && !STROKES.test(t)
const hasDigit = (t: string) => /\d/.test(t)

export function isNoiseLine(line: string): boolean {
  // Tokens con contenido: se ignoran viñetas y signos sueltos.
  const tokens = line.split(/\s+/).map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(Boolean)
  if (tokens.length === 0) return true
  const good = tokens.filter((t) => isWordlike(t) || hasDigit(t)).length
  // Líneas cortas (p. ej. «Seguros», «Ssr.»): solo se descartan si no tienen ni dos letras seguidas.
  if (tokens.length < 3) return good === 0 && !/\p{L}{2,}/u.test(tokens.join(" "))
  return good / tokens.length < 0.6
}

/** Tesseract lee «ñ» como «fi» en palabras muy comunes del español («disefiador», «afios»). Lista corta y segura: solo estas raíces. */
const N_TILDE: [RegExp, string][] = [
  [/\b(di|Di|DI)sefi(?=o|os|ar|ad|ador|adora|adores|adoras|ado|ada)/g, "$1señ"],
  [/\b([Aa])fi(os?)\b/g, "$1ñ$2"],
  [/\b(compa|Compa)fi(?=[ií]a|[ií]as|ero|era|eros|eras)/g, "$1ñ"],
  [/\b(ense|Ense)fi(?=ar|anza|ado|ada|[eé])/g, "$1ñ"],
  [/\b(peque|Peque)fi(?=o|a|os|as)/g, "$1ñ"],
  [/\b([Ss]e)fi(?=or|ora|al|ales|alizaci)/g, "$1ñ"],
]
/** Tesseract lee la «I» mayúscula de «UI» como «l» minúscula: «Ul». «Ul» solo no es una palabra en español ni en inglés; se corrige únicamente ese token exacto. */
const fixUi = (t: string) => t.replace(/\bUl\b/g, "UI")
const fixEnye = (t: string) => fixUi(N_TILDE.reduce((acc, [re, to]) => acc.replace(re, to), t))

export function cleanOcrText(text: string): string {
  return fixEnye(text)
    .split("\n")
    .filter((l) => l.trim() === "" || !isNoiseLine(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
