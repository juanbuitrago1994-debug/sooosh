import { mkdirSync } from "node:fs"
import path from "node:path"
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { CACHE_DDL } from "./cache-schema"

export type CacheDb = ReturnType<typeof drizzle>

/** Abre (y crea si falta) una base SQLite de caché. `url`: `file:ruta` o `:memory:` (pruebas). */
export async function createCacheDb(url: string): Promise<CacheDb> {
  const client = createClient({ url })
  for (const sql of CACHE_DDL) await client.execute(sql)
  return drizzle(client)
}

let shared: Promise<CacheDb> | null = null

/** Caché local: `data/cache.db` (carpeta ignorada por git). Cambia con CACHE_DB_URL. */
export function getCacheDb(): Promise<CacheDb> {
  if (!shared) {
    const dir = path.join(process.cwd(), "data")
    mkdirSync(dir, { recursive: true })
    shared = createCacheDb(process.env.CACHE_DB_URL ?? `file:${path.join(dir, "cache.db")}`).catch((e) => {
      shared = null
      throw e
    })
  }
  return shared
}
