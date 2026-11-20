import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"

/** Base de Supabase (Postgres): memoria de preferencias y ofertas. Sirve para el driver real y para PGlite en las pruebas. */
export type Db = PgDatabase<PgQueryResultHKT>

export class DbConfigError extends Error {}

// En desarrollo, Next recarga los módulos: la conexión se guarda en globalThis para no abrir una nueva en cada recarga.
const g = globalThis as { __sooosh_db?: Db }

/**
 * Conexión a Supabase por el «Transaction pooler» (puerto 6543, de ahí `prepare: false`). Solo servidor: la cadena trae la
 * contraseña de la base y vive en `.env.local` (DATABASE_URL).
 */
export function getDb(): Db {
  if (g.__sooosh_db) return g.__sooosh_db
  const url = process.env.DATABASE_URL
  if (!url) throw new DbConfigError("Falta DATABASE_URL en .env.local (cadena «Transaction pooler» de Supabase).")
  const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 15 })
  g.__sooosh_db = drizzle(client)
  return g.__sooosh_db
}
