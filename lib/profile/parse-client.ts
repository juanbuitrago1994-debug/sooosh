import type { CV } from "@/lib/schemas/cv"
import { STAGES } from "@/lib/cv/stages"
import type { FileMeta } from "@/lib/profile/search-profile"

type Ev = { t: "stage"; i: number } | { t: "result"; cv: CV; sourceText?: string; meta?: { totalMs?: number } } | { t: "error"; error: string }

/** Sube un archivo de CV y lo lee con el mismo pipeline de la app (flujo NDJSON de `/api/cv/parse`). Devuelve el CV leído. */
export async function uploadAndParseCv(file: File, onStage: (label: string) => void, signal?: AbortSignal): Promise<{ cv: CV; fileId: string; sourceText?: string; file: FileMeta }> {
  const body = new FormData()
  body.append("file", file)
  const up = await fetch("/api/upload", { method: "POST", body, signal })
  const saved = await up.json().catch(() => ({}))
  if (!up.ok) throw new Error(saved.error ?? "No se pudo subir el archivo.")
  const res = await fetch("/api/cv/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: saved.id }), signal })
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.error ?? "No se pudo leer el CV.")
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  let result: { cv: CV; sourceText?: string; readMs?: number } | null = null
  const handle = (line: string) => {
    if (!line.trim()) return
    const ev = JSON.parse(line) as Ev
    if (ev.t === "stage") onStage(STAGES[ev.i] ?? "Leyendo tu CV")
    else if (ev.t === "error") throw new Error(ev.error)
    else result = { cv: ev.cv, sourceText: ev.sourceText, readMs: ev.meta?.totalMs }
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf("\n")) >= 0) {
      handle(buf.slice(0, nl))
      buf = buf.slice(nl + 1)
    }
  }
  handle(buf)
  if (!result) throw new Error("La lectura terminó sin resultado. Inténtalo de nuevo.")
  const r = result as { cv: CV; sourceText?: string; readMs?: number }
  return { cv: r.cv, fileId: saved.id, sourceText: r.sourceText, file: { name: saved.name, type: saved.type, size: saved.size, readMs: r.readMs } }
}
