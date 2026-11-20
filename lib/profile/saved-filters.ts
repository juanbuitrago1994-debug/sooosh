import { useSyncExternalStore } from "react"
import { WORK_MODES } from "@/lib/jobs/draft"
import { isRegion } from "@/lib/jobs/region"

/**
 * «Mis filtros»: la configuración del buscador que la persona guarda para verla de una vez con un botón (o al abrir, si lo pide).
 * Vive solo en este navegador (sin cuentas, sin consentimiento: nunca sale de aquí). No guarda el texto buscado ni «solo guardadas».
 */
export const FILTERS_KEY = "sooosh:mis-filtros:v1"
const EVENT = "sooosh:mis-filtros-cambio"

export type SavedFilters = {
  region: string
  area: "tecnologia" | "todas"
  /** «» = todas las modalidades */
  mode: "" | (typeof WORK_MODES)[number]
  sort: "relevancia" | "recientes" | "encaje"
  onlyMatches: boolean
  /** aplicar estos filtros al abrir el buscador */
  auto: boolean
}

/** Valida lo leído del almacenamiento: cualquier campo raro descarta todo (mejor sin filtros que con filtros rotos). */
export function parseFilters(raw: unknown): SavedFilters | null {
  if (!raw || typeof raw !== "object") return null
  const d = raw as Record<string, unknown>
  if (typeof d.region !== "string" || !isRegion(d.region)) return null
  if (d.area !== "tecnologia" && d.area !== "todas") return null
  if (d.mode !== "" && !(WORK_MODES as readonly unknown[]).includes(d.mode)) return null
  if (d.sort !== "relevancia" && d.sort !== "recientes" && d.sort !== "encaje") return null
  return { region: d.region, area: d.area, mode: d.mode as SavedFilters["mode"], sort: d.sort, onlyMatches: d.onlyMatches === true, auto: d.auto === true }
}

/** ¿Son los mismos filtros? (ignora `auto`, que no es un filtro) */
export const sameFilters = (a: Omit<SavedFilters, "auto">, b: Omit<SavedFilters, "auto">) =>
  a.region === b.region && a.area === b.area && a.mode === b.mode && a.sort === b.sort && a.onlyMatches === b.onlyMatches

let cache: { raw: string | null; value: SavedFilters | null } = { raw: null, value: null }

export function getFilters(): SavedFilters | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(FILTERS_KEY)
  } catch {
    return null
  }
  if (raw === cache.raw) return cache.value
  let value: SavedFilters | null = null
  try {
    value = parseFilters(JSON.parse(raw ?? "null"))
  } catch {
    value = null
  }
  cache = { raw, value }
  return value
}

function write(f: SavedFilters | null): boolean {
  try {
    if (f) localStorage.setItem(FILTERS_KEY, JSON.stringify(f))
    else localStorage.removeItem(FILTERS_KEY)
    window.dispatchEvent(new Event(EVENT))
    return true
  } catch {
    return false
  }
}

/** Guarda los filtros actuales conservando la preferencia de «aplicar al abrir». Devuelve false si el navegador no deja guardar. */
export const saveFilters = (f: Omit<SavedFilters, "auto">): boolean => write({ region: f.region, area: f.area, mode: f.mode, sort: f.sort, onlyMatches: f.onlyMatches, auto: getFilters()?.auto ?? false })
export const clearFilters = (): boolean => write(null)
export function setAutoApply(auto: boolean): boolean {
  const cur = getFilters()
  return cur ? write({ ...cur, auto }) : false
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}
export const useSavedFilters = (): SavedFilters | null => useSyncExternalStore(subscribe, getFilters, () => null)
