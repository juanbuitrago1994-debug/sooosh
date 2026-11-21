import { z } from "zod"
import { cleanEmpty, toModelSchema } from "./json-schema"
import { AIError, type AIProvider, type StructuredRequest, type StructuredResult } from "./types"

const REQUEST_TIMEOUT_MS = 5 * 60_000

/**
 * Un único num_ctx para TODAS las etapas. Medido (docs/BENCHMARKS.md): cambiarlo entre llamadas obliga a Ollama a
 * recargar el modelo y a perder la caché de prefijo (+7,5 s por cambio), y la velocidad de generación es la misma.
 */
export const DEFAULT_NUM_CTX = 8192
/** Cuánto se mantiene el modelo cargado en memoria tras cada llamada. */
export const DEFAULT_KEEP_ALIVE = "60m"

/** Lee la respuesta en streaming de Ollama (una línea JSON por fragmento) y devuelve el texto completo. */
export async function readNdjson(res: Response): Promise<{ content: string; firstTokenMs: number }> {
  const t0 = Date.now()
  let firstTokenMs = 0
  let content = ""
  const reader = res.body?.getReader()
  if (!reader) {
    const j = (await res.json()) as { message?: { content?: string } }
    return { content: j.message?.content ?? "", firstTokenMs: Date.now() - t0 }
  }
  const dec = new TextDecoder()
  let buf = ""
  const take = (line: string) => {
    if (!line.trim()) return
    const j = JSON.parse(line) as { message?: { content?: string }; error?: string }
    if (j.error) throw new AIError("invalid_output", `Ollama devolvió un error: ${j.error}`)
    const piece = j.message?.content ?? ""
    if (piece && !firstTokenMs) firstTokenMs = Date.now() - t0
    content += piece
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf("\n")) >= 0) {
      take(buf.slice(0, nl))
      buf = buf.slice(nl + 1)
    }
  }
  take(buf)
  return { content, firstTokenMs }
}

export type OllamaConfig = { url: string; model: string; numCtx?: number; temperature?: number; keepAlive?: string }

export function createOllamaProvider(config?: Partial<OllamaConfig>): AIProvider {
  const url = (config?.url ?? process.env.OLLAMA_URL ?? "").replace(/\/$/, "")
  const model = config?.model ?? process.env.OLLAMA_MODEL ?? ""
  if (!url || !model) {
    throw new AIError("not_configured", "Falta OLLAMA_URL u OLLAMA_MODEL en .env.local.")
  }
  const numCtx = config?.numCtx ?? DEFAULT_NUM_CTX
  const temperature = config?.temperature ?? 0
  // Mantiene el modelo cargado en memoria entre llamadas (evita recargarlo en cada una).
  const keepAlive = config?.keepAlive ?? process.env.OLLAMA_KEEP_ALIVE ?? DEFAULT_KEEP_ALIVE
  // Modo de razonamiento APAGADO por defecto: con él qwen3.5:9b tardó 55 s (594 tokens de "pensamiento") en una tarea que resuelve en 2,4 s,
  // y gemma4 no devolvía JSON válido. OLLAMA_THINK=true lo activa.
  const think = process.env.OLLAMA_THINK === "true"

  /** Llamada en streaming: acumula los fragmentos y mide el tiempo hasta el primer token. */
  async function chat(
    messages: { role: string; content: string }[],
    format: unknown,
    signal?: AbortSignal,
    options?: { numCtx?: number; numPredict?: number },
  ): Promise<{ content: string; firstTokenMs: number }> {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    let res: Response
    const send = (withThink: boolean) =>
      fetch(`${url}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          keep_alive: keepAlive,
          ...(withThink ? { think } : {}),
          format,
          options: { temperature, num_ctx: options?.numCtx ?? numCtx, ...(options?.numPredict ? { num_predict: options.numPredict } : {}) },
        }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      })
    try {
      res = await send(true)
      // Un modelo sin soporte de `think` responde 400: se reintenta sin ese campo.
      if (res.status === 400 && /think/i.test(await res.clone().text().catch(() => ""))) res = await send(false)
    } catch (e) {
      if ((e as Error).name === "AbortError" && signal?.aborted) throw e
      if ((e as Error).name === "TimeoutError") {
        throw new AIError("timeout", "El modelo tardó demasiado en responder (más de 5 minutos).")
      }
      throw new AIError("unreachable", `No se pudo conectar con Ollama en ${url}. ¿Está corriendo (ollama serve)?`)
    }
    if (res.status === 404) {
      throw new AIError("model_missing", `Ollama no tiene el modelo «${model}». Descárgalo con: ollama pull ${model}`)
    }
    if (!res.ok) {
      throw new AIError("unreachable", `Ollama respondió ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }
    return await readNdjson(res)
  }

  return {
    name: "ollama",
    async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
      const format = toModelSchema(req.schema)
      const messages = [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ]
      const started = Date.now()
      let firstTokenMs = 0
      let lastError = ""

      for (let attempt = 1; attempt <= 2; attempt++) {
        const { content, firstTokenMs: ft } = await chat(messages, format, req.signal, req.options)
        firstTokenMs = firstTokenMs || ft
        let issue: string
        try {
          const parsed = req.schema.safeParse(cleanEmpty(JSON.parse(content)))
          if (parsed.success) {
            return { data: parsed.data, meta: { provider: "ollama", model, ms: Date.now() - started, attempts: attempt, firstTokenMs } }
          }
          issue = z.prettifyError(parsed.error)
        } catch {
          issue = "La respuesta no era JSON válido."
        }
        lastError = issue
        // Reintento: le mostramos al modelo su respuesta y qué falló.
        messages.push(
          { role: "assistant", content },
          { role: "user", content: `La respuesta no cumple el esquema:\n${issue}\nCorrígela y devuelve solo el JSON completo. Recuerda: no inventes datos que no estén en el texto.` },
        )
      }
      throw new AIError("invalid_output", `El modelo no devolvió un CV válido tras 2 intentos.\n${lastError}`)
    },
  }
}
