import { z } from "zod"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

/**
 * Historial de adaptaciones. Vive SOLO en este navegador (localStorage): sin servidor, sin cuentas.
 * Cada entrada guarda lo necesario para volver a descargar el PDF y para reabrir la revisión.
 */
export const HISTORY_KEY = "cv-tailor:history:v1"
export const HISTORY_EVENT = "cv-tailor:history-changed"
export const MAX_ENTRIES = 50

const decisionSchema = z.object({ status: z.enum(["pending", "accepted", "rejected"]), edited: z.string().optional() })
const itemSchema = z.object({
  id: z.string(),
  label: z.string(),
  original: z.string(),
  proposed: z.string(),
  status: z.enum(["changed", "unchanged", "kept"]),
  reasons: z.array(z.string()).optional(),
  kind: z.enum(["cambiar", "quitar", "añadir"]).optional(),
  section: z.string().optional(),
  reason: z.string().optional(),
  evidence: z.array(z.string()).optional(),
  risk: z.enum(["bajo", "medio", "alto"]).optional(),
})

export const historyEntrySchema = z.object({
  id: z.string().min(1),
  /** ISO 8601 */
  createdAt: z.string(),
  offerText: z.string(),
  offer: offerSchema,
  /** CV de partida (el perfil), para poder reabrir la revisión. */
  originalCv: cvSchema,
  /** CV exportado: solo lo aceptado. Con esto se regenera el PDF. */
  cv: cvSchema,
  review: z.object({ items: z.array(itemSchema), decisions: z.record(z.string(), decisionSchema) }),
  lang: z.enum(["es", "en"]),
  /** Cobertura de palabras clave (0–100) antes y después de aplicar lo aceptado. */
  coverageBefore: z.number().min(0).max(100),
  coverageAfter: z.number().min(0).max(100),
  acceptedChanges: z.number().int().min(0),
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>
export type NewHistoryEntry = Omit<HistoryEntry, "id" | "createdAt">

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">

function browserStore(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null // modo privado o almacenamiento bloqueado
  }
}

/** Lee y valida el texto guardado; lo corrupto o de otra versión se ignora entrada por entrada. */
export function parseHistory(raw: string | null): HistoryEntry[] {
  if (!raw) return []
  try {
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list.flatMap((e) => {
      const r = historyEntrySchema.safeParse(e)
      return r.success ? [r.data] : []
    })
  } catch {
    return []
  }
}

export function readRaw(store: Store | null = browserStore()): string | null {
  try {
    return store?.getItem(HISTORY_KEY) ?? null
  } catch {
    return null
  }
}

function write(list: HistoryEntry[], store: Store | null): boolean {
  if (!store) return false
  try {
    if (list.length === 0) store.removeItem(HISTORY_KEY)
    else store.setItem(HISTORY_KEY, JSON.stringify(list))
    if (typeof window !== "undefined") window.dispatchEvent(new Event(HISTORY_EVENT))
    return true
  } catch {
    return false // cuota llena o bloqueado
  }
}

const fingerprint = (e: Pick<HistoryEntry, "cv" | "offerText">) => JSON.stringify([e.cv, e.offerText])

/**
 * Guarda una adaptación (la más reciente primero). Si ya existe una idéntica (mismo CV final y misma oferta),
 * la actualiza en vez de duplicarla. Devuelve la entrada guardada o null si no se pudo escribir.
 */
export function addEntry(entry: NewHistoryEntry, store: Store | null = browserStore(), now = new Date()): HistoryEntry | null {
  const list = parseHistory(readRaw(store))
  const prev = list.find((e) => fingerprint(e) === fingerprint(entry))
  const saved: HistoryEntry = { ...entry, id: prev?.id ?? crypto.randomUUID(), createdAt: now.toISOString() }
  const next = [saved, ...list.filter((e) => e.id !== saved.id)].slice(0, MAX_ENTRIES)
  return write(next, store) ? saved : null
}

export function removeEntry(id: string, store: Store | null = browserStore()): boolean {
  return write(parseHistory(readRaw(store)).filter((e) => e.id !== id), store)
}

export function clearHistory(store: Store | null = browserStore()): boolean {
  return write([], store)
}
