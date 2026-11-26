import { and, asc, desc, eq, notInArray, sql } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { cvs } from "@/lib/db/schema"
import type { FileMeta, OriginalAtsSummary } from "@/lib/profile/search-profile"
import type { CV } from "@/lib/schemas/cv"

/** Cuántos CV guarda cada persona (el activo y su historial reciente). */
export const MAX_SAVED_CVS = 10

/** Lo que viaja entre el navegador y la cuenta: el CV ya validado y los datos para reconocerlo. Nunca el archivo original ni su texto. */
export type StoredCv = {
  cv: CV
  label: string
  file?: FileMeta
  originalAts?: OriginalAtsSummary | null
  /** id local del archivo del que salió */
  fileId?: string
  /** ISO 8601 */
  validatedAt: string
}

const toIso = (s: string) => new Date(/[zZ]|[+-]\d\d(:?\d\d)?$/.test(s) ? s : `${s}Z`).toISOString()

/** El CV activo de la persona, o `null`. */
export async function getActiveCv(db: Db, userId: string): Promise<StoredCv | null> {
  const [r] = await db.select().from(cvs).where(and(eq(cvs.userId, userId), eq(cvs.isActive, true))).limit(1)
  if (!r) return null
  return {
    cv: r.cv as CV,
    label: r.label,
    file: (r.file as FileMeta | null) ?? undefined,
    originalAts: r.originalAts === null ? undefined : (r.originalAts as OriginalAtsSummary),
    fileId: r.fileId ?? undefined,
    validatedAt: toIso(r.validatedAt),
  }
}

/**
 * Guarda un CV validado como el activo. Si es el MISMO archivo que el activo (misma `fileId`: la persona lo corrigió y lo validó otra vez) se
 * actualiza esa fila; si no, el activo pasa al historial y se crea uno nuevo. El historial se recorta a `MAX_SAVED_CVS`.
 */
export async function saveValidatedCv(db: Db, userId: string, input: StoredCv): Promise<void> {
  const values = {
    cv: input.cv,
    label: input.label,
    file: input.file ?? null,
    originalAts: input.originalAts === undefined ? null : input.originalAts,
    fileId: input.fileId ?? null,
    validatedAt: input.validatedAt,
    updatedAt: sql`now()`,
  }
  await db.transaction(async (tx) => {
    const [active] = await tx.select({ id: cvs.id, fileId: cvs.fileId }).from(cvs).where(and(eq(cvs.userId, userId), eq(cvs.isActive, true))).limit(1)
    if (active && input.fileId && active.fileId === input.fileId) {
      await tx.update(cvs).set(values).where(eq(cvs.id, active.id))
    } else {
      if (active) await tx.update(cvs).set({ isActive: false }).where(eq(cvs.id, active.id))
      await tx.insert(cvs).values({ userId, isActive: true, ...values })
    }
    const keep = await tx.select({ id: cvs.id }).from(cvs).where(eq(cvs.userId, userId)).orderBy(desc(cvs.isActive), desc(cvs.updatedAt)).limit(MAX_SAVED_CVS)
    await tx.delete(cvs).where(and(eq(cvs.userId, userId), notInArray(cvs.id, keep.map((k) => k.id))))
  })
}

/** La persona dejó de usar su CV (pidió cambiarlo): el activo pasa al historial y no se vuelve a cargar solo en otros dispositivos. */
export async function deactivateActiveCv(db: Db, userId: string): Promise<void> {
  await db.update(cvs).set({ isActive: false }).where(and(eq(cvs.userId, userId), eq(cvs.isActive, true)))
}

/** Solo para pruebas y futura pantalla de Ajustes: todos los CV de la persona, el activo primero. */
export async function listCvs(db: Db, userId: string) {
  return db.select({ id: cvs.id, label: cvs.label, isActive: cvs.isActive, validatedAt: cvs.validatedAt }).from(cvs).where(eq(cvs.userId, userId)).orderBy(desc(cvs.isActive), asc(cvs.createdAt))
}
