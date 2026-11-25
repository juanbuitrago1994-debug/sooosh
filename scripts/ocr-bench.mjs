// Banco de lectura de CV escaneados: Tesseract vs. modelos de visión locales (Ollama), contra el texto del DOCX de la misma persona.
// Uso: node scripts/ocr-bench.mjs <pdf> <docx-referencia> <carpeta-salida> [modelo1,modelo2]
// No toca el servidor de desarrollo. Solo usa Ollama local (puerto 11434).
import { readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"

const [pdfPath, docxPath, outDir, modelsArg] = process.argv.slice(2)
const models = (modelsArg ?? "gemma4:e4b,qwen3.5:9b").split(",").filter(Boolean)
await mkdir(outDir, { recursive: true })

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ+#.@]+/g, " ").trim()
const tokens = (s) => norm(s).split(/\s+/).filter((t) => t.length >= 3)
function score(text, ref) {
  const r = tokens(ref), t = tokens(text)
  const bag = new Map()
  for (const w of t) bag.set(w, (bag.get(w) ?? 0) + 1)
  let hit = 0
  for (const w of r) if ((bag.get(w) ?? 0) > 0) { hit++; bag.set(w, bag.get(w) - 1) }
  const recall = hit / r.length
  const precision = t.length ? hit / t.length : 0
  return { refWords: r.length, outWords: t.length, recall: +recall.toFixed(3), precision: +precision.toFixed(3), f1: +((2 * recall * precision) / (recall + precision || 1)).toFixed(3) }
}

// 1. Referencia: texto del DOCX
const mammoth = (await import("mammoth")).default ?? (await import("mammoth"))
const ref = (await mammoth.extractRawText({ path: docxPath })).value
await writeFile(path.join(outDir, "ref-docx.txt"), ref)

// 2. Páginas del PDF como imagen
const { getDocumentProxy, renderPageAsImage } = await import("unpdf")
const data = new Uint8Array(await readFile(pdfPath))
const pdf = await getDocumentProxy(data)
const pages = pdf.numPages
const render = async (p, width) => {
  const page = await pdf.getPage(p)
  const { width: w } = page.getViewport({ scale: 1 })
  return new Uint8Array(await renderPageAsImage(pdf, p, { canvasImport: () => import("@napi-rs/canvas"), scale: width / w }))
}
const results = []
console.log(`PDF: ${pages} página(s); referencia DOCX: ${tokens(ref).length} palabras`)

// 3. Tesseract (como hoy: 2200 px de ancho, spa+eng)
{
  const { createWorker } = await import("tesseract.js")
  const w = await createWorker(["spa", "eng"], 1, { cachePath: path.join(process.cwd(), "data", "tessdata") })
  const t0 = Date.now()
  const parts = []
  for (let p = 1; p <= pages; p++) parts.push((await w.recognize(Buffer.from(await render(p, 2200)))).data.text)
  await w.terminate()
  const text = parts.join("\n\n")
  const ms = Date.now() - t0
  await writeFile(path.join(outDir, "tesseract.txt"), text)
  results.push({ motor: "tesseract (actual, página completa)", ms, ...score(text, ref) })
  console.log(results.at(-1))
}

// 4. Modelos de visión locales
const PROMPT = "Transcribe literalmente TODO el texto de este CV, en el orden en que se lee, sin resumir, sin traducir y sin inventar nada. Si algo no se lee, omítelo. Devuelve solo el texto."
for (const model of models) {
  const t0 = Date.now()
  const parts = []
  try {
    for (let p = 1; p <= pages; p++) {
      const img = Buffer.from(await render(p, 1600)).toString("base64")
      const res = await fetch("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        body: JSON.stringify({ model, stream: false, think: false, keep_alive: "2m", options: { temperature: 0, num_ctx: 8192 }, messages: [{ role: "user", content: PROMPT, images: [img] }] }),
        signal: AbortSignal.timeout(600_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      parts.push((await res.json()).message?.content ?? "")
    }
    const text = parts.join("\n\n")
    const ms = Date.now() - t0
    await writeFile(path.join(outDir, `${model.replace(/[:/]/g, "_")}.txt`), text)
    results.push({ motor: `${model} (visión)`, ms, ...score(text, ref) })
  } catch (e) {
    results.push({ motor: `${model} (visión)`, error: String(e.message ?? e) })
  }
  console.log(results.at(-1))
}
await writeFile(path.join(outDir, "resultados.json"), JSON.stringify(results, null, 2))
