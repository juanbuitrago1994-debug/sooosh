import { useSyncExternalStore } from "react"

/**
 * Ofertas guardadas y descartadas por la persona (en este navegador). Las descartadas dejan de aparecer en el buscador; las guardadas se
 * pueden ver con «Solo mis guardadas». Con consentimiento, además se registran como señal para ordenar mejor.
 */
export const MARKS_KEY = "sooosh:marcas-ofertas:v1"
const EVENT = "sooosh:marcas-cambio"
const MAX = 500

type Marks = { saved: string[]; dismissed: string[] }
const EMPTY: Marks = { saved: [], dismissed: [] }
let cache: { raw: string | null; value: Marks } = { raw: null, value: EMPTY }

export function getMarks(): Marks {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(MARKS_KEY)
  } catch {
    return EMPTY
  }
  if (raw === cache.raw) return cache.value
  let value = EMPTY
  try {
    const d = JSON.parse(raw ?? "null") as Partial<Marks> | null
    const ids = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === "string").slice(-MAX) : [])
    if (d) value = { saved: ids(d.saved), dismissed: ids(d.dismissed) }
  } catch {
    value = EMPTY
  }
  cache = { raw, value }
  return value
}

function write(m: Marks) {
  try {
    localStorage.setItem(MARKS_KEY, JSON.stringify({ saved: m.saved.slice(-MAX), dismissed: m.dismissed.slice(-MAX) }))
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* sin almacenamiento */
  }
}

/** Guarda o quita de guardadas. Devuelve el estado nuevo (true = guardada). */
export function toggleSaved(id: string): boolean {
  const m = getMarks()
  const has = m.saved.includes(id)
  write({ saved: has ? m.saved.filter((x) => x !== id) : [...m.saved, id], dismissed: m.dismissed.filter((x) => x !== id) })
  return !has
}

/** Suma a las guardadas de este navegador las que vienen de la cuenta (sin quitar ninguna ni tocar las descartadas). */
export function mergeSaved(ids: string[]) {
  const m = getMarks()
  const add = ids.filter((id) => !m.saved.includes(id) && !m.dismissed.includes(id))
  if (add.length) write({ saved: [...m.saved, ...add], dismissed: m.dismissed })
}

export function dismissJob(id: string) {
  const m = getMarks()
  write({ saved: m.saved.filter((x) => x !== id), dismissed: m.dismissed.includes(id) ? m.dismissed : [...m.dismissed, id] })
}

export function restoreJob(id: string) {
  const m = getMarks()
  write({ saved: m.saved, dismissed: m.dismissed.filter((x) => x !== id) })
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}
export const useMarks = (): Marks => useSyncExternalStore(subscribe, getMarks, () => EMPTY)
