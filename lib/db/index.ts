import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"

/** Base de Supabase (Postgres): memoria de preferencias y ofertas. Sirve para el driver real y para PGlite en las pruebas. */
export type Db = PgDatabase<PgQueryResultHKT>

export class DbConfigError extends Error {}

// En desarrollo, Next recarga los módulos: la conexión se guarda en globalThis para no abrir una nueva en cada recarga.
const g = globalThis as { __sooosh_db?: Db; __sooosh_client?: ReturnType<typeof postgres> }

/**
 * Conexión a Supabase por el «Transaction pooler» (puerto 6543, de ahí `prepare: false`). Solo servidor: la cadena trae la
 * contraseña de la base y vive en `.env.local` (DATABASE_URL).
 */
export function getDb(): Db {
  if (g.__sooosh_db) return g.__sooosh_db
  const url = process.env.DATABASE_URL
  if (!url) throw new DbConfigError("Falta DATABASE_URL en .env.local (cadena «Transaction pooler» de Supabase).")
  // `max_pipeline: 1`: una sola consulta en vuelo por conexión. Con el pooler de transacciones de Supabase (6543), enviar varias consultas encadenadas por la misma
  // conexión (el valor por defecto de postgres.js es 100) las deja colgadas: medido con 10 consultas simultáneas, 5 de 80 respondían; con `max_pipeline: 1`, 80 de 80.
  const client = postgres(url, { prepare: false, max: 5, max_pipeline: 1, idle_timeout: 20, connect_timeout: 15 })
  g.__sooosh_client = client
  g.__sooosh_db = drizzle(client)
  return g.__sooosh_db
}

/**
 * Descarta las conexiones y deja que la próxima consulta abra unas nuevas. El pooler de Supabase a veces deja conexiones que no responden (la consulta
 * se queda esperando para siempre); una conexión nueva suele funcionar. `failed` es la base con la que falló la consulta: si ya se recreó mientras
 * tanto (otra petición se adelantó), no se vuelve a recrear. Devuelve si recreó.
 */
export function resetDb(failed?: Db): boolean {
  if (failed && g.__sooosh_db !== failed) return false
  const old = g.__sooosh_client
  g.__sooosh_db = undefined
  g.__sooosh_client = undefined
  old?.end({ timeout: 0 }).catch(() => {})
  return true
}
