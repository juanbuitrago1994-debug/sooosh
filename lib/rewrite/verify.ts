import { termsIn } from "@/lib/keywords"
import { injectionTerms } from "@/lib/match/terms"
import { fold, stem } from "@/lib/keywords/normalize"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"

export type ViolationKind = "number" | "date" | "name" | "offer-term" | "length" | "format"
export type Violation = { kind: ViolationKind; value: string; message: string }
export type Verification = { ok: boolean; violations: Violation[] }

const NUMBER_WORDS = new Set(
  `uno dos tres cuatro cinco seis siete ocho nueve diez once doce quince veinte treinta cuarenta cincuenta cien ciento mil millon millones
   one two three four five six seven eight nine ten eleven twelve fifteen twenty thirty forty fifty hundred thousand million
   doble duplicar duplico duplicamos triple triplicar triplico doubled tripled`.split(/\s+/),
)
const MULTIPLY = /^(dupli[cq]|tripl|cuadrupl|doubl)/
const MONTHS = new Set(
  `enero febrero marzo abril mayo junio julio agosto septiembre setiembre octubre noviembre diciembre
   january february march april june july august september october november december`.split(/\s+/),
)

// Misma forma de "palabra" que el motor de palabras clave: C++, C#, Node.js, CI/CD, front-end.
const TOKEN_RE = /\.?[\p{L}\p{N}]+(?:[.+#/_-][\p{L}\p{N}]+)*[+#]*/gu
const NUMBER_RE = /\d+(?:[.,]\d+)*/g

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out))
  else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out))
  return out
}

/** Todo el texto que escribió el usuario en su CV: la única fuente de verdad. */
export function cvCorpus(cv: CV | string): string {
  return typeof cv === "string" ? cv : strings(cv).join("\n")
}

const norm = (w: string) => stem(fold(w))
const numKeys = (n: string) => [n.replace(",", "."), n.replace(/[.,]/g, "")]

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean)
}

/**
 * Comprueba, de forma determinista, que un texto reescrito no contiene datos nuevos:
 *  - cifras, años y números escritos con letras que no estén en el CV;
 *  - meses que no estén en el CV;
 *  - nombres propios, siglas y tecnologías (empresas, cargos, herramientas) que no estén en el CV;
 *  - con `opts.offer`: términos de la oferta que el CV no menciona (ni con sinónimos).
 * `original` puede ser el CV o su texto.
 */
export function verifyNoInvention(original: CV | string, rewritten: string, opts: { offer?: Offer } = {}): Verification {
  const corpus = cvCorpus(original)
  const violations: Violation[] = []
  const add = (kind: ViolationKind, value: string, message: string) => {
    if (!violations.some((v) => v.kind === kind && v.value === value)) violations.push({ kind, value, message })
  }

  if (!rewritten.trim()) add("format", "", "El texto reescrito está vacío.")

  // 1) Cifras y fechas
  const known = new Set((corpus.match(NUMBER_RE) ?? []).flatMap(numKeys))
  for (const n of rewritten.match(NUMBER_RE) ?? []) {
    if (!numKeys(n).some((k) => known.has(k))) add("number", n, `La cifra «${n}» no aparece en tu CV.`)
  }

  // 2) Números con letras, "doble/triple" y meses
  const corpusWords = new Set([...corpus.matchAll(TOKEN_RE)].map((m) => fold(m[0])))
  for (const m of rewritten.matchAll(TOKEN_RE)) {
    const w = fold(m[0])
    if ((NUMBER_WORDS.has(w) || MULTIPLY.test(w)) && !corpusWords.has(w)) add("number", m[0], `«${m[0]}» sugiere una cantidad que no aparece en tu CV.`)
    if (MONTHS.has(w) && !corpusWords.has(w)) add("date", m[0], `El mes «${m[0]}» no aparece en tu CV.`)
  }

  // 3) Nombres propios, siglas y tecnologías
  const known2 = new Set([...corpus.matchAll(TOKEN_RE)].map((m) => norm(m[0])))
  for (const sentence of sentences(rewritten)) {
    ;[...sentence.matchAll(TOKEN_RE)].forEach((m, i) => {
      const raw = m[0]
      const w = fold(raw)
      if (/^\d+$/.test(raw) || NUMBER_WORDS.has(w) || MONTHS.has(w) || MULTIPLY.test(w)) return // ya se reportan arriba
      const technical = /\p{Lu}.*\p{Lu}|\d|[.+#/]/u.test(raw.replace(/^\./, "")) || /^\./.test(raw)
      const capitalized = /^\p{Lu}\p{Ll}/u.test(raw) && i > 0 // la primera palabra de la frase va en mayúscula sin ser nombre propio
      if ((technical || capitalized) && !known2.has(norm(raw))) add("name", raw, `«${raw}» no aparece en tu CV.`)
    })
  }

  // 4) Palabras clave de la oferta que el CV no menciona
  if (opts.offer) {
    const terms = injectionTerms(opts.offer)
    const inRewrite = termsIn(rewritten, terms)
    const inCv = new Set(termsIn(corpus, inRewrite).map((t) => t.key))
    for (const t of inRewrite) {
      if (!inCv.has(t.key)) add("offer-term", t.term, `«${t.term}» es un término de la oferta que tu CV no menciona.`)
    }
  }

  return { ok: violations.length === 0, violations }
}

/** Tope de longitud: reformular no debería sumar frases nuevas. */
export function lengthViolation(original: string, rewritten: string): Violation | null {
  const max = Math.max(original.length * 1.5, original.length + 60)
  return rewritten.length > max
    ? { kind: "length", value: String(rewritten.length), message: "La propuesta es mucho más larga que el original (suma contenido nuevo)." }
    : null
}
