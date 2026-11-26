"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { offerSchema } from "@/lib/schemas/offer"
import { probeOfferLink } from "@/lib/tracking/liveness"
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
