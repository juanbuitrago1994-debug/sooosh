import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SourcesStatus } from "@/components/jobs/sources-status"
import { describeRun, friendlyError, pct, stateOf } from "@/lib/sources/status"

describe("estado público de las fuentes", () => {
  it("los errores técnicos se traducen y nunca se filtran tal cual", () => {
    expect(friendlyError("Get on Board: Get on Board respondió 403")).toBe("La fuente bloqueó la lectura.")
    expect(friendlyError("himalayas.app respondió 429")).toMatch(/esperar/)
    expect(friendlyError("Ashby respondió 503")).toMatch(/problema técnico/)
    expect(friendlyError("The operation was aborted due to timeout")).toMatch(/tardó/)
    expect(friendlyError("postgres://user:secreto@host/db connection refused")).toBe("No se pudo leer esta fuente.")
    expect(friendlyError(null)).toBe("No se pudo leer esta fuente.")
  })
  it("cada lectura se cuenta en una frase: ofertas, nuevas, actualizadas, cerradas y empresas que no respondieron", () => {
    expect(describeRun({ ok: true, fetched: 16, created: 3, updated: 13, closed: 0, error: null })).toBe("Extrajo 16 ofertas · 3 nuevas, 13 actualizadas")
    expect(describeRun({ ok: true, fetched: 1, created: 1, updated: 0, closed: 1, error: null })).toBe("Extrajo 1 oferta · 1 nueva, 0 actualizadas, 1 cerrada")
    expect(describeRun({ ok: true, fetched: 500, created: 7, updated: 400, closed: 2, error: "a (ashby): Ashby respondió 403 | b (workable): x" })).toContain("2 empresas no respondieron")
    expect(describeRun({ ok: false, fetched: 0, created: 0, updated: 0, closed: 0, error: "respondió 403" })).toBe("La fuente bloqueó la lectura.")
  })
  it("el estado: al día, con incidencias, atrasada, en pausa o sin lecturas", () => {
    const h = (o: Partial<Parameters<typeof stateOf>[0]>) => ({ failing: false, stale: false, lastError: null, lastOkAt: "2026-11-20T10:00:00Z", ...o })
    expect(stateOf(h({}))).toBe("ok")
    expect(stateOf(h({ lastError: "x" }))).toBe("warn")
    expect(stateOf(h({ stale: true }))).toBe("late")
    expect(stateOf(h({ failing: true, stale: true }))).toBe("paused")
    expect(stateOf(h({ lastOkAt: null }))).toBe("new")
  })
  it("los porcentajes de la ficha: redondeados y sin dividir por cero", () => {
    expect(pct(1, 3)).toBe(33)
    expect(pct(2, 3)).toBe(67)
    expect(pct(0, 0)).toBe(0)
    expect(pct(5, 5)).toBe(100)
  })
  it("el botón del panel está en el buscador y el panel no se pinta hasta abrirlo", () => {
    const html = renderToStaticMarkup(<SourcesStatus />)
    expect(html).toContain("Fuentes")
    expect(html).not.toContain("Fuentes de ofertas")
  })
})
