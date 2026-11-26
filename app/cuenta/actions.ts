"use server"

import { revalidatePath } from "next/cache"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { DELETE_PHRASE } from "@/lib/account/constants"
import { deleteAuthUser } from "@/lib/auth/admin"
import { clearSessionCookies, getCurrentUser, getSession } from "@/lib/auth/session"
import type { ProfileFormState } from "@/lib/auth/profile-store"
import { persistProfile } from "@/lib/auth/profile-store"
import { trustedDevices } from "@/lib/db/schema"
import { getDb } from "@/lib/db"
import { withDb } from "@/lib/db/resilient"
import { deactivateActiveCv, getActiveCv, saveValidatedCv, type StoredCv } from "@/lib/cv-store/store"
import { cvSchema } from "@/lib/schemas/cv"

/** Todas las acciones toman a la persona de la sesión verificada (nunca de lo que envíe el navegador) y no hacen nada sin sesión. */

const storedSchema = z.object({
  cv: cvSchema,
  label: z.string().max(300),
  file: z.object({ name: z.string().max(300), type: z.string().max(20), size: z.number().nonnegative(), readMs: z.number().nonnegative().optional() }).optional(),
  originalAts: z.object({ percent: z.number().min(0).max(100), label: z.enum(["listo", "casi", "cambios", "esencial"]), labelText: z.string().max(200) }).nullable().optional(),
  fileId: z.string().max(200).optional(),
  validatedAt: z.string().datetime(),
})

/** La persona de la sesión y el CV activo de su cuenta (para cargarlo en un dispositivo que no lo tiene). */
export async function pullCv(): Promise<{ userId: string; cv: StoredCv | null } | null> {
  const user = await getCurrentUser()
  if (!user) return null
  return { userId: user.id, cv: await withDb((db) => getActiveCv(db, user.id)) }
}

/** Guarda el CV validado. Devuelve si se guardó. */
export async function pushCv(input: unknown): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  const parsed = storedSchema.safeParse(input)
  if (!parsed.success) return false
  try {
    await saveValidatedCv(getDb(), user.id, parsed.data)
    return true
  } catch (e) {
    console.error("[cv-store] no se pudo guardar", e)
    return false
  }
}

/** La persona pidió cambiar de CV: el actual deja de ser el activo. */
export async function clearCv(): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  try {
    await deactivateActiveCv(getDb(), user.id)
    return true
  } catch (e) {
    console.error("[cv-store] no se pudo desactivar", e)
    return false
  }
}

/** Quién es la persona (para el menú de cuenta). `null` sin sesión. El nombre ya viene con la sesión: no cuesta otro viaje a la base. */
export async function whoAmI(): Promise<{ name: string; email: string } | null> {
  const session = await getSession()
  if (!session) return null
  return { name: session.profile?.name ?? session.user.googleName, email: session.user.email }
}

/** Ajustes: edita nombre, país y cargos (los mismos datos del registro). */
export async function updateProfile(_prev: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  const user = await getCurrentUser()
  if (!user) return { error: "Tu sesión terminó. Vuelve a entrar." }
  const r = await persistProfile(user.id, form)
  if (r.saved) revalidatePath("/ajustes")
  return r
}

/** Cierra la sesión de otro dispositivo de la misma persona (o de este: entonces la persona vuelve al login). */
export async function revokeDevice(deviceId: string): Promise<{ ok: boolean; self?: boolean }> {
  const user = await getCurrentUser()
  if (!user || !z.string().uuid().safeParse(deviceId).success) return { ok: false }
  const rows = await getDb().update(trustedDevices).set({ revokedAt: new Date().toISOString() }).where(and(eq(trustedDevices.id, deviceId), eq(trustedDevices.userId, user.id), isNull(trustedDevices.revokedAt))).returning({ id: trustedDevices.id })
  if (rows.length > 0) revalidatePath("/ajustes")
  return { ok: rows.length > 0, self: deviceId === user.deviceId }
}

/** Borra la cuenta y TODOS sus datos (perfil, CV, ofertas, dispositivos). Exige escribir la palabra de confirmación. Irreversible. */
export async function deleteMyAccount(confirmation: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser()
  if (!user || confirmation.trim().toUpperCase() !== DELETE_PHRASE) return { ok: false }
  try {
    if (!(await deleteAuthUser(user.id))) return { ok: false }
  } catch (e) {
    console.error("[cuenta] borrado", e)
    return { ok: false }
  }
  await clearSessionCookies()
  return { ok: true }
}
