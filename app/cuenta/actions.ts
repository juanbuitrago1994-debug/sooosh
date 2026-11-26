"use server"

import { z } from "zod"
import { getCurrentUser } from "@/lib/auth/session"
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

/** El CV activo de la cuenta (para cargarlo en un dispositivo que no lo tiene). */
export async function pullCv(): Promise<StoredCv | null> {
  const user = await getCurrentUser()
  if (!user) return null
  return withDb((db) => getActiveCv(db, user.id))
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
