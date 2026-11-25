// Banco de lectura de CV sobre la carpeta de pruebas (datos personales: la carpeta y la salida NO entran al repositorio).
//   1) OCR con referencia real: cada PDF con capa de texto se dibuja como imagen, se lee con el MISMO flujo de la app (página → franjas →
//      Tesseract → limpieza) y se compara con su capa de texto.
//   2) Coherencia Word ↔ PDF de la misma versión (texto del DOCX contra capa de texto del PDF).
//   3) Casos difíciles sin referencia (imágenes sueltas y PDF sin texto): tiempo, líneas y confianza.
// Uso: node scripts/cv-bench.mjs [carpeta-cv] [carpeta-salida] [filtro]
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { sliceIntoStrips } from "../lib/extract/strips.ts"
import { cleanOcrText } from "../lib/extract/ocr-clean.ts"

const dir = path.resolve(process.argv[2] ?? "Pruebas VC")
const out = path.resolve(process.argv[3] ?? "data/bench-cv")
const filter = process.argv[4]
await mkdir(path.join(out, "texts"), { recursive: true })

const { getDocumentProxy, extractText, renderPageAsImage } = await import("unpdf")
const { loadImage, createCanvas } = await import("@napi-rs/canvas")
const mammoth = (await import("mammoth")).default
const { createWorker } = await import("tesseract.js")

// ---------- utilidades de comparación ----------
const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter((w) => w.length >= 2)
function compare(got, truth) {
  const bag = new Map()
  for (const w of words(got)) bag.set(w, (bag.get(w) ?? 0) + 1)
  const missing = new Map()
  let hit = 0
  const t = words(truth)
  for (const w of t) {
    if ((bag.get(w) ?? 0) > 0) { hit++; bag.set(w, bag.get(w) - 1) } else missing.set(w, (missing.get(w) ?? 0) + 1)
  }
  const extra = new Map()
  for (const [w, n] of bag) if (n > 0) extra.set(w, n)
  const g = words(got).length
  const recall = hit / Math.max(1, t.length), precision = hit / Math.max(1, g)
  return { truthWords: t.length, gotWords: g, recall, precision, f1: (2 * recall * precision) / Math.max(1e-9, recall + precision), missing, extra }
}
const top = (m, n = 8) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w, c]) => `${w}×${c}`).join(", ")

// ---------- OCR con la misma cadena de la app ----------
const workers = await Promise.all([0, 1].map(() => createWorker(["spa", "eng"], 1, { cachePath: path.join(process.cwd(), "data", "tessdata") })))
const free = [...workers]
const acquire = async () => { while (!free.length) await new Promise((r) => setTimeout(r, 50)); return free.pop() }

async function ocrPng(png) {
  const strips = await sliceIntoStrips(png)
  const w = await acquire()
  try {
    let text = "", conf = [], t0 = Date.now()
    for (const s of strips) {
      const { data } = await w.recognize(Buffer.from(s), {}, { text: true, blocks: true })
      text += data.text + "\n"
      for (const b of data.blocks ?? []) for (const p of b.paragraphs ?? []) for (const l of p.lines ?? []) for (const x of l.words ?? []) if (/\p{L}{2,}/u.test(x.text)) conf.push(x.confidence)
    }
    return { text: cleanOcrText(text), ms: Date.now() - t0, strips: strips.length, conf: conf.reduce((a, b) => a + b, 0) / Math.max(1, conf.length) }
  } finally { free.push(w) }
}
async function renderPdf(pdf, width = 2200) {
  const pngs = []
  for (let p = 1; p <= Math.min(pdf.numPages, 4); p++) {
    const pg = await pdf.getPage(p)
    const vw = pg.getViewport({ scale: 1 }).width
    pngs.push(new Uint8Array(await renderPageAsImage(pdf, p, { canvasImport: () => import("@napi-rs/canvas"), scale: width / vw })))
  }
  return pngs
}
async function imageToPng(file, width = 2200) {
  const img = await loadImage(await readFile(file))
  const s = Math.min(1, width / img.width)
  const c = createCanvas(Math.round(img.width * s), Math.round(img.height * s))
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height)
  return new Uint8Array(c.toBuffer("image/png"))
}

// ---------- recorrido ----------
const files = (await readdir(dir)).filter((f) => !f.startsWith(".") && (!filter || f.includes(filter))).sort()
const base = (f) => f.replace(/\.(pdf|docx|jpg|png)$/i, "")
const rows1 = [], rows2 = [], rows3 = []
const allMissing = new Map(), allExtra = new Map()
const add = (m, into) => { for (const [w, c] of m) into.set(w, (into.get(w) ?? 0) + c) }

const jobs = []
for (const f of files) {
  const ext = path.extname(f).toLowerCase(), p = path.join(dir, f)
  if (ext === ".pdf") jobs.push(async () => {
    const pdf = await getDocumentProxy(new Uint8Array(await readFile(p)))
    const { text } = await extractText(pdf, { mergePages: true })
    const layer = text.trim()
    const pngs = await renderPdf(pdf)
    const parts = await Promise.all(pngs.map(ocrPng))
    const got = parts.map((x) => x.text).join("\n")
    const ms = Math.max(...parts.map((x) => x.ms)), conf = parts.reduce((a, x) => a + x.conf, 0) / parts.length
    await writeFile(path.join(out, "texts", base(f) + ".ocr.txt"), got)
    if (layer.length >= 200) {
      const c = compare(got, layer)
      add(c.missing, allMissing); add(c.extra, allExtra)
      rows1.push({ f, pages: pdf.numPages, ms, conf, ...c })
      // 2) Word ↔ PDF
      const docx = path.join(dir, base(f) + ".docx")
      if (files.includes(base(f) + ".docx")) {
        const d = (await mammoth.extractRawText({ path: docx })).value
        const c2 = compare(layer, d)
        rows2.push({ f: base(f), docxWords: c2.truthWords, pdfWords: c2.gotWords, recall: c2.recall, precision: c2.precision, missing: top(c2.missing, 5), extra: top(c2.extra, 5) })
      }
    } else rows3.push({ f, tipo: "PDF sin texto", pages: pdf.numPages, ms, strips: parts.reduce((a, x) => a + x.strips, 0), lines: got.split("\n").filter((l) => l.trim()).length, chars: got.length, conf })
  })
  else if (ext === ".jpg" || ext === ".png") jobs.push(async () => {
    const r = await ocrPng(await imageToPng(p))
    await writeFile(path.join(out, "texts", base(f) + ".ocr.txt"), r.text)
    rows3.push({ f, tipo: "imagen", ms: r.ms, strips: r.strips, lines: r.text.split("\n").filter((l) => l.trim()).length, chars: r.text.length, conf: r.conf })
  })
}
// 2 trabajos a la vez (uno por worker)
let next = 0
await Promise.all([0, 1].map(async () => { while (next < jobs.length) { const j = jobs[next++]; const i = next; try { await j() } catch (e) { console.error("fallo", i, e.message) } process.stdout.write(`\r${Math.min(next, jobs.length)}/${jobs.length}`) } }))
await Promise.all(workers.map((w) => w.terminate()))
console.log("\n")

// ---------- informe ----------
const pct = (x) => (x * 100).toFixed(1) + " %"
const avg = (a, k) => a.reduce((s, r) => s + r[k], 0) / Math.max(1, a.length)
const short = (f) => f.replace(/^Juan_Buitrago_CV_/, "JB_").replace(/^CV_Ejemplo_/, "Ej_").slice(0, 44)
let md = `# Banco de lectura de CV (${new Date().toISOString().slice(0, 10)})\n\nCarpeta: ${files.length} archivos. Una corrida por CV.\n\n## 1. OCR contra la capa de texto real (${rows1.length} PDF)\n\n| PDF | Pág. | Tiempo | Confianza | Palabras (real) | Recall | Precisión | Faltan (top) |\n|---|---|---|---|---|---|---|---|\n`
for (const r of rows1) md += `| ${short(r.f)} | ${r.pages} | ${(r.ms / 1000).toFixed(0)} s | ${r.conf.toFixed(1)} | ${r.truthWords} | ${pct(r.recall)} | ${pct(r.precision)} | ${top(r.missing, 4)} |\n`
md += `| **Promedio** | | ${(avg(rows1, "ms") / 1000).toFixed(0)} s | ${avg(rows1, "conf").toFixed(1)} | ${Math.round(avg(rows1, "truthWords"))} | **${pct(avg(rows1, "recall"))}** | **${pct(avg(rows1, "precision"))}** | |\n\n`
md += `**Palabras de la referencia que el OCR no devolvió (acumulado):** ${top(allMissing, 25)}\n\n**Palabras del OCR que no están en la referencia (acumulado):** ${top(allExtra, 25)}\n\n`
md += `## 2. Word ↔ PDF de la misma versión (${rows2.length})\n\n| Versión | Palabras Word | Palabras PDF | Recall | Precisión | Falta en el PDF | Sobra en el PDF |\n|---|---|---|---|---|---|---|\n`
for (const r of rows2) md += `| ${short(r.f)} | ${r.docxWords} | ${r.pdfWords} | ${pct(r.recall)} | ${pct(r.precision)} | ${r.missing} | ${r.extra} |\n`
md += `\n## 3. Casos difíciles sin referencia (${rows3.length})\n\n| Archivo | Tipo | Tiempo | Franjas | Líneas | Caracteres | Confianza |\n|---|---|---|---|---|---|---|\n`
for (const r of rows3) md += `| ${short(r.f)} | ${r.tipo} | ${(r.ms / 1000).toFixed(0)} s | ${r.strips} | ${r.lines} | ${r.chars} | ${r.conf.toFixed(1)} |\n`
await writeFile(path.join(out, "informe.md"), md)
console.log(md)
