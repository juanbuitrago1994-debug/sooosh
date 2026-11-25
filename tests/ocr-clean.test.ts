import { describe, expect, it } from "vitest"
import { cleanOcrText, isNoiseLine } from "@/lib/extract/ocr-clean"

describe("cleanOcrText", () => {
  it("quita el ruido de decoraciones", () => {
    for (const l of ["TT LIT TT TIAS SJ YJ", "Neeson E er er eses o 000 O ere", "BAAR PE FX Ff Ft PR SESE re", "Tal mB AY > E", "F q «e N"]) expect(isNoiseLine(l), l).toBe(true)
  })
  it("conserva líneas legítimas de un CV", () => {
    for (const l of [
      "Mario Quintero",
      "Ssr. Product designer",
      "Bogotá, Colombia",
      "Seguros",
      "Acerca de mí",
      "Diseñador Ul con enfoque en productos digitales centrados en el usuario. Me",
      "Sep 2026 - Nov 2026",
      "Senior Ul Designer, Iris Neobanco '» 2018-2021 Fintech",
      "* Validación con datos: hipótesis, métricas de éxito y",
      "Junior UX 8: Ul Designer, Zurich Seguros LATAM ' 2016-2018",
      "Itti  flago 2025 - 06 nov 2026 Tecnología",
      "AWS",
      "2016-2018",
    ]) expect(isNoiseLine(l), l).toBe(false)
  })
  it("no cambia el texto que conserva", () => {
    expect(cleanOcrText("Mario Quintero\nTT LIT TT TIAS SJ YJ\n\nExperiencia")).toBe("Mario Quintero\n\nExperiencia")
  })
  it("corrige «Ul» (la «I» de «UI» leída como «l») sin tocar otras palabras", () => {
    expect(cleanOcrText("Senior Ul Designer, Gopass\nUl kit y mobile first\nUlises y Ulloa")).toBe("Senior UI Designer, Gopass\nUI kit y mobile first\nUlises y Ulloa")
  })
})
