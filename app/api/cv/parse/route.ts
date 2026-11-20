import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { AIError } from "@/lib/ai"
import { cacheEnabled, getCached, putCached, sha256, versionFor } from "@/lib/cache/results"
import { getCacheDb } from "@/lib/db/cache"
import { runCvPipeline } from "@/lib/cv/pipeline"
import { ExtractError, extractTextFromFile } from "@/lib/extract"
import { STORED_ID_RE } from "@/lib/uploads"

const DATA_DIR = path.join(process.cwd(), "data")

const AI_STATUS = { not_configured: 500, unreachable: 503, model_missing: 503, timeout: 504, invalid_output: 502 } as const

/**
 * Lee el CV con el pipeline por etapas y responde en NDJSON (una línea JSON por evento):
 *   {t:"stage", i}  — el pipeline pasó de verdad a la etapa `i` (alimenta el ThinkingTicker)
 *   {t:"result", cv, diagnosis, sourceText, meta}  — final
 *   {t:"error", error, code?}  — fallo (mensaje en español)
 * Los tiempos de cada etapa se registran en consola y en `data/timings.log`.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null
  const id = typeof body?.id === "string" ? body.id : ""
  if (!STORED_ID_RE.test(id)) {
    return NextResponse.json({ error: "Identificador de archivo inválido." }, { status: 400 })
  }

  const filePath = path.join(DATA_DIR, "uploads", id)
  try {
    await stat(filePath)
  } catch {
    return NextResponse.json({ error: "No encontramos el archivo. Vuelve a subirlo." }, { status: 404 })
  }

  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(o) + "\n"))
        } catch {
          /* el cliente cerró la conexión */
        }
      }
      const t0 = Date.now()
      try {
        // ¿Ya se analizó exactamente este archivo con este modelo, prompts y esquemas? Se reutiliza (huella = hash del archivo).
        const key = `cv:${sha256(await readFile(filePath))}`
        const version = versionFor("cv")
        const db = cacheEnabled() ? await getCacheDb().catch(() => null) : null
        const hit = db ? await getCached<{ cv: unknown; diagnosis: unknown; sourceText: string; meta: Record<string, unknown> }>(db, key, "cv", version).catch(() => null) : null
        if (hit) {
          for (let i = 0; i <= 5; i++) send({ t: "stage", i })
          const ms = Date.now() - t0
          console.info(`[cv/parse] caché ${ms}ms`)
          send({ t: "result", ...hit, meta: { ...hit.meta, cache: true, totalMs: ms, timings: { caché: ms } } })
          return
        }
        send({ t: "stage", i: 0 })
        const { text, method, ocr } = await extractTextFromFile(filePath, path.extname(id))
        const extractMs = Date.now() - t0

        const r = await runCvPipeline(text, { signal: request.signal, onStage: (i) => send({ t: "stage", i }) })
        const totalMs = Date.now() - t0
        const meta = { method, pipeline: r.method, extractMs, totalMs, timings: { extraccion: extractMs, ...(ocr ? { ocr: ocr.ms } : {}), ...r.timings }, ocr, llmCalls: r.llmCalls, truncated: r.truncated, textChars: text.length }

        console.info(`[cv/parse] total=${totalMs}ms`, JSON.stringify(meta.timings), `llm=${r.llmCalls}`, `pipeline=${r.method}`)
        await mkdir(DATA_DIR, { recursive: true })
        await appendFile(path.join(DATA_DIR, "timings.log"), JSON.stringify({ at: new Date().toISOString(), file: id, ...meta }) + "\n").catch(() => {})
        await writeFile(path.join(DATA_DIR, "profile.json"), JSON.stringify({ fileId: id, parsedAt: new Date().toISOString(), cv: r.cv, diagnosis: r.diagnosis, sourceText: text, meta }, null, 2)).catch(() => {})
        if (db) await putCached(db, key, "cv", version, { cv: r.cv, diagnosis: r.diagnosis, sourceText: text, meta }).catch(() => {})
        send({ t: "result", cv: r.cv, diagnosis: r.diagnosis, sourceText: text, meta })
      } catch (e) {
        if (e instanceof ExtractError) send({ t: "error", error: e.message, code: e.code })
        else if (e instanceof AIError) send({ t: "error", error: e.message, code: e.code, status: AI_STATUS[e.code] })
        else if ((e as Error).name === "AbortError") send({ t: "error", error: "Lectura cancelada.", code: "aborted" })
        else {
          console.error("[cv/parse]", e)
          send({ t: "error", error: "Error inesperado al leer el CV." })
        }
      } finally {
        try {
          controller.close()
        } catch {
          /* ya cerrado */
        }
      }
    },
  })
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } })
}
