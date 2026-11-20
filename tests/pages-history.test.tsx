import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// next/font solo funciona dentro de Next: aquí basta con las clases vacías.
vi.mock("@/app/fonts", () => ({ geistSans: { variable: "" }, geistMono: { variable: "" }, newsreader: { variable: "" } }))
vi.mock("../app/fonts", () => ({ geistSans: { variable: "" }, geistMono: { variable: "" }, newsreader: { variable: "" } }))

import ErrorPage from "@/app/error"
import GlobalError from "@/app/global-error"
import NotFound from "@/app/not-found"
import { HistoryView } from "@/components/history/history-view"
import type { HistoryEntry } from "@/lib/history"
import { cvSchema } from "@/lib/schemas/cv"

const cv = cvSchema.parse({ header: { fullName: "Ana Zapata" } })
const entry: HistoryEntry = {
  id: "1",
  createdAt: "2026-11-16T20:00:00.000Z",
  offerText: "x",
  offer: { title: "Analista de Datos", company: "Globex", language: "es", requirements: [], niceToHave: [], responsibilities: [] },
  originalCv: cv,
  cv,
  review: { items: [], decisions: {} },
  lang: "es",
  coverageBefore: 40,
  coverageAfter: 70,
  acceptedChanges: 1,
}

describe("páginas de error en español", () => {
  it("not-found", () => {
    const html = renderToStaticMarkup(<NotFound />)
    expect(html).toContain("No encontramos esa página")
    expect(html).toContain('href="/"')
    expect(html).toContain("Volver al inicio")
  })
  it("error.tsx usa el botón Reintentar (retry) y no muestra el mensaje técnico", () => {
    const html = renderToStaticMarkup(<ErrorPage error={new Error("secreto interno")} retry={() => {}} />)
    expect(html).toContain("Algo salió mal")
    expect(html).toContain("Reintentar")
    expect(html).not.toContain("secreto interno")
  })
  it("global-error define su propio <html lang=es> y <body>", () => {
    const html = renderToStaticMarkup(<GlobalError error={new Error("x")} retry={() => {}} />)
    expect(html).toMatch(/<html[^>]*lang="es"/)
    expect(html).toContain("<body")
    expect(html).toContain("La aplicación tuvo un problema")
  })
})

describe("HistoryView", () => {
  it("sin adaptaciones muestra Empty y no ofrece borrar todo", () => {
    const html = renderToStaticMarkup(<HistoryView entries={[]} onReopen={() => {}} />)
    expect(html).toContain('data-slot="empty"')
    expect(html).toContain("Aún no hay adaptaciones guardadas")
    expect(html).not.toContain("Borrar todo el historial")
  })
  it("muestra oferta, fecha, cobertura antes/después y las acciones reabrir, descargar y eliminar", () => {
    const html = renderToStaticMarkup(<HistoryView entries={[entry]} onReopen={() => {}} />)
    expect(html).toContain("Analista de Datos")
    expect(html).toContain("Globex")
    expect(html).toContain("2026-11-16T20:00:00.000Z")
    expect(html).toContain("Cobertura 40% → 70% (+30)")
    expect(html).toContain("1 cambio aceptado")
    for (const t of ["Reabrir", "Descargar PDF", "Eliminar", "Borrar todo el historial"]) expect(html).toContain(t)
    expect(html).toContain("solo en este navegador")
  })
})

describe("textos de la interfaz en español", () => {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.tsx$/.test(f)) files.push(p)
    }
  }
  walk(path.join(__dirname, "../components"))
  walk(path.join(__dirname, "../app"))

  it("no quedan textos accesibles en inglés de los componentes generados", () => {
    const bad = /(Toggle Sidebar|Displays the mobile|aria-label="(Loading|Close|Previous|Next|Open|Menu|Go to|Copy|Copied|pagination|breadcrumb)[^"]*"|sr-only">(Close|Previous|Next|More)[ a-z]*<)/
    const offenders = files.filter((f) => bad.test(readFileSync(f, "utf8"))).map((f) => path.relative(path.join(__dirname, ".."), f))
    expect(offenders).toEqual([])
  })
})
