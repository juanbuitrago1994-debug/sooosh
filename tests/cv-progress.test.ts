import { describe, expect, it } from "vitest"
import { STAGES } from "@/lib/cv/stages"
import { nextProgress, stageCeiling, stageFloor, stageIndex } from "@/lib/cv/progress"

describe("porcentaje de lectura del CV", () => {
  it("el piso sube con cada etapa real y 0 mientras se sube el archivo", () => {
    expect(stageIndex(undefined)).toBe(-1)
    expect(stageIndex(STAGES[2])).toBe(2)
    expect(stageIndex("otra cosa")).toBe(-1)
    const floors = STAGES.map((_, i) => stageFloor(i))
    expect(floors[0]).toBe(0)
    expect([...floors].sort((a, b) => a - b)).toEqual(floors)
    expect(stageFloor(-1)).toBe(0)
  })
  it("dentro de una etapa avanza suave pero nunca pasa del techo, que es menor que el piso de la siguiente", () => {
    for (let i = 0; i < STAGES.length; i++) {
      let v = stageFloor(i)
      for (let k = 0; k < 500; k++) v = nextProgress(v, i)
      expect(v).toBeLessThanOrEqual(stageCeiling(i))
      if (i + 1 < STAGES.length) expect(v).toBeLessThan(stageFloor(i + 1))
    }
  })
  it("nunca baja, nunca llega a 100 y al cambiar de etapa salta al piso de la nueva", () => {
    let v = 0
    for (let i = 0; i < STAGES.length; i++) {
      const before = v
      v = nextProgress(v, i)
      expect(v).toBeGreaterThanOrEqual(before)
      expect(v).toBeGreaterThanOrEqual(stageFloor(i))
      for (let k = 0; k < 800; k++) v = nextProgress(v, i)
      expect(v).toBeLessThan(100)
    }
  })
})

describe("porcentaje con otro número de etapas (versión ATS: 3)", () => {
  it("el piso y el techo se reparten entre 3 y nunca llega a 100", () => {
    expect([0, 1, 2].map((i) => stageFloor(i, 3))).toEqual([0, 33, 67])
    for (let i = 0; i < 3; i++) {
      let v = stageFloor(i, 3)
      for (let k = 0; k < 3000; k++) v = nextProgress(v, i, 0.004, 3)
      expect(v).toBeLessThanOrEqual(stageCeiling(i, 3))
      expect(v).toBeLessThan(100)
    }
  })
})
