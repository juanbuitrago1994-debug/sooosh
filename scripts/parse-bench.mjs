// Banco de extracción: sube cada CV de la carpeta de pruebas al servidor local (puerto 3000, el de `pnpm dev`), lo lee con el pipeline real
// y mide: (1) trazabilidad (todo dato extraído debe poder rastrearse al texto fuente: regla «nunca inventar»), (2) cantidad de datos y
// (3) coherencia entre el Word y el PDF de la misma versión. Borra cada archivo subido al terminar. Una corrida por CV, de a uno (Ollama).
// Uso: node scripts/parse-bench.mjs [carpeta-cv] [carpeta-salida] [filtro]
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"

const dir = path.resolve(process.argv[2] ?? "Pruebas VC")
const out = path.resolve(process.argv[3] ?? "data/bench-cv")
const filter = process.argv[4]
try { process.loadEnvFile(".env.local") } catch {}
const BASE = process.env.BENCH_URL ?? "http://localhost:3000"
// Las rutas /api/* exigen sesión; los scripts entran con la clave de banco de pruebas (BENCH_KEY de .env.local, ver proxy.ts).
const AUTH = process.env.BENCH_KEY ? { "x-sooosh-bench": process.env.BENCH_KEY } : {}
await mkdir(out, { recursive: true })

const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]+/g, " ").trim()
const toks = (s) => norm(s).split(" ").filter((t) => t.length >= 3)
function strings(cv) {
  const out = []
  const add = (kind, v) => { if (typeof v === "string" && v.trim()) out.push([kind, v.trim()]) }
  const h = cv.header ?? {}
  add("nombre", h.fullName); add("titular", h.headline); add("correo", h.email); add("teléfono", h.phone); add("ubicación", h.location)
  for (const l of h.links ?? []) add("enlace", l.url)
  add("resumen", cv.summary)
  for (const e of cv.experience ?? []) { add("cargo", e.role); add("empresa", e.company); add("lugar", e.location); add("fecha", e.startDate); add("fecha", e.endDate); for (const b of e.bullets ?? []) add("logro", b) }
  for (const e of cv.education ?? []) { add("institución", e.institution); add("título", e.degree); add("área", e.field); for (const d of e.details ?? []) add("detalle", d) }
  for (const g of cv.skills ?? []) { add("categoría", g.category); for (const i of g.items ?? []) add("habilidad", i) }
  for (const l of cv.languages ?? []) { add("idioma", l.name); add("nivel", l.level) }
  for (const p of cv.projects ?? []) { add("proyecto", p.name); add("descripción", p.description); for (const t of p.technologies ?? []) add("tecnología", t); for (const b of p.bullets ?? []) add("logro", b) }
  return out
}
/** Rastreable = el texto normalizado aparece tal cual en la fuente, o ≥ 80 % de sus palabras (≥ 3 letras) están en ella. */
function traceable(value, srcNorm, srcSet) {
  const n = norm(value)
  if (!n || srcNorm.includes(n)) return true
  const t = toks(value)
  if (!t.length) return true
  return t.filter((x) => srcSet.has(x)).length / t.length >= 0.8
}

const files = (await readdir(dir)).filter((f) => /\.(pdf|docx)$/i.test(f) && (!filter || f.includes(filter))).sort()
const rows = []
for (const [i, f] of files.entries()) {
  const t0 = Date.now()
  let id
  try {
    const form = new FormData()
    form.set("file", new File([await readFile(path.join(dir, f))], f, { type: f.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }))
    const up = await fetch(`${BASE}/api/upload`, { method: "POST", body: form, headers: AUTH })
    if (!up.ok) throw new Error(`upload ${up.status}`)
    id = (await up.json()).id
    const res = await fetch(`${BASE}/api/cv/parse`, { method: "POST", headers: AUTH, body: JSON.stringify({ id }), signal: AbortSignal.timeout(420_000) })
    const text = await res.text()
    let result, error
    for (const line of text.split("\n").filter(Boolean)) { try { const o = JSON.parse(line); if (o.t === "result") result = o; if (o.t === "error") error = o.error } catch {} }
    if (!result) throw new Error(error ?? `sin resultado (${res.status})`)
    const cv = result.cv
    const src = result.sourceText ?? ""
    const srcNorm = norm(src), srcSet = new Set(toks(src))
    const items = strings(cv)
    const bad = items.filter(([, v]) => !traceable(v, srcNorm, srcSet))
    rows.push({
      f, ms: Date.now() - t0, cache: !!result.meta?.cache, method: result.meta?.method ?? "", srcWords: toks(src).length,
      exp: cv.experience?.length ?? 0, bullets: (cv.experience ?? []).reduce((a, e) => a + (e.bullets?.length ?? 0), 0), edu: cv.education?.length ?? 0,
      skills: (cv.skills ?? []).reduce((a, g) => a + (g.items?.length ?? 0), 0), langs: cv.languages?.length ?? 0, proj: cv.projects?.length ?? 0,
      hasName: !!cv.header?.fullName, hasEmail: !!cv.header?.email, hasPhone: !!cv.header?.phone, total: items.length, bad: bad.map(([k, v]) => `${k}: ${v.slice(0, 70)}`), set: new Set(items.map(([k, v]) => `${k}|${norm(v)}`)),
    })
    await writeFile(path.join(out, `cv-${f.replace(/\W+/g, "_")}.json`), JSON.stringify(cv, null, 2))
  } catch (e) {
    rows.push({ f, error: String(e.message ?? e) })
  } finally {
    if (id) await fetch(`${BASE}/api/upload?id=${id}`, { method: "DELETE", headers: AUTH }).catch(() => {})
  }
  process.stdout.write(`\r${i + 1}/${files.length} ${(Date.now() - t0) / 1000}s ${f.slice(0, 40)}   `)
}
console.log("\n")

const short = (f) => f.replace(/^Juan_Buitrago_CV_/, "JB_").replace(/^CV_Ejemplo_/, "Ej_").slice(0, 44)
const pct = (x) => (x * 100).toFixed(1) + " %"
const ok = rows.filter((r) => !r.error)
let md = `# Banco de extracción (${new Date().toISOString().slice(0, 10)})\n\n${ok.length}/${rows.length} CV leídos con el pipeline real.\n\n## 1. Datos extraídos y trazabilidad\n\n| Archivo | Tiempo | Caché | Pal. fuente | Exp. | Logros | Educ. | Habilidades | Idiomas | Proy. | Nombre/Correo/Tel. | Datos | No rastreables |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`
for (const r of ok) md += `| ${short(r.f)} | ${(r.ms / 1000).toFixed(0)} s | ${r.cache ? "sí" : ""} | ${r.srcWords} | ${r.exp} | ${r.bullets} | ${r.edu} | ${r.skills} | ${r.langs} | ${r.proj} | ${r.hasName ? "✓" : "✗"}${r.hasEmail ? "✓" : "✗"}${r.hasPhone ? "✓" : "✗"} | ${r.total} | ${r.bad.length} |\n`
const tot = ok.reduce((a, r) => a + r.total, 0), badTot = ok.reduce((a, r) => a + r.bad.length, 0)
md += `\n**Datos extraídos: ${tot}. No rastreables a la fuente: ${badTot} (${pct(badTot / Math.max(1, tot))}).**\n\n`
const badRows = ok.filter((r) => r.bad.length)
if (badRows.length) { md += `### Datos no rastreables (revisar a mano)\n\n`; for (const r of badRows) md += `- **${short(r.f)}**\n${r.bad.map((b) => `  - ${b}`).join("\n")}\n` }
md += `\n## 2. Coherencia Word ↔ PDF de la misma versión\n\n| Versión | Datos Word | Datos PDF | Coinciden | Jaccard |\n|---|---|---|---|---|\n`
const by = new Map()
for (const r of ok) by.set(r.f.replace(/\.(pdf|docx)$/i, ""), { ...(by.get(r.f.replace(/\.(pdf|docx)$/i, "")) ?? {}), [/\.pdf$/i.test(r.f) ? "pdf" : "docx"]: r })
for (const [k, v] of by) if (v.pdf && v.docx) { const a = v.docx.set, b = v.pdf.set; const inter = [...a].filter((x) => b.has(x)).length; md += `| ${short(k)} | ${a.size} | ${b.size} | ${inter} | ${pct(inter / Math.max(1, new Set([...a, ...b]).size))} |\n` }
const errs = rows.filter((r) => r.error)
if (errs.length) { md += `\n## Fallos\n\n`; for (const r of errs) md += `- ${short(r.f)}: ${r.error}\n` }
await writeFile(path.join(out, "informe-extraccion.md"), md)
console.log(md)
