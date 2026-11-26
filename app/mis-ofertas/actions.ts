"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { offerSchema } from "@/lib/schemas/offer"
import { probeOfferLink } from "@/lib/tracking/liveness"
import { createCollection, deleteCollection, moveOffer, removeJobOffer, renameCollection, saveJobAsOffer, savedJobIds, setNote } from "@/lib/tracking/collections"
import { checkOne, removeTrackedOffer, saveTrackedOffer } from "@/lib/tracking/store"

const input = z.object({ url: z.string().url().max(1200), offer: offerSchema, text: z.string().min(1).max(24_000), postedAt: z.string().max(40).optional(), validThrough: z.string().max(40).optional() })

export type TrackResult = { ok: true; created: boolean } | { ok: false; reason: "session" | "invalid" | "limit" | "error" }

/** Guarda la oferta analizada (completa) en la cuenta y la deja bajo seguimiento. La persona sale de la sesión verificada. */
export async function trackOffer(raw: unknown): Promise<TrackResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, reason: "session" }
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: "invalid" }
  try {
    const db = getDb()
    const r = await saveTrackedOffer(db, user.id, parsed.data)
    if ("error" in r) return { ok: false, reason: r.error === "limit" ? "limit" : "invalid" }
    // Primera revisión del enlace sin hacer esperar a la persona.
    if (r.created) after(() => checkOne(db, r.id, (u) => probeOfferLink(u)).catch((e) => console.error("[tracking] primera revisión", e)))
    revalidatePath("/mis-ofertas")
    return { ok: true, created: r.created }
  } catch (e) {
    console.error("[tracking] no se pudo guardar", e)
    return { ok: false, reason: "error" }
  }
}

/** Quita una oferta de «Mis ofertas». */
export async function removeOffer(id: string): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user || !z.string().uuid().safeParse(id).success) return false
  const ok = await removeTrackedOffer(getDb(), user.id, id).catch(() => false)
  if (ok) revalidatePath("/mis-ofertas")
  return ok
}

const uuid = z.string().uuid()
const refresh = () => revalidatePath("/mis-ofertas")

export type CollectionActionResult = { ok: true } | { ok: false; reason: "session" | "invalid" | "limit" | "duplicate" | "error" }

async function asUser<T>(fn: (userId: string) => Promise<T>, fallback: T): Promise<T> {
  const user = await getCurrentUser()
  if (!user) return fallback
  try {
    return await fn(user.id)
  } catch (e) {
    console.error("[mis-ofertas]", e)
    return fallback
  }
}

/** Crea una categoría con el nombre que la persona quiera. */
export async function addCollection(name: string): Promise<CollectionActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, reason: "session" }
  const r = await createCollection(getDb(), user.id, String(name)).catch(() => null)
  if (!r) return { ok: false, reason: "error" }
  if ("error" in r) return { ok: false, reason: r.error }
  refresh()
  return { ok: true }
}

export async function editCollection(id: string, name: string): Promise<CollectionActionResult> {
  const user = await getCurrentUser()
  if (!user || !uuid.safeParse(id).success) return { ok: false, reason: "session" }
  const r = await renameCollection(getDb(), user.id, id, String(name)).catch(() => null)
  if (!r) return { ok: false, reason: "error" }
  if ("error" in r) return { ok: false, reason: r.error }
  refresh()
  return { ok: true }
}

/** Borra la categoría; sus ofertas quedan «sin categoría». */
export async function removeCollection(id: string): Promise<boolean> {
  const ok = uuid.safeParse(id).success && (await asUser((u) => deleteCollection(getDb(), u, id), false))
  if (ok) refresh()
  return ok
}

/** Mueve una oferta a una categoría (`null` = sin categoría). */
export async function moveOfferTo(offerId: string, collectionId: string | null): Promise<boolean> {
  if (!uuid.safeParse(offerId).success || (collectionId !== null && !uuid.safeParse(collectionId).success)) return false
  const ok = await asUser((u) => moveOffer(getDb(), u, offerId, collectionId), false)
  if (ok) refresh()
  return ok
}

export async function saveNote(offerId: string, note: string): Promise<boolean> {
  if (!uuid.safeParse(offerId).success) return false
  const ok = await asUser((u) => setNote(getDb(), u, offerId, String(note)), false)
  if (ok) refresh()
  return ok
}

/** Guarda en la cuenta una oferta del buscador (copia completa) y la deja bajo seguimiento. */
export async function saveJobOffer(jobId: string): Promise<{ ok: boolean; reason?: "limit" | "not_found" | "session" | "error" }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, reason: "session" }
  if (!uuid.safeParse(jobId).success) return { ok: false, reason: "not_found" }
  try {
    const db = getDb()
    const r = await saveJobAsOffer(db, user.id, jobId)
    if ("error" in r) return { ok: false, reason: r.error }
    if (r.created) after(() => checkOne(db, r.id, (u) => probeOfferLink(u)).catch((e) => console.error("[tracking] primera revisión", e)))
    refresh()
    return { ok: true }
  } catch (e) {
    console.error("[mis-ofertas] guardar del buscador", e)
    return { ok: false, reason: "error" }
  }
}

export async function unsaveJobOffer(jobId: string): Promise<boolean> {
  if (!uuid.safeParse(jobId).success) return false
  const ok = await asUser((u) => removeJobOffer(getDb(), u, jobId), false)
  if (ok) refresh()
  return ok
}

/**
 * Sincroniza las guardadas de este navegador con la cuenta: las que aún no están se guardan (máx. 40 por vez) y se devuelven TODAS las de la cuenta,
 * para que el marcador del buscador salga marcado en cualquier dispositivo.
 */
export async function syncSavedJobs(localIds: string[]): Promise<string[] | null> {
  const user = await getCurrentUser()
  if (!user) return null
  try {
    const db = getDb()
    const have = new Set(await savedJobIds(db, user.id))
    const ids = [...new Set(localIds.filter((i) => uuid.safeParse(i).success))].filter((i) => !have.has(i)).slice(0, 40)
    for (const id of ids) {
      const r = await saveJobAsOffer(db, user.id, id)
      if (!("error" in r)) have.add(id)
      else if (r.error === "limit") break
    }
    return [...have]
  } catch (e) {
    console.error("[mis-ofertas] sincronizar guardadas", e)
    return null
  }
}
