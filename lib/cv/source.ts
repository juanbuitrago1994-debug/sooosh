import { cvCorpus } from "@/lib/rewrite/verify"
import type { CV } from "@/lib/schemas/cv"

/**
 * FUENTE DE VERDAD inmutable: el texto y el CV tal como se leyeron del archivo. Nada puede modificarlos
 * (están congelados). La guardia anti-invención compara contra esto, no contra el CV editable.
 */
export type Source = { readonly text: string; readonly cv: CV }

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") {
    Object.values(o as object).forEach(deepFreeze)
    Object.freeze(o)
  }
  return o
}

export function freezeSource(text: string, cv: CV): Source {
  return deepFreeze({ text, cv: structuredClone(cv) })
}

function strings(v: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof v === "string") out.add(v.trim())
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out))
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out))
  return out
}

/**
 * Texto contra el que se verifica toda reescritura: el original (texto + CV leído) más lo que el propio usuario
 * añadió o corrigió a mano (esos datos son suyos, pero se distinguen de lo que escribe el modelo).
 */
export function guardCorpus(source: Source | null, current: CV): string {
  if (!source) return cvCorpus(current)
  const original = strings(source.cv)
  const added = [...strings(current)].filter((s) => s && !original.has(s))
  return [source.text, cvCorpus(source.cv), ...added].join("\n")
}
