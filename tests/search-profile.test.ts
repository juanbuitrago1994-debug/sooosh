import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { atsBadgeLabel } from "@/components/jobs/job-search"
import { clearSearchProfile, getSearchProfile, setAtsStatus, profileLabel, refreshSearchProfile, SEARCH_PROFILE_KEY, setSearchProfile } from "@/lib/profile/search-profile"
import { cvSchema } from "@/lib/schemas/cv"

const mk = (name: string, headline?: string) => cvSchema.parse({ header: { fullName: name, headline }, experience: [], skills: [{ items: ["Figma"] }] })

describe("perfil de búsqueda (el CV con el que se compara cada oferta)", () => {
  const mem = new Map<string, string>()
  beforeEach(() => {
    mem.clear()
    vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) })
    vi.stubGlobal("window", { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} })
    vi.stubGlobal("Event", class {})
  })
  afterEach(() => vi.unstubAllGlobals())

  it("sin perfil devuelve null; al guardar, se lee igual y recuerda de qué archivo salió", () => {
    expect(getSearchProfile()).toBeNull()
    expect(setSearchProfile(mk("Ana Pérez", "Product Designer"), "archivo-1")).toBe(true)
    const p = getSearchProfile()!
    expect(p.label).toBe("Ana Pérez · Product Designer")
    expect(p.fileId).toBe("archivo-1")
    expect(p.cv.skills[0].items).toEqual(["Figma"])
    expect(getSearchProfile()).toBe(p) // misma referencia mientras nada cambie (lo exige useSyncExternalStore)
  })
  it("corregir el MISMO archivo actualiza el perfil; un CV adaptado de otro archivo nunca lo toca", () => {
    setSearchProfile(mk("Ana Pérez"), "archivo-1")
    refreshSearchProfile(mk("Ana Pérez", "Senior Designer"), "archivo-1")
    expect(getSearchProfile()!.cv.header.headline).toBe("Senior Designer")
    refreshSearchProfile(mk("Ana Pérez", "CV adaptado a la oferta X"), "archivo-2")
    expect(getSearchProfile()!.cv.header.headline).toBe("Senior Designer")
  })
  it("quitar lo borra; un valor corrupto en el almacenamiento se ignora", () => {
    setSearchProfile(mk("Ana"), "a")
    clearSearchProfile()
    expect(getSearchProfile()).toBeNull()
    mem.set(SEARCH_PROFILE_KEY, "{no es json")
    expect(getSearchProfile()).toBeNull()
    mem.set(SEARCH_PROFILE_KEY, JSON.stringify({ cv: { header: {} } }))
    expect(getSearchProfile()).toBeNull()
  })
  it("la etiqueta no muestra «Sin nombre»", () => {
    expect(profileLabel(mk("Sin nombre", "UX Designer"))).toBe("UX Designer")
    expect(profileLabel(mk("Sin nombre"))).toBe("Tu CV")
  })

  it("el estado ATS se guarda en el perfil sin tocar updatedAt, y se borra al cambiar de CV", () => {
    expect(setAtsStatus({ at: "x" })).toBe(false) // sin perfil no hay dónde anotarlo
    setSearchProfile(mk("Ana"), "a")
    const before = getSearchProfile()!.updatedAt
    expect(getSearchProfile()?.ats).toBeUndefined()
    expect(setAtsStatus({ at: "2026-11-23T00:00:00Z" })).toBe(true)
    expect(getSearchProfile()).toMatchObject({ ats: { at: "2026-11-23T00:00:00Z" }, updatedAt: before })
    setAtsStatus({ at: "2026-11-23T00:01:00Z", validated: true })
    expect(getSearchProfile()?.ats).toEqual({ at: "2026-11-23T00:01:00Z", validated: true })
    setSearchProfile(mk("Luis"), "b")
    expect(getSearchProfile()?.ats).toBeUndefined()
  })
  it("texto del badge: sin versión → «Sin optimizar»; generada o validada → «Optimizado para ATS»; verificada sin validar → «Con sugerencias para ATS»", () => {
    expect(atsBadgeLabel(undefined)).toEqual({ text: "Sin optimizar", optimized: false })
    expect(atsBadgeLabel({ at: "x" })).toEqual({ text: "Optimizado para ATS", optimized: true })
    expect(atsBadgeLabel({ at: "x", validated: true })).toEqual({ text: "Optimizado para ATS", optimized: true })
    expect(atsBadgeLabel({ at: "x", validated: false })).toEqual({ text: "Con sugerencias para ATS", optimized: false })
  })
  it("sin CV, el botón «Mi CV» lleva a su izquierda el badge «Sube tu CV»", async () => {
    const { readFileSync } = await import("node:fs")
    const { join } = await import("node:path")
    const src = readFileSync(join(__dirname, "..", "components/jobs/job-search.tsx"), "utf8")
    expect(src).toMatch(/\{profile \? \(\s*<AtsBadge status=\{profile\.ats\} \/>\s*\) : \(\s*<Badge variant="outline" className="mr-1">\s*Sube tu CV/)
  })
})
