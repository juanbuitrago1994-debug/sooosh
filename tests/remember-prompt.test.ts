import { describe, expect, it } from "vitest"
import { REMEMBER_ANSWERED_KEY, REMEMBER_SHOWN_KEY, shouldAskRemember } from "@/lib/auth/remember-prompt"

describe("sugerencia de mantener la sesión", () => {
  const base = { remembered: false, answered: false, shownThisTab: false }
  it("se sugiere solo si no la mantiene, no respondió nunca en este dispositivo y no se mostró en esta pestaña", () => {
    expect(shouldAskRemember(base)).toBe(true)
    expect(shouldAskRemember({ ...base, remembered: true })).toBe(false)
    expect(shouldAskRemember({ ...base, answered: true })).toBe(false)
    expect(shouldAskRemember({ ...base, shownThisTab: true })).toBe(false)
  })
  it("la marca de «respondido» sobrevive al cerrar sesión (no usa los prefijos que se borran)", () => {
    for (const k of [REMEMBER_ANSWERED_KEY, REMEMBER_SHOWN_KEY]) {
      expect(k.startsWith("sooosh:")).toBe(false)
      expect(k.startsWith("cv-tailor:")).toBe(false)
    }
  })
})
