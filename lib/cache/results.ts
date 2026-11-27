import { createHash } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { PROMPTS } from "@/lib/cv/pipeline"
import { OFFER_SYSTEM_PROMPT } from "@/lib/ai/parse-offer"
import { CLEAN_SYSTEM_PROMPT } from "@/lib/offer/clean"
import type { CacheDb } from "@/lib/db/cache"
import { results } from "@/lib/db/cache-schema"
import { cvSchema } from "@/lib/schemas/cv"
import { diagnosisSchema } from "@/lib/schemas/diagnosis"
import { offerSchema } from "@/lib/schemas/offer"

/**
 * Caché de resultados por huella: si ya se analizó exactamente este CV (hash del archivo) o esta oferta (hash del texto)
 * con este modelo, estos prompts y estos esquemas, se reutiliza. Cambiar cualquiera de los tres invalida solo.
 * LOGIC_VERSION se sube a mano cuando cambia la lógica determinista (sectorización, cabeceras, diagnóstico…).
 */
export const LOGIC_VERSION = 8

export type CacheKind = "cv" | "offer"

/** RESULT_CACHE=off desactiva la caché (las pruebas la apagan para que los modelos simulados no se enmascaren). */
export const cacheEnabled = () => process.env.RESULT_CACHE !== "off"

export const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex")

/** Huella de lo que determina el resultado: modelo + prompts + esquemas + lógica. */
export function versionFor(kind: CacheKind, model = process.env.OLLAMA_MODEL ?? "sin-modelo"): string {
  const prompts = kind === "cv" ? JSON.stringify(PROMPTS) : OFFER_SYSTEM_PROMPT + CLEAN_SYSTEM_PROMPT
  const schemas = kind === "cv" ? JSON.stringify([z.toJSONSchema(cvSchema), z.toJSONSchema(diagnosisSchema)]) : JSON.stringify(z.toJSONSchema(offerSchema))
  return `${model}|p${sha256(prompts).slice(0, 8)}|s${sha256(schemas).slice(0, 8)}|l${LOGIC_VERSION}`
}

export async function getCached<T>(db: CacheDb, key: string, kind: CacheKind, version: string): Promise<T | null> {
  const row = (await db.select().from(results).where(and(eq(results.key, key), eq(results.kind, kind))))[0]
  if (!row || row.version !== version) return null
  try {
    return JSON.parse(row.payload) as T
  } catch {
    return null
  }
}

export async function putCached(db: CacheDb, key: string, kind: CacheKind, version: string, payload: unknown): Promise<void> {
  const row = { version, payload: JSON.stringify(payload), createdAt: new Date().toISOString() }
  await db.insert(results).values({ key, kind, ...row }).onConflictDoUpdate({ target: [results.key, results.kind], set: row })
}
