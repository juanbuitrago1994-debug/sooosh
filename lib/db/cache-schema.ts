import { sqliteTable, text } from "drizzle-orm/sqlite-core"

/**
 * Caché de resultados LOCAL (SQLite, data/cache.db). Se queda en la máquina a propósito: el contenido guardado incluye el texto
 * del CV (dato personal) y se regenera solo, así que no tiene sentido subirlo a la nube ni pagar la latencia de cada consulta.
 * Resultados ya calculados, por huella del contenido (hash del CV o de la oferta) y versión (modelo + prompts + esquemas).
 */
export const results = sqliteTable("results", {
  key: text("key").notNull(),
  kind: text("kind").notNull(),
  version: text("version").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
})

export const CACHE_DDL = [
  `CREATE TABLE IF NOT EXISTS results (key TEXT NOT NULL, kind TEXT NOT NULL, version TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (key, kind))`,
]
