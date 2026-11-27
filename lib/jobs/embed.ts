import { createHash } from "node:crypto"
import { fullHeadline } from "@/lib/cv/headline"
import { eq, isNull } from "drizzle-orm"
import { embed, resolveEmbedModel } from "@/lib/ai/embeddings"
import type { Db } from "@/lib/db"
import { jobs } from "@/lib/db/schema"
import { createMemo } from "@/lib/util/memo"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"

/** Texto que representa a una oferta para la búsqueda por significado: lo que la define, sin relleno. */
export function jobEmbeddingText(j: { title: string; company?: string | null; locationText?: string | null; skills?: string[]; offer: Offer }): string {
  return [
    j.title,
    j.company,
    j.locationText,
    j.skills?.length ? `Habilidades: ${j.skills.join(", ")}` : undefined,
    j.offer.requirements.length ? `Requisitos: ${j.offer.requirements.slice(0, 8).join("; ")}` : undefined,
    j.offer.responsibilities.length ? `Responsabilidades: ${j.offer.responsibilities.slice(0, 5).join("; ")}` : undefined,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1800)
}

/** Texto que representa a una persona para la búsqueda por significado: titular, resumen, habilidades y sus cargos con las primeras viñetas. */
export function cvEmbeddingText(cv: CV): string {
  return [
    fullHeadline(cv.header),
    cv.summary,
    cv.skills.length ? `Habilidades: ${cv.skills.flatMap((g) => g.items).slice(0, 30).join(", ")}` : undefined,
    ...cv.experience.slice(0, 4).map((e) => `${e.role}: ${e.bullets.slice(0, 3).join(" ")}`),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1800)
}

const profileVectors = new Map<string, number[]>()

/** Vector del CV (con caché en memoria por contenido): sirve para traer primero las ofertas más cercanas a la persona. */
export async function embedProfile(cv: CV, signal?: AbortSignal): Promise<number[] | null> {
  const text = cvEmbeddingText(cv)
  if (text.length < 40) return null
  const key = createHash("sha1").update(text).digest("base64url")
  const hit = profileVectors.get(key)
  if (hit) return hit
  const v = await embedQuery(text, signal)
  if (v) {
    if (profileVectors.size > 200) profileVectors.clear()
    profileVectors.set(key, v)
  }
  return v
}

/** bge-m3 da vectores de 1024 dimensiones, que es lo que guarda `jobs.embedding`. Con otro modelo no se guarda nada. */
const DIMENSIONS = 1024

/** Los textos de búsqueda se repiten (la misma persona, otra vez, o varias personas): su vector se guarda 30 minutos en lugar de pedírselo a Ollama de nuevo. */
const queryVectors = createMemo<number[] | null>({ ttlMs: 30 * 60_000, max: 300 })

export async function embedQuery(text: string, signal?: AbortSignal): Promise<number[] | null> {
  return queryVectors(text.trim().toLowerCase(), async () => {
    const m = await resolveEmbedModel()
    if (!m || m.model.split(":")[0] !== "bge-m3") return null
    const [v] = await embed([text], m.model, signal)
    return v?.length === DIMENSIONS ? v : null
  }, (v) => v !== null)
}

/** Calcula y guarda el vector de una oferta. Devuelve false si Ollama o bge-m3 no están disponibles (la búsqueda por texto sigue funcionando). */
export async function embedJob(db: Db, id: string): Promise<boolean> {
  const row = (await db.select().from(jobs).where(eq(jobs.id, id)).limit(1))[0]
  if (!row) return false
  const v = await embedQuery(jobEmbeddingText({ title: row.title, company: row.company, locationText: row.locationText, skills: row.skills, offer: row.offer as Offer }))
  if (!v) return false
  await db.update(jobs).set({ embedding: v }).where(eq(jobs.id, id))
  return true
}

/** Calcula los vectores que falten, de a 24 por llamada a Ollama (mucho más rápido que de a uno). */
export async function embedMissing(db: Db, limit = 50): Promise<{ done: number; pending: number }> {
  const rows = await db.select().from(jobs).where(isNull(jobs.embedding)).limit(limit)
  const m = await resolveEmbedModel()
  if (rows.length === 0 || !m || m.model.split(":")[0] !== "bge-m3") return { done: 0, pending: rows.length }
  let done = 0
  for (let i = 0; i < rows.length; i += 24) {
    const batch = rows.slice(i, i + 24)
    try {
      const vecs = await embed(batch.map((r) => jobEmbeddingText({ title: r.title, company: r.company, locationText: r.locationText, skills: r.skills, offer: r.offer as Offer })), m.model)
      for (let k = 0; k < batch.length; k++) {
        if (vecs[k]?.length !== DIMENSIONS) continue
        await db.update(jobs).set({ embedding: vecs[k] }).where(eq(jobs.id, batch[k].id))
        done++
      }
    } catch {
      break // Ollama no responde: se reintenta en la próxima sincronización
    }
  }
  return { done, pending: rows.length - done }
}
