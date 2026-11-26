/** «hace 3 días», «hace 5 h»: tiempo transcurrido en español, sin dependencias. */
export function ago(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return ""
  const ms = now.getTime() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return ""
  const min = Math.max(0, Math.floor(ms / 60_000))
  if (min < 2) return "hace un momento"
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30) return `hace ${d} ${d === 1 ? "día" : "días"}`
  const m = Math.floor(d / 30)
  if (m < 12) return `hace ${m} ${m === 1 ? "mes" : "meses"}`
  const y = Math.floor(d / 365)
  return `hace ${y} ${y === 1 ? "año" : "años"}`
}

/** Agrupa por empresa (clave sin tildes ni mayúsculas); el grupo «sin empresa» va al final y los demás por lo más reciente. */
export function groupByCompany<T extends { company: string | null; savedAt: string }>(items: T[], keyOf: (c: string | null) => string): { key: string; name: string; items: T[] }[] {
  const map = new Map<string, { key: string; name: string; items: T[] }>()
  for (const it of items) {
    const key = keyOf(it.company)
    const g = map.get(key) ?? { key, name: it.company?.trim() || "Sin empresa", items: [] }
    g.items.push(it)
    map.set(key, g)
  }
  const latest = (g: { items: T[] }) => Math.max(...g.items.map((i) => new Date(i.savedAt).getTime()))
  return [...map.values()].sort((a, b) => (a.key === "" ? 1 : b.key === "" ? -1 : latest(b) - latest(a)))
}
