import type { AffinityRow } from "./server"

/** Peso de cada acción en el gusto de la persona. Descartar resta. */
const WEIGHT: Record<string, number> = { open: 1, save: 3, adapt_cv: 3, apply_click: 4, dismiss: -3 }
/** Con menos señales que estas no se personaliza (no hay base para opinar). */
export const MIN_SIGNALS = 3

type Affinity = { family: Map<string, number>; company: Map<string, number>; signals: number }

export function buildAffinity(rows: AffinityRow[]): Affinity {
  const family = new Map<string, number>()
  const company = new Map<string, number>()
  let signals = 0
  for (const r of rows) {
    const w = (WEIGHT[r.kind] ?? 0) * r.n
    signals += r.n
    if (r.family) family.set(r.family, (family.get(r.family) ?? 0) + w)
    if (r.company) company.set(r.company.toLowerCase(), (company.get(r.company.toLowerCase()) ?? 0) + w)
  }
  return { family, company, signals }
}

const squash = (x: number) => Math.tanh(x / 4) // −1…1, saturando

/**
 * Reordena SUAVEMENTE una lista (ya ordenada por relevancia) según lo que la persona ha hecho: sube las familias de cargo y las
 * empresas que abre, guarda o a las que postula, y baja las que descarta. El orden original pesa más que el gusto (0,35 y 0,15 de
 * ajuste como máximo): una búsqueda concreta sigue mandando.
 */
export function personalize<T extends { roleFamily?: string | null; company?: string | null }>(jobs: T[], rows: AffinityRow[]): T[] {
  const a = buildAffinity(rows)
  if (a.signals < MIN_SIGNALS || jobs.length < 2) return jobs
  const n = jobs.length
  return jobs
    .map((j, i) => {
      const base = (n - i) / n
      const f = j.roleFamily ? squash(a.family.get(j.roleFamily) ?? 0) : 0
      const c = j.company ? squash(a.company.get(j.company.toLowerCase()) ?? 0) : 0
      return { j, score: base + 0.35 * f + 0.15 * c, i }
    })
    .sort((x, y) => y.score - x.score || x.i - y.i)
    .map((x) => x.j)
}
