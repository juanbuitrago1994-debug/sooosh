import { asc, eq, sql } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { sources } from "@/lib/db/schema"

/**
 * Catálogo de fuentes (tabla `sources`): lo que se muestra de cada fuente (nombre, sitio, descripción, atribución) y dos mandos de
 * operación —interruptor «activa» y cadencia propia— que se cambian sin publicar código. El adaptador sigue en el código y se enlaza
 * por la clave (el id de la fuente en la sincronización). Si la tabla no existe o está vacía, todo cae a los valores del código.
 */
export type CatalogRow = {
  key: string
  name: string
  kind: "Plataforma" | "Empresas" | "Portal" | "Remotas"
  homeUrl: string | null
  description: string
  attribution: string
  /** null = la cadencia por defecto del código */
  cadenceHours: number | null
  active: boolean
  termsReviewedOn: string | null
}

export async function listCatalog(db: Db): Promise<CatalogRow[]> {
  try {
    const rows = await db.select().from(sources).orderBy(asc(sources.createdAt), asc(sources.key))
    return rows.map((r) => ({ key: r.key, name: r.name, kind: r.kind as CatalogRow["kind"], homeUrl: r.homeUrl, description: r.description, attribution: r.attribution, cadenceHours: r.cadenceHours, active: r.active, termsReviewedOn: r.termsReviewedOn }))
  } catch {
    return [] // sin tabla (entorno sin migrar): la sincronización sigue con los valores del código
  }
}

/** Pausa o reanuda una fuente. Devuelve false si la clave no existe. */
export async function setSourceActive(db: Db, key: string, active: boolean): Promise<boolean> {
  const r = await db.update(sources).set({ active, updatedAt: sql`now()` }).where(eq(sources.key, key)).returning({ key: sources.key })
  return r.length > 0
}

/** Cadencia propia en horas (1–168) o null para volver a la del código. */
export async function setSourceCadence(db: Db, key: string, hours: number | null): Promise<boolean> {
  if (hours !== null && (!Number.isInteger(hours) || hours < 1 || hours > 168)) return false
  const r = await db.update(sources).set({ cadenceHours: hours, updatedAt: sql`now()` }).where(eq(sources.key, key)).returning({ key: sources.key })
  return r.length > 0
}

/** Cadencia efectiva y si la fuente está activa (sin fila = activa y con la cadencia del código). */
export function effective(row: CatalogRow | undefined, codeEveryHours: number): { everyHours: number; active: boolean } {
  return { everyHours: row?.cadenceHours ?? codeEveryHours, active: row?.active ?? true }
}
