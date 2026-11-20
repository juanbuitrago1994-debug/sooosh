import { sql } from "drizzle-orm"
import type { Db } from "@/lib/db"

/**
 * Vencimiento de ofertas que las fuentes parciales nunca cierran por «dejar de aparecer» (portales y fuentes remotas se leen por trozos):
 *  · vigencia declarada vencida (`valid_through` pasado);
 *  · fuentes remotas: no vistas en 21 días (se vuelven a leer cada día);
 *  · portales: más de 60 días desde que se publicaron (solo se leen las nuevas, así que no se «ven» de nuevo).
 * Las ofertas cerradas no se borran: dejan de mostrarse y se pueden reabrir si la fuente las vuelve a traer.
 */
export const REMOTE_STALE_DAYS = 21
export const PORTAL_MAX_AGE_DAYS = 60

export async function expireStale(db: Db): Promise<{ vencidas: number; remotas: number; portales: number }> {
  const count = (r: unknown) => (Array.isArray(r) ? r.length : ((r as { rowCount?: number }).rowCount ?? 0))
  const vencidas = count(await db.execute(sql`update public.jobs set status = 'cerrada' where status = 'activa' and valid_through is not null and valid_through < now() returning id`))
  const remotas = count(await db.execute(sql`update public.jobs set status = 'cerrada' where status = 'activa' and source_key like 'remote:%' and coalesce(last_seen_at, created_at) < now() - make_interval(days => ${REMOTE_STALE_DAYS}) returning id`))
  const portales = count(await db.execute(sql`update public.jobs set status = 'cerrada' where status = 'activa' and source_key like 'portal:%' and coalesce(posted_at, created_at) < now() - make_interval(days => ${PORTAL_MAX_AGE_DAYS}) returning id`))
  return { vencidas, remotas, portales }
}
