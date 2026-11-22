import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, PRESETS, presetOf, resolveLang } from "@/lib/apply/body-settings"

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

describe("puntos de partida", () => {
  it("cada uno se reconoce a sí mismo y no toca el idioma", () => {
    for (const p of PRESETS) {
      const applied = { ...DEFAULT_SETTINGS, lang: "en" as const, ...p.settings }
      expect(presetOf(applied)).toBe(p.value)
      expect(applied.lang).toBe("en")
    }
  })
  it("los ajustes por defecto no coinciden con ninguno; tocar uno lo vuelve «personalizado»", () => {
    expect(presetOf(DEFAULT_SETTINGS)).toBeNull()
    expect(presetOf({ ...DEFAULT_SETTINGS, ...PRESETS[0].settings, warmth: "entusiasta" })).toBeNull()
  })
  it("son distintos entre sí y solo usan valores válidos", () => {
    expect(new Set(PRESETS.map((p) => JSON.stringify(p.settings))).size).toBe(PRESETS.length)
  })
})
