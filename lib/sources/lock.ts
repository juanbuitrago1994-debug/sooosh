import { sql } from "drizzle-orm"
import type { Db } from "@/lib/db"

/**
 * Candado por tabla con vencimiento: la corrida que lo toma lo conserva hasta `ttlMinutes`; si muere sin soltarlo, caduca solo.
 * `insert … on conflict do update … where locked_until < now()` es atómico: solo una de dos corridas simultáneas lo obtiene.
 */
export async function acquireLock(db: Db, holder: string, ttlMinutes = 90, name = "sync"): Promise<boolean> {
  const res = await db.execute(sql`
    insert into public.sync_locks (name, holder, locked_until) values (${name}, ${holder}, now() + make_interval(mins => ${ttlMinutes}))
    on conflict (name) do update set holder = excluded.holder, locked_until = excluded.locked_until where public.sync_locks.locked_until < now()
    returning holder`)
  const rows = Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])
  return rows.length > 0
}

export async function releaseLock(db: Db, holder: string, name = "sync"): Promise<void> {
  await db.execute(sql`delete from public.sync_locks where name = ${name} and holder = ${holder}`)
}
