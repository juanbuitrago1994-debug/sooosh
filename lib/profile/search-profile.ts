import { useSyncExternalStore } from "react"
import type { AtsExtras } from "@/lib/ats/enrich"
import { cvSchema, type CV } from "@/lib/schemas/cv"

/**
 * PERFIL DE BÚSQUEDA: el CV con el que se compara cada oferta del buscador. Es una elección explícita de la persona y vive aparte de los
 * CV que va adaptando a cada oferta: optimizar un CV para una oferta no cambia lo que el buscador sabe de ella (si no, cada adaptación
 * movería sus recomendaciones). Hoy vive solo en este navegador; con cuentas de usuario pasará a la cuenta.
 */
export const SEARCH_PROFILE_KEY = "sooosh:perfil-busqueda:v1"
const EVENT = "sooosh:perfil-busqueda-cambio"

/** Estado de la versión ATS de este CV: se generó (`at`) y, si se verificó, si quedó «Validado». Se borra al cambiar de CV. */
export type AtsStatus = { at: string; validated?: boolean }

/** Datos del archivo del que salió el CV (para mostrar su tarjeta al volver): nombre, tipo (extensión), peso y lo que tardó la lectura. */
export type FileMeta = { name: string; type: string; size: number; readMs?: number }
/** Afinidad del archivo ORIGINAL con el formato ATS, medida al validar el CV (`null` = no se pudo medir). */
export type OriginalAtsSummary = { percent: number; label: "listo" | "casi" | "cambios" | "esencial"; labelText: string }

export type SearchProfile = {
  /** datos del archivo original */
  file?: FileMeta
  /** cuándo la persona terminó de validar este CV; sin esto, el CV está «sin validar». Se borra al cambiar de CV. */
  validatedAt?: string
  originalAts?: OriginalAtsSummary | null
  cv: CV
  /** nombre que se muestra («Ana Pérez · Product Designer») */
  label: string
  /** de qué archivo salió, para refrescarlo si se corrige ese mismo CV */
  fileId?: string
  /** texto original del CV (para que la versión ATS lo relea a fondo); solo en este navegador */
  sourceText?: string
  ats?: AtsStatus
  /** lectura profunda del CV para la versión ATS (A8): se hace al subir el CV y se reutiliza al generar */
  extras?: AtsExtras
  updatedAt: string
}

export const profileLabel = (cv: CV): string => [cv.header.fullName && cv.header.fullName !== "Sin nombre" ? cv.header.fullName : null, cv.header.headline].filter(Boolean).join(" · ") || "Tu CV"

function parseFile(f: unknown): FileMeta | undefined {
  const x = f as Partial<FileMeta> | null
  return x && typeof x.name === "string" && typeof x.type === "string" && typeof x.size === "number" ? { name: x.name, type: x.type, size: x.size, readMs: typeof x.readMs === "number" ? x.readMs : undefined } : undefined
}
function parseOriginalAts(a: unknown): OriginalAtsSummary | null | undefined {
  if (a === null) return null
  const x = a as Partial<OriginalAtsSummary> | undefined
  return x && typeof x.percent === "number" && typeof x.labelText === "string" && (x.label === "listo" || x.label === "casi" || x.label === "cambios" || x.label === "esencial") ? { percent: x.percent, label: x.label, labelText: x.labelText } : undefined
}

let cache: { raw: string | null; value: SearchProfile | null } = { raw: null, value: null }

/** Lectura con caché por texto: `useSyncExternalStore` exige devolver la MISMA referencia mientras nada cambie. */
export function getSearchProfile(): SearchProfile | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SEARCH_PROFILE_KEY)
  } catch {
    return null
  }
  if (raw === cache.raw) return cache.value
  let value: SearchProfile | null = null
  try {
    const d = JSON.parse(raw ?? "null") as Partial<SearchProfile> | null
    const cv = cvSchema.safeParse(d?.cv)
    if (d && cv.success) value = { cv: cv.data, label: typeof d.label === "string" ? d.label : profileLabel(cv.data), fileId: typeof d.fileId === "string" ? d.fileId : undefined, sourceText: typeof d.sourceText === "string" ? d.sourceText : undefined, extras: d.extras && typeof d.extras === "object" && Array.isArray((d.extras as AtsExtras).roles) ? (d.extras as AtsExtras) : undefined, ats: d.ats && typeof d.ats.at === "string" ? { at: d.ats.at, validated: typeof d.ats.validated === "boolean" ? d.ats.validated : undefined } : undefined, updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : "", file: parseFile(d.file), validatedAt: typeof d.validatedAt === "string" ? d.validatedAt : undefined, originalAts: parseOriginalAts(d.originalAts) }
  } catch {
    value = null
  }
  cache = { raw, value }
  return value
}

/** Tope del texto original que se guarda (suficiente para un CV largo y lejos del límite de localStorage). */
const MAX_SOURCE_TEXT = 40_000

export function setSearchProfile(cv: CV, fileId?: string, sourceText?: string, file?: FileMeta, keep?: Pick<SearchProfile, "originalAts">): boolean {
  try {
    const p: SearchProfile = { cv, label: profileLabel(cv), fileId, sourceText: sourceText ? sourceText.slice(0, MAX_SOURCE_TEXT) : undefined, file, originalAts: keep?.originalAts, updatedAt: new Date().toISOString() }
    localStorage.setItem(SEARCH_PROFILE_KEY, JSON.stringify(p))
    window.dispatchEvent(new Event(EVENT))
    return true
  } catch {
    return false
  }
}

/** Carga en este navegador el CV validado que viene de la cuenta (no trae el archivo ni su texto: nunca se guardan en la cuenta). */
export function hydrateSearchProfile(r: { cv: CV; label: string; file?: FileMeta; originalAts?: OriginalAtsSummary | null; fileId?: string; validatedAt: string }): boolean {
  try {
    const p: SearchProfile = { cv: r.cv, label: r.label || profileLabel(r.cv), file: r.file, originalAts: r.originalAts, fileId: r.fileId, validatedAt: r.validatedAt, updatedAt: r.validatedAt }
    localStorage.setItem(SEARCH_PROFILE_KEY, JSON.stringify(p))
    window.dispatchEvent(new Event(EVENT))
    return true
  } catch {
    return false
  }
}

/** Anota el estado de la versión ATS en el perfil guardado. No toca `updatedAt`: el panel no debe reiniciarse al marcar «generada» o «validada». */
export function setAtsStatus(status: AtsStatus): boolean {
  const cur = getSearchProfile()
  if (!cur) return false
  try {
    localStorage.setItem(SEARCH_PROFILE_KEY, JSON.stringify({ ...cur, ats: status }))
    window.dispatchEvent(new Event(EVENT))
    return true
  } catch {
    return false
  }
}

/** Guarda la lectura profunda en el perfil. Si se indica `fileId`, solo si sigue siendo el mismo CV (la persona pudo cambiarlo mientras se leía). No toca `updatedAt`. */
export function setProfileExtras(extras: AtsExtras, fileId?: string): boolean {
  const cur = getSearchProfile()
  if (!cur || (fileId !== undefined && cur.fileId !== fileId)) return false
  try {
    localStorage.setItem(SEARCH_PROFILE_KEY, JSON.stringify({ ...cur, extras }))
    window.dispatchEvent(new Event(EVENT))
    return true
  } catch {
    return false
  }
}

/** Marca el CV como validado (o quita la marca si la persona vuelve atrás). No toca `updatedAt`. */
export function setProfileValidated(validated: boolean): boolean {
  const cur = getSearchProfile()
  if (!cur || !!cur.validatedAt === validated) return !!cur
  try {
    const next = { ...cur, validatedAt: validated ? new Date().toISOString() : undefined }
    localStorage.setItem(SEARCH_PROFILE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(EVENT))
    return true
  } catch {
    return false
  }
}

/** Guarda la afinidad ATS del archivo original (solo si sigue siendo el mismo CV). No toca `updatedAt`. */
export function setOriginalAts(value: OriginalAtsSummary | null, fileId?: string): boolean {
  const cur = getSearchProfile()
  if (!cur || (fileId !== undefined && cur.fileId !== fileId)) return false
  try {
    localStorage.setItem(SEARCH_PROFILE_KEY, JSON.stringify({ ...cur, originalAts: value }))
    window.dispatchEvent(new Event(EVENT))
    return true
  } catch {
    return false
  }
}

export function clearSearchProfile() {
  try {
    localStorage.removeItem(SEARCH_PROFILE_KEY)
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* sin almacenamiento */
  }
}

/** Si la persona corrige el CV que ya es su perfil de búsqueda, el perfil se actualiza; los CV adaptados nunca lo tocan. */
export function refreshSearchProfile(cv: CV, fileId?: string) {
  const cur = getSearchProfile()
  if (cur && fileId && cur.fileId === fileId) setSearchProfile(cv, fileId, cur.sourceText, cur.file, { originalAts: cur.originalAts })
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}

/** El perfil de búsqueda en un componente (null en el servidor y mientras no exista). */
export function useSearchProfile(): SearchProfile | null {
  return useSyncExternalStore(subscribe, getSearchProfile, () => null)
}
