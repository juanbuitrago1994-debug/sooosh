import { z } from "zod"

/**
 * Eventos de uso que se pueden registrar (solo con consentimiento; ver docs/CONSENTIMIENTO.md). Cada tipo tiene una lista CERRADA de campos:
 * lo que no esté aquí se descarta, así que ni por error llegan datos personales a la base.
 */
export const CONSENT_VERSION = "2026-11-19"
export const RETENTION_DAYS = 90
/** Una búsqueda o tendencia solo se muestra si la hicieron al menos tantos identificadores distintos. */
export const MIN_DISTINCT_USERS = 5

const uuid = z.string().uuid()
const region = z.string().regex(/^[A-Z]{2,10}$/)

export const EVENT_SCHEMAS = {
  search: z.object({
    region,
    area: z.enum(["tecnologia", "todas"]),
    mode: z.enum(["remoto", "hibrido", "presencial"]).nullish(),
    sort: z.enum(["relevancia", "recientes", "encaje"]),
    onlyMatches: z.boolean(),
    /** texto normalizado; si parece un dato personal, el saneado lo deja en null */
    q: z.string().max(60).nullish(),
    results: z.number().int().min(0).max(200),
  }),
  impressions: z.object({ jobIds: z.array(uuid).min(1).max(60) }),
  open: z.object({ jobId: uuid, position: z.number().int().min(0).max(200).nullish(), score: z.number().int().min(0).max(100).nullish(), match: z.boolean().nullish() }),
  apply_click: z.object({ jobId: uuid, method: z.enum(["plataforma", "formulario", "correo", "sitio", "desconocido"]) }),
  adapt_cv: z.object({ jobId: uuid }),
  save: z.object({ jobId: uuid, saved: z.boolean() }),
  dismiss: z.object({ jobId: uuid }),
} as const

export type EventKind = keyof typeof EVENT_SCHEMAS
export type EventPayload<K extends EventKind> = z.infer<(typeof EVENT_SCHEMAS)[K]>

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/
const URL_LIKE = /https?:\/\/|www\.|\b[\w-]+\.(com|co|cl|ar|mx|net|org|io)\b/i
const LONG_DIGITS = /\d{5,}|(\d[\s.-]?){7,}/

/**
 * Texto de búsqueda que se puede guardar: minúsculas, sin tildes, espacios simples, ≤ 60 caracteres y SIN señales de dato personal
 * (correo, enlace, números largos, parecido a un teléfono o documento). Si no pasa, devuelve null y el evento se guarda sin texto.
 */
export function sanitizeQuery(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()
  if (t.length < 2 || t.length > 60) return null
  if (EMAIL.test(t) || URL_LIKE.test(t) || LONG_DIGITS.test(t)) return null
  if (t.split(" ").length > 8) return null // una frase larga puede contener nombres o datos
  return t
}

export type IncomingEvent = { kind: EventKind; payload: Record<string, unknown> }

/** Valida y limpia un evento: solo los campos de su tipo, el texto saneado. null si no es válido. */
export function cleanEvent(e: { kind?: unknown; payload?: unknown }): IncomingEvent | null {
  if (typeof e.kind !== "string" || !(e.kind in EVENT_SCHEMAS)) return null
  const kind = e.kind as EventKind
  const base = (e.payload ?? {}) as Record<string, unknown>
  const input = kind === "search" ? { ...base, q: sanitizeQuery(typeof base.q === "string" ? base.q : null) } : base
  const r = EVENT_SCHEMAS[kind].safeParse(input)
  return r.success ? { kind, payload: r.data as Record<string, unknown> } : null
}
