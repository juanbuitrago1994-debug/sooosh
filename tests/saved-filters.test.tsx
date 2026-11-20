import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SavedFiltersBar } from "@/components/jobs/saved-filters-bar"
import { clearFilters, FILTERS_KEY, getFilters, parseFilters, sameFilters, saveFilters, setAutoApply } from "@/lib/profile/saved-filters"

const base = { region: "CO", area: "tecnologia", mode: "remoto", sort: "recientes", onlyMatches: false } as const

describe("mis filtros (guardados en el navegador)", () => {
  const mem = new Map<string, string>()
  beforeEach(() => {
    mem.clear()
    vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) })
    vi.stubGlobal("window", { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} })
    vi.stubGlobal("Event", class {})
  })
  afterEach(() => vi.unstubAllGlobals())

  it("sin filtros guardados devuelve null; al guardar se leen igual y «aplicar al abrir» arranca apagado", () => {
    expect(getFilters()).toBeNull()
    expect(saveFilters({ ...base })).toBe(true)
    expect(getFilters()).toEqual({ ...base, auto: false })
  })
  it("actualizar conserva la preferencia de aplicar al abrir; quitar los borra", () => {
    saveFilters({ ...base })
    expect(setAutoApply(true)).toBe(true)
    saveFilters({ ...base, region: "CL" })
    expect(getFilters()).toMatchObject({ region: "CL", auto: true })
    expect(clearFilters()).toBe(true)
    expect(getFilters()).toBeNull()
    expect(setAutoApply(true)).toBe(false) // sin filtros guardados no hay nada que activar
  })
  it("un valor raro o una región desconocida descarta todo (mejor sin filtros que con filtros rotos)", () => {
    expect(parseFilters({ ...base, region: "ZZ", auto: false })).toBeNull()
    expect(parseFilters({ ...base, area: "otra", auto: false })).toBeNull()
    expect(parseFilters({ ...base, mode: "volando", auto: false })).toBeNull()
    expect(parseFilters({ ...base, mode: "", auto: false })).not.toBeNull()
    mem.set(FILTERS_KEY, "{no es json")
    expect(getFilters()).toBeNull()
  })
  it("compara solo los filtros (no la preferencia de abrir)", () => {
    expect(sameFilters(base, { ...base })).toBe(true)
    expect(sameFilters(base, { ...base, sort: "relevancia" })).toBe(false)
  })
  it("sin guardados la barra ofrece guardar; no muestra «aplicar» ni la opción de abrir", () => {
    const html = renderToStaticMarkup(<SavedFiltersBar current={base} onApply={() => {}} />)
    expect(html).toContain("Guardar filtros")
    expect(html).not.toContain("Aplicar mis filtros")
  })
})
