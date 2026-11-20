import { describe, expect, it } from "vitest"
import { BACKOFF_HOURS, TARGETS, isDue } from "@/lib/sources/schedule"

const now = new Date("2026-11-20T12:00:00Z")
const ago = (h: number, ok = true) => ({ ok, at: new Date(now.getTime() - h * 3_600_000) })

describe("sincronización automática", () => {
  it("cada fuente toca según su cadencia, con tolerancia para un cron que no cae exacto", () => {
    expect(isDue(3, [], now)).toBe(true)
    expect(isDue(3, [ago(1)], now)).toBe(false)
    expect(isDue(3, [ago(2.8)], now)).toBe(true) // 3 h menos 20 min de tolerancia
    expect(isDue(12, [ago(6)], now)).toBe(false)
    expect(isDue(12, [ago(11.8)], now)).toBe(true)
    expect(isDue(12, [ago(1)], now, true)).toBe(true) // --force
  })
  it("tras 3 fallos seguidos se pausa 12 h y luego se reintenta", () => {
    const fails = (h: number) => [ago(h, false), ago(h + 3, false), ago(h + 6, false)]
    expect(isDue(3, fails(4), now)).toBe(false)
    expect(isDue(3, fails(BACKOFF_HOURS + 1), now)).toBe(true)
    // un éxito reciente rompe la racha
    expect(isDue(3, [ago(3, false), ago(6, false), ago(9, true)], now)).toBe(true)
  })
  it("el orden pone lo confiable primero, cubre todas las fuentes y respeta los límites de cada una", () => {
    const ids = TARGETS.map((t) => t.id)
    expect(ids[0]).toBe("getonboard")
    expect(ids).toEqual(expect.arrayContaining(["companies", "portal:chiletrabajos", "portal:trabajando", "remote:remotive", "remote:jobicy", "remote:himalayas"]))
    expect(new Set(ids).size).toBe(ids.length)
    // Get on Board solo se lee desde casa (GitHub recibe 403 y no se rodea); el resto puede ir a la nube
    expect(TARGETS.filter((t) => t.runner === "home").map((t) => t.id)).toEqual(["getonboard"])
    // Remotive permite ≤ 4 lecturas al día: nunca más de 24/cadencia
    expect(24 / TARGETS.find((t) => t.id === "remote:remotive")!.everyHours).toBeLessThanOrEqual(4)
  })
})
