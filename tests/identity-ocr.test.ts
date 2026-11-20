import { describe, expect, it } from "vitest"
import { heuristicIdentity } from "@/lib/cv/pipeline"

describe("heuristicIdentity con ruido de OCR", () => {
  const header = ["SOSA OSE 0.5.05 LLISTA", "III ITALIA TIA", "Mario Quintero 9", "Ssr. Product designer", "Bogotá, Colombia"].join("\n")
  it("prefiere el nombre en formato Título sobre el ruido en mayúsculas y quita el resto pegado", () => {
    expect(heuristicIdentity(header)).toEqual({ fullName: "Mario Quintero", headline: "Ssr. Product designer", location: "Bogotá, Colombia" })
  })
  it("sigue aceptando un nombre en mayúsculas si es lo único", () => {
    expect(heuristicIdentity("MARIO QUINTERO\nDiseñador").fullName).toBe("MARIO QUINTERO")
  })
})
