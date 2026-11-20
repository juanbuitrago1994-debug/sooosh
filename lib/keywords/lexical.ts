import { tokenize } from "./normalize"
import { SYNONYM_GROUPS } from "./synonyms"

/** Coincidencia léxica: flujo de claves sin tildes ni plurales, frases contiguas y equivalencias es/en (tabla versionada). */
export type Stream = string[][]

/** Texto → trozos de claves. Se quitan solo los conectores "de"; las demás palabras se conservan para no unir términos distintos. */
export function streamOf(text: string): Stream {
  return tokenize(text).map((chunk) => chunk.filter((t) => t.cls !== "soft").map((t) => t.key))
}

const variantKeys = (variant: string) => streamOf(variant).flat()

/** clave de frase → todas sus variantes equivalentes (incluida ella misma). */
const SYNONYM_INDEX: Map<string, string[][]> = (() => {
  const index = new Map<string, string[][]>()
  for (const group of SYNONYM_GROUPS) {
    const variants = group.map(variantKeys)
    for (const g of group) {
      const noHard = tokenize(g).flatMap((c) => c.filter((t) => t.cls === "content").map((t) => t.key)).join(" ")
      index.set(noHard, variants)
      index.set(variantKeys(g).join(" "), variants)
    }
  }
  return index
})()

export const synonymsOf = (key: string): string[][] => SYNONYM_INDEX.get(key) ?? []

/** ¿La frase (lista de claves) aparece contigua dentro de algún trozo del flujo? */
export function containsKeys(s: Stream, phrase: string[]): boolean {
  if (!phrase.length) return false
  return s.some((chunk) => {
    for (let i = 0; i + phrase.length <= chunk.length; i++) {
      if (phrase.every((k, j) => chunk[i + j] === k)) return true
    }
    return false
  })
}

/** Claves de contenido de un texto (sin conectores ni palabras de relleno). */
export function contentKeys(text: string): string[] {
  return tokenize(text).flatMap((c) => c.filter((t) => t.cls === "content").map((t) => t.key))
}

/** De los términos `{ key }`, los que aparecen en el texto (con sinónimos). */
export function termsIn<T extends { key: string }>(text: string, terms: T[]): T[] {
  const s = streamOf(text)
  return terms.filter((t) => [t.key.split(" "), ...synonymsOf(t.key)].some((v) => containsKeys(s, v)))
}
