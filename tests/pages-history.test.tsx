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
import { CvRepositoryList, reopenHref } from "@/components/history/cv-repository"
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

describe("Repositorio de CV por oferta (popover del historial)", () => {
  it("sin adaptaciones muestra Empty", () => {
    const html = renderToStaticMarkup(<CvRepositoryList entries={[]} onReopen={() => {}} />)
    expect(html).toContain('data-slot="empty"')
    expect(html).toContain("Aún no hay CV guardados")
  })
  it("una fila por oferta: título, empresa, fecha, cobertura y las acciones descargar, reabrir y eliminar", () => {
    const html = renderToStaticMarkup(<CvRepositoryList entries={[entry]} onReopen={() => {}} />)
    expect(html).toContain("Analista de Datos")
    expect(html).toContain("Globex")
    expect(html).toContain("2026-11-16T20:00:00.000Z")
    expect(html).toContain("70 %")
    expect(html).toContain("de 40 % a 70 %")
    for (const t of ["Descargar el PDF para Analista de Datos", "Reabrir la adaptación para Analista de Datos", "Eliminar la adaptación para Analista de Datos"]) expect(html).toContain(t)
    expect(html).toContain('data-slot="item"')
  })
  it("con muchas entradas la lista se desplaza dentro del popover (altura fija con scroll); con pocas no", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ ...entry, id: `e${i}` }))
    expect(renderToStaticMarkup(<CvRepositoryList entries={many} onReopen={() => {}} />)).toContain('data-slot="scroll-area"')
    expect(renderToStaticMarkup(<CvRepositoryList entries={[entry]} onReopen={() => {}} />)).not.toContain('data-slot="scroll-area"')
  })
  it("un CV ATS por oferta muestra su porcentaje de formato (meta 90 %) en lugar de la cobertura", () => {
    const html = renderToStaticMarkup(<CvRepositoryList entries={[{ ...entry, ats: { percent: 94 } }]} onReopen={() => {}} />)
    expect(html).toContain("ATS 94 %")
    expect(html).toContain("Formato ATS 94 %")
  })
  it("desde otras páginas, «Reabrir» enlaza al asistente con el id de la adaptación", () => {
    expect(reopenHref("abc 1")).toBe("/?reabrir=abc%201")
    const html = renderToStaticMarkup(<CvRepositoryList entries={[entry]} />)
    expect(html).toContain('href="/?reabrir=')
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
