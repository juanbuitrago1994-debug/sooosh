import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import type { Db } from "./index"

/**
 * Postgres de mentira para las pruebas (PGlite: Postgres real compilado a WASM, en memoria, sin red ni cuentas).
 * Aplica las MISMAS migraciones que Supabase para la memoria (0001) y la medición con consentimiento (0008). Solo para pruebas.
 */
export async function createTestDb(): Promise<Db> {
  const client = new PGlite()
  // Supabase ya trae estos roles; la migración los usa en `revoke`.
  await client.exec("create role anon; create role authenticated;")
  for (const f of ["0001_memory.sql", "0008_events.sql"]) await client.exec(readFileSync(path.join(process.cwd(), "db/migrations", f), "utf8"))
  return drizzle(client) as unknown as Db
}
