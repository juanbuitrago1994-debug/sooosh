import { useSyncExternalStore } from "react"
import { CONSENT_VERSION, type EventKind, type EventPayload } from "./types"

/**
 * Consentimiento de medición del navegador (docs/CONSENTIMIENTO.md). Todo vive en localStorage; el servidor guarda su propia copia de la decisión
 * y vuelve a comprobarla en cada envío. Sin consentimiento vigente, `track` no hace nada.
 */
export const CONSENT_KEY = "sooosh:consentimiento:v1"
const EVENT = "sooosh:consentimiento-cambio"
const WEEK = 7 * 24 * 3_600_000

export type ConsentState = {
  /** versión del texto que se aceptó o rechazó; si cambia, se vuelve a preguntar */
  version: string | null
  personal: boolean
  aggregate: boolean
  /** identificador aleatorio (solo existe si alguna vez se aceptó algo) */
  anonId: string | null
  decidedAt: string | null
  /** cuándo se hizo la primera búsqueda (el consentimiento se pide después) */
  firstSearchAt: number | null
  /** cuántas veces se cerró la franja sin elegir, y hasta cuándo no se vuelve a mostrar */
  dismissed: number
  snoozeUntil: number | null
}

const EMPTY: ConsentState = { version: null, personal: false, aggregate: false, anonId: null, decidedAt: null, firstSearchAt: null, dismissed: 0, snoozeUntil: null }
let cache: { raw: string | null; value: ConsentState } = { raw: null, value: EMPTY }

export function getConsent(): ConsentState {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(CONSENT_KEY)
  } catch {
    return EMPTY
  }
  if (raw === cache.raw) return cache.value
  let value = EMPTY
  try {
    const d = JSON.parse(raw ?? "null") as Partial<ConsentState> | null
    if (d && typeof d === "object") {
      value = {
        version: typeof d.version === "string" ? d.version : null,
        personal: d.personal === true,
        aggregate: d.aggregate === true,
        anonId: typeof d.anonId === "string" && /^[0-9a-f-]{36}$/i.test(d.anonId) ? d.anonId : null,
        decidedAt: typeof d.decidedAt === "string" ? d.decidedAt : null,
        firstSearchAt: typeof d.firstSearchAt === "number" ? d.firstSearchAt : null,
        dismissed: typeof d.dismissed === "number" ? d.dismissed : 0,
        snoozeUntil: typeof d.snoozeUntil === "number" ? d.snoozeUntil : null,
      }
    }
  } catch {
    value = EMPTY
  }
  cache = { raw, value }
  return value
}

function save(next: ConsentState) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* sin almacenamiento: no se mide nada */
  }
}

const decided = (c: ConsentState) => c.version === CONSENT_VERSION
export const consentActive = (c: ConsentState) => decided(c) && !!c.anonId && (c.personal || c.aggregate)

/** ¿Hay que mostrar la franja ahora? Tras la primera búsqueda, si no hay decisión vigente y no está en pausa (1 vez a la semana siguiente, luego no insiste). */
export function shouldAsk(c: ConsentState, now?: number): boolean {
  if (decided(c) || c.firstSearchAt === null) return false
  if (c.dismissed === 0) return true
  // La hora solo se lee cuando hace falta (y nunca durante el prerenderizado, donde no hay consentimiento ni primera búsqueda).
  if (c.dismissed === 1) return c.snoozeUntil !== null && (now ?? Date.now()) >= c.snoozeUntil
  return false
}

export function markFirstSearch() {
  const c = getConsent()
  if (c.firstSearchAt === null) save({ ...c, firstSearchAt: Date.now() })
}

/** Cerró la franja sin elegir. */
export function dismissAsk() {
  const c = getConsent()
  save({ ...c, dismissed: c.dismissed + 1, snoozeUntil: Date.now() + WEEK })
}

async function postConsent(anonId: string, personal: boolean, aggregate: boolean): Promise<boolean> {
  try {
    const r = await fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anonId, personal, aggregate }) })
    return r.ok
  } catch {
    return false
  }
}

/** Guarda la decisión. Si acepta algo, nace el identificador aleatorio y el servidor registra la decisión; si rechaza todo, no se envía nada (salvo que ya hubiera una aceptación, que se revoca). */
export async function decide(personal: boolean, aggregate: boolean): Promise<boolean> {
  const c = getConsent()
  const anyYes = personal || aggregate
  const anonId = c.anonId ?? (anyYes ? crypto.randomUUID() : null)
  if (anonId && (anyYes || c.anonId)) {
    const ok = await postConsent(anonId, personal, aggregate)
    if (!ok && anyYes) return false // no se activa la medición si el servidor no pudo registrar el permiso
  }
  save({ ...c, version: CONSENT_VERSION, personal, aggregate, anonId, decidedAt: new Date().toISOString(), dismissed: 0, snoozeUntil: null })
  return true
}

/** «Borrar mis datos»: borra en el servidor todo lo del identificador y deja al navegador sin consentimiento ni identificador. */
export async function eraseMyData(): Promise<boolean> {
  const c = getConsent()
  if (c.anonId) {
    try {
      const r = await fetch("/api/events", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anonId: c.anonId }) })
      if (!r.ok) return false
    } catch {
      return false
    }
  }
  save({ ...EMPTY, firstSearchAt: c.firstSearchAt, version: CONSENT_VERSION, decidedAt: new Date().toISOString() })
  return true
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}
export const useConsent = (): ConsentState => useSyncExternalStore(subscribe, getConsent, () => EMPTY)

// ── envío de eventos: en lotes pequeños, y nunca sin consentimiento vigente
type Queued = { kind: EventKind; payload: Record<string, unknown> }
const queue: Queued[] = []
let timer: ReturnType<typeof setTimeout> | null = null

async function flush(retry = true) {
  const c = getConsent()
  const batch = queue.splice(0, 50)
  if (batch.length === 0 || !consentActive(c)) return
  try {
    const r = await fetch("/api/events", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anonId: c.anonId, events: batch }) })
    // El servidor perdió la decisión (p. ej. base reiniciada): se la volvemos a registrar y se reintenta una vez.
    if (r.status === 403 && retry && c.anonId && (await postConsent(c.anonId, c.personal, c.aggregate))) {
      queue.unshift(...batch)
      await flush(false)
    }
  } catch {
    /* sin red: se pierde este lote; medir no debe molestar al usuario */
  }
}

/** Registra un evento de uso. **No hace nada** si la persona no aceptó. */
export function track<K extends EventKind>(kind: K, payload: EventPayload<K>) {
  if (typeof window === "undefined" || !consentActive(getConsent())) return
  queue.push({ kind, payload: payload as Record<string, unknown> })
  if (queue.length >= 20) void flush()
  else if (!timer) {
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, 1500)
  }
}
