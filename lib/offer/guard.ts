import { fold, stem } from "@/lib/keywords/normalize"

/**
 * Capa 3: guardia anti-invención. Una frase de la salida del modelo solo se acepta si existe en el texto fuente:
 * como subcadena (sin tildes, mayúsculas ni signos) o, si el modelo la reordenó un poco, si casi todas sus
 * palabras significativas aparecen en la fuente.
 */
const norm = (s: string) =>
  fold(s)
    .replace(/[^\p{L}\p{N}+#./]+/gu, " ")
    .replace(/(^|\s)[./]+|[./]+(?=\s|$)/g, " ") // puntos y barras sueltos al borde de una palabra
    .replace(/\s+/g, " ")
    .trim()

const words = (s: string) =>
  norm(s)
    .split(" ")
    .filter((w) => w.length > 2)
    .map(stem)

export type GuardResult = { ok: boolean; /** fracción de palabras significativas halladas en la fuente */ score: number }

export function existsInSource(phrase: string, source: string, threshold = 0.85): GuardResult {
  const p = norm(phrase)
  if (!p) return { ok: false, score: 0 }
  const s = norm(source)
  if (s.includes(p)) return { ok: true, score: 1 }
  const sw = new Set(words(source))
  const pw = words(phrase)
  if (pw.length === 0) return { ok: false, score: 0 }
  const hit = pw.filter((w) => sw.has(w)).length
  const score = hit / pw.length
  return { ok: score >= threshold, score }
}

/** Separa una lista en las frases que existen en la fuente y las que no (descartadas). */
export function guardList(items: string[], source: string): { kept: string[]; dropped: string[] } {
  const kept: string[] = []
  const dropped: string[] = []
  for (const it of items) (existsInSource(it, source).ok ? kept : dropped).push(it)
  return { kept, dropped }
}
