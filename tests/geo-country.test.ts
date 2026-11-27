import { describe, expect, it } from "vitest"
import { cityOf, offeredCountry, parseCoords } from "@/lib/geo/country"

describe("país por ubicación", () => {
  it("redondea las coordenadas a 2 decimales y rechaza las no válidas", () => {
    expect(parseCoords("4.711123", "-74.072091")).toEqual({ lat: 4.71, lon: -74.07 })
    for (const bad of [[null, "1"], ["", "1"], ["abc", "1"], ["91", "0"], ["0", "181"], [undefined, undefined]]) expect(parseCoords(bad[0], bad[1])).toBeNull()
  })
  it("devuelve el país solo si la app lo ofrece", () => {
    expect(offeredCountry({ address: { country_code: "co" } })).toBe("CO")
    expect(offeredCountry({ address: { country_code: "es" } })).toBe("ES")
    expect(offeredCountry({ address: { country_code: "zz" } })).toBeNull()
    expect(offeredCountry({})).toBeNull()
    expect(offeredCountry(null)).toBeNull()
  })
  it("saca la ciudad, con alternativas si no es ciudad", () => {
    expect(cityOf({ address: { city: "Bogotá" } })).toBe("Bogotá")
    expect(cityOf({ address: { town: "Chía" } })).toBe("Chía")
    expect(cityOf({ address: { state: "Antioquia" } })).toBe("Antioquia")
    expect(cityOf({ address: {} })).toBeNull()
    expect(cityOf(null)).toBeNull()
  })
})
