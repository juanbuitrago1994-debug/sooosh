import { describe, expect, it } from "vitest"
import { detectApply } from "@/lib/jobs/apply"
import { detectAsks } from "@/lib/jobs/asks"

describe("detectAsks", () => {
  const cases: [string, string[]][] = [
    ["Enviar hoja de vida con aspiración salarial a rrhh@acme.com", ["salario"]],
    ["Los interesados deben enviar su CV, pretensión salarial y disponibilidad inmediata al correo.", ["salario", "disponibilidad"]],
    ["Indica tu fecha de inicio y adjunta tu portafolio.", ["disponibilidad", "portafolio"]],
    ["Incluye el enlace a tu LinkedIn y dos referencias laborales.", ["linkedin", "referencias"]],
    ["Please include your salary expectations and availability.", ["salario", "disponibilidad"]],
    // Lo que OFRECE la empresa o un requisito sin instrucción no cuenta.
    ["Rango salarial: $4.000.000 a $6.000.000. Salario competitivo.", []],
    ["Aplica por LinkedIn. Publicado en LinkedIn hace 3 días.", []],
    ["Se valora experiencia con GitHub y Figma.", []],
    ["Disponibilidad de horario según turnos.", []],
    ["", []],
  ]
  it.each(cases)("%s", (text, expected) => expect(detectAsks(text)).toEqual(expected))
  it("sin texto no hay nada", () => expect(detectAsks(undefined)).toEqual([]))
})

describe("detectApply guarda lo que pide la oferta", () => {
  it("solo si hay correo y la oferta lo pide", () => {
    const a = detectApply({ sourceUrl: "texto:abc", text: "Envía tu CV a rrhh@acme.com con aspiración salarial y disponibilidad." })
    expect(a.asks).toEqual(["salario", "disponibilidad"])
    expect(detectApply({ sourceUrl: "texto:abc", text: "Envía tu CV a rrhh@acme.com." })).not.toHaveProperty("asks")
  })
})
