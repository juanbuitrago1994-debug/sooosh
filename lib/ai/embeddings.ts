import { AIError } from "./types"

/**
 * Embeddings locales con Ollama (`/api/embed`). Modelo preferido: bge-m3 (multilingüe). Si no está instalado se usa
 * nomic-embed-text (o similar), que NO es multilingüe: en ese caso el motor traduce antes los términos con el LLM.
 */
export type EmbedModel = { model: string; multilingual: boolean }

const PREFERRED: EmbedModel[] = [
  { model: "bge-m3", multilingual: true },
  { model: "nomic-embed-text", multilingual: false },
  { model: "mxbai-embed-large", multilingual: false },
]

const cfg = () => ({ url: (process.env.OLLAMA_URL ?? "").replace(/\/$/, ""), forced: process.env.OLLAMA_EMBED_MODEL })

let cached: { at: number; value: EmbedModel | null } | null = null

/** Qué modelo de embeddings hay disponible (se cachea 60 s). null si no hay ninguno. */
export async function resolveEmbedModel(): Promise<EmbedModel | null> {
  if (cached && Date.now() - cached.at < 60_000) return cached.value
  const { url, forced } = cfg()
  let value: EmbedModel | null = null
  if (url) {
    try {
      const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) })
      const names = ((await res.json()) as { models?: { name: string }[] }).models?.map((m) => m.name.split(":")[0]) ?? []
      if (forced && names.includes(forced.split(":")[0])) value = { model: forced, multilingual: /bge-m3|multilingual|e5/i.test(forced) }
      else value = PREFERRED.find((p) => names.includes(p.model)) ?? null
    } catch {
      value = null
    }
  }
  cached = { at: Date.now(), value }
  return value
}

const vectors = new Map<string, number[]>()

/** Embeddings de varios textos (con caché en memoria). Lanza AIError si Ollama falla. */
export async function embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]> {
  const { url } = cfg()
  if (!url) throw new AIError("not_configured", "Falta OLLAMA_URL en .env.local.")
  const missing = [...new Set(texts)].filter((t) => !vectors.has(`${model}|${t}`))
  for (let i = 0; i < missing.length; i += 48) {
    const batch = missing.slice(i, i + 48)
    let res: Response
    try {
      res = await fetch(`${url}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: batch, keep_alive: "30m" }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
      })
    } catch (e) {
      if ((e as Error).name === "AbortError" && signal?.aborted) throw e
      throw new AIError("unreachable", `No se pudo conectar con Ollama en ${url}. ¿Está corriendo (ollama serve)?`)
    }
    if (res.status === 404) throw new AIError("model_missing", `Ollama no tiene el modelo «${model}». Descárgalo con: ollama pull ${model}`)
    if (!res.ok) throw new AIError("unreachable", `Ollama respondió ${res.status} al calcular embeddings.`)
    const { embeddings } = (await res.json()) as { embeddings: number[][] }
    batch.forEach((t, k) => vectors.set(`${model}|${t}`, embeddings[k]))
  }
  return texts.map((t) => vectors.get(`${model}|${t}`)!)
}

export function cosine(a: number[], b: number[]): number {
  let d = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? d / Math.sqrt(na * nb) : 0
}
