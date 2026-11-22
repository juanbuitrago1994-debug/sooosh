import { describe, expect, it, vi } from "vitest"
import { DEFAULT_SETTINGS, TONES, resolveLang, toneOf } from "@/lib/apply/body-settings"

describe("idioma del correo", () => {
  it("«automático» sigue el idioma de la oferta; lo elegido manda", () => {
    expect(resolveLang("auto", "en")).toBe("en")
    expect(resolveLang("auto", "es")).toBe("es")
    expect(resolveLang("auto", "otro")).toBe("es")
    expect(resolveLang("auto", null)).toBe("es")
    expect(resolveLang("es", "en")).toBe("es")
    expect(resolveLang("en", "es")).toBe("en")
  })
})

describe("tono", () => {
  it("cada tono se reconoce a sí mismo y no toca ni el idioma ni la longitud", () => {
    for (const t of TONES) {
      const applied = { ...DEFAULT_SETTINGS, lang: "en" as const, length: "largo" as const, ...t.settings }
      expect(toneOf(applied)).toBe(t.value)
      expect(applied.lang).toBe("en")
      expect(applied.length).toBe("largo")
    }
  })
  it("los ajustes por defecto son el tono «cercano»; una combinación suelta no es de ninguno", () => {
    expect(toneOf(DEFAULT_SETTINGS)).toBe("cercano")
    expect(toneOf({ ...DEFAULT_SETTINGS, warmth: "entusiasta" })).toBeNull()
  })
  it("son distintos entre sí", () => {
    expect(new Set(TONES.map((t) => JSON.stringify(t.settings))).size).toBe(TONES.length)
  })
})

describe("ajustes guardados con la versión anterior", () => {
  const withStored = async (value: unknown) => {
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(value), setItem: () => {} })
    const { readSettings } = await import("@/components/jobs/use-email-body")
    const out = readSettings()
    vi.unstubAllGlobals()
    return out
  }
  it("una combinación sin tono vuelve al tono por defecto y «mínimo» pasa a «corto»; el resto se conserva", async () => {
    const out = await withStored({ length: "minimo", register: "casual", warmth: "entusiasta", style: "narrativo", lang: "en", focus: "habilidades", greeting: "formal", cta: "entrevista" })
    expect(toneOf(out)).toBe("cercano")
    expect(out).toMatchObject({ length: "corto", lang: "en", focus: "habilidades", greeting: "formal", cta: "entrevista" })
  })
  it("un tono válido guardado se respeta", async () => {
    const out = await withStored({ register: "sobrio", warmth: "neutra", style: "sencillo", length: "largo" })
    expect(toneOf(out)).toBe("sobrio")
    expect(out.length).toBe("largo")
  })
})
