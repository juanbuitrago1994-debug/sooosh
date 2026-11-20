import { NextResponse } from "next/server"
import { DEFAULT_KEEP_ALIVE, DEFAULT_NUM_CTX } from "@/lib/ai/ollama"
import { resolveEmbedModel } from "@/lib/ai/embeddings"

let last = 0

/**
 * Precarga el modelo (y el de embeddings) en memoria al abrir la app, para que la primera lectura no pague la carga.
 * Usa el MISMO num_ctx que el resto de las llamadas (si no, Ollama lo recargaría). Nunca falla la app: si Ollama no está, `ok:false`.
 */
export async function POST() {
  const url = (process.env.OLLAMA_URL ?? "").replace(/\/$/, "")
  const model = process.env.OLLAMA_MODEL
  if (!url || !model) return NextResponse.json({ ok: false, reason: "sin configurar" })
  if (Date.now() - last < 30_000) return NextResponse.json({ ok: true, cached: true })
  last = Date.now()
  const t0 = Date.now()
  try {
    // prompt vacío = solo cargar el modelo
    const res = await fetch(`${url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: "", keep_alive: DEFAULT_KEEP_ALIVE, options: { num_ctx: DEFAULT_NUM_CTX } }),
      signal: AbortSignal.timeout(120_000),
    })
    const emb = await resolveEmbedModel()
    if (emb) await fetch(`${url}/api/embed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: emb.model, input: "hola", keep_alive: DEFAULT_KEEP_ALIVE }), signal: AbortSignal.timeout(60_000) }).catch(() => {})
    console.info(`[warmup] ${model} ${res.ok ? "cargado" : `error ${res.status}`} en ${Date.now() - t0} ms${emb ? ` + ${emb.model}` : ""}`)
    return NextResponse.json({ ok: res.ok, ms: Date.now() - t0 })
  } catch (e) {
    last = 0
    return NextResponse.json({ ok: false, reason: (e as Error).message })
  }
}
