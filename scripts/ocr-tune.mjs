// Afinación de Tesseract sobre un PDF sin texto: mide variantes de resolución, segmentación y preprocesado con el MISMO flujo de la app
// (página → franjas → OCR → limpieza). Sin referencia exacta: se mide (a) confianza media de las palabras, (b) palabras dudosas (<60),
// (c) líneas de ruido eliminadas y (d) cuántos datos conocidos del CV aparecen (lista FACTS: solo cosas que el CV sí dice).
// Uso: node scripts/ocr-tune.mjs <pdf> <carpeta-salida> [variantes separadas por coma]
import { readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { sliceIntoStrips } from "../lib/extract/strips.ts"
import { cleanOcrText } from "../lib/extract/ocr-clean.ts"

const [pdfPath, outDir, only] = process.argv.slice(2)
await mkdir(outDir, { recursive: true })

const FACTS = ["juan buitrago", "ssr product designer", "ueno bank", "monchis", "rentabilidad y cuentas", "fintech", "paraguay", "startups", "freelance", "design system", "diseñador ux", "product designer"]
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]+/g, " ").trim()

const { getDocumentProxy, renderPageAsImage } = await import("unpdf")
const { createCanvas, loadImage } = await import("@napi-rs/canvas")
const pdf = await getDocumentProxy(new Uint8Array(await readFile(pdfPath)))
const page = await pdf.getPage(1)
const vw = page.getViewport({ scale: 1 }).width
const render = async (width) => new Uint8Array(await renderPageAsImage(pdf, 1, { canvasImport: () => import("@napi-rs/canvas"), scale: width / vw }))

/** Preprocesados sobre la imagen ya renderizada: gris con contraste estirado, o blanco y negro (Otsu). */
async function pre(png, mode) {
  if (mode === "none") return png
  const img = await loadImage(Buffer.from(png))
  const c = createCanvas(img.width, img.height)
  const g = c.getContext("2d")
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, c.width, c.height)
  const px = d.data
  const lum = new Uint8Array(c.width * c.height)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) lum[j] = (px[i] * 3 + px[i + 1] * 6 + px[i + 2]) / 10
  let lo = 255, hi = 0
  const hist = new Array(256).fill(0)
  for (const l of lum) { hist[l]++; if (l < lo) lo = l; if (l > hi) hi = l }
  // ¿fondo oscuro? (media baja): se invierte para dejar texto oscuro sobre claro, que es lo que Tesseract espera
  let mean = 0
  for (const l of lum) mean += l
  mean /= lum.length
  const invert = mean < 110
  let thr = 128
  if (mode === "otsu") {
    const total = lum.length
    let sum = 0
    for (let t = 0; t < 256; t++) sum += t * hist[t]
    let sB = 0, wB = 0, best = 0
    for (let t = 0; t < 256; t++) {
      wB += hist[t]
      if (!wB) continue
      const wF = total - wB
      if (!wF) break
      sB += t * hist[t]
      const mB = sB / wB, mF = (sum - sB) / wF
      const v = wB * wF * (mB - mF) ** 2
      if (v > best) { best = v; thr = t }
    }
  }
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    let v = mode === "otsu" ? (lum[j] > thr ? 255 : 0) : ((lum[j] - lo) * 255) / Math.max(1, hi - lo)
    if (invert) v = 255 - v
    px[i] = px[i + 1] = px[i + 2] = v
  }
  g.putImageData(d, 0, 0)
  return new Uint8Array(c.toBuffer("image/png"))
}

const VARIANTS = {
  base: { width: 2200, psm: "3", pre: "none", strip: 800 },
  w1600: { width: 1600, psm: "3", pre: "none", strip: 800 },
  w3000: { width: 3000, psm: "3", pre: "none", strip: 800 },
  psm6: { width: 2200, psm: "6", pre: "none", strip: 800 },
  psm4: { width: 2200, psm: "4", pre: "none", strip: 800 },
  psm11: { width: 2200, psm: "11", pre: "none", strip: 800 },
  gris: { width: 2200, psm: "3", pre: "gris", strip: 800 },
  otsu: { width: 2200, psm: "3", pre: "otsu", strip: 800 },
  strip500: { width: 2200, psm: "3", pre: "none", strip: 500 },
  strip1200: { width: 2200, psm: "3", pre: "none", strip: 1200 },
}
const names = (only ? only.split(",") : Object.keys(VARIANTS)).filter((n) => VARIANTS[n])
const { createWorker } = await import("tesseract.js")
const results = []
for (const name of names) {
  const v = VARIANTS[name]
  const t0 = Date.now()
  const png = await pre(await render(v.width), v.pre)
  const strips = await sliceIntoStrips(png, v.strip)
  const w = await createWorker(["spa", "eng"], 1, { cachePath: path.join(process.cwd(), "data", "tessdata") })
  await w.setParameters({ tessedit_pageseg_mode: v.psm })
  const parts = []
  let words = []
  for (const s of strips) {
    const { data } = await w.recognize(Buffer.from(s), {}, { text: true, blocks: true })
    parts.push(data.text)
    for (const b of data.blocks ?? []) for (const pa of b.paragraphs ?? []) for (const l of pa.lines ?? []) words = words.concat(l.words ?? [])
  }
  await w.terminate()
  const raw = parts.join("\n")
  const cleaned = cleanOcrText(raw)
  const good = words.filter((x) => /\p{L}{2,}/u.test(x.text))
  const conf = good.reduce((a, x) => a + x.confidence, 0) / Math.max(1, good.length)
  const dudosas = good.filter((x) => x.confidence < 60).length
  const n = norm(cleaned)
  const facts = FACTS.filter((f) => n.includes(norm(f)))
  const lines = (t) => t.split("\n").filter((l) => l.trim()).length
  const row = { variante: name, ms: Date.now() - t0, franjas: strips.length, lineasCrudas: lines(raw), lineasLimpias: lines(cleaned), confianzaMedia: +conf.toFixed(1), palabrasDudosas: dudosas, hechos: `${facts.length}/${FACTS.length}`, faltan: FACTS.filter((f) => !facts.includes(f)) }
  results.push(row)
  await writeFile(path.join(outDir, `${name}.txt`), cleaned)
  console.log(JSON.stringify(row))
}
await writeFile(path.join(outDir, "tune.json"), JSON.stringify(results, null, 2))
