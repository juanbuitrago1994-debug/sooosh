import { describe, expect, it } from "vitest"
import { detectApply } from "@/lib/jobs/apply"
import { detectSubject, fillSubject } from "@/lib/jobs/subject"

describe("detectSubject", () => {
  const cases: [string, string | undefined][] = [
    ["Envía tu CV a rrhh@acme.com con el asunto \"Diseñador UX/UI\".", "Diseñador UX/UI"],
    ["Postula a talento@acme.com con asunto «Desarrollador Backend – Bogotá» y adjunta tu portafolio.", "Desarrollador Backend – Bogotá"],
    ["Asunto: Postulación Diseñador/a UX/UI\nRequisitos: Figma", "Postulación Diseñador/a UX/UI"],
    ["Subject: Senior QA Engineer. Send your CV to jobs@acme.com", "Senior QA Engineer"],
    ["Escribe a rrhh@acme.com y pon 'Vendedor Medellín' como asunto.", "Vendedor Medellín"],
    ["Incluye la referencia DIS-2026 en el asunto del correo.", "DIS-2026"],
    ["Enviar hoja de vida en el asunto: Auxiliar contable y adjuntar certificados a rrhh@acme.com", "Auxiliar contable"],
    // Solo instrucciones: sin asunto.
    ["Indica el cargo en el asunto del correo.", undefined],
    ["Asunto: el cargo al que aplicas", undefined],
    ["Asunto: tu nombre", undefined],
    ["Envía tu CV a rrhh@acme.com.", undefined],
    ["", undefined],
  ]
  it.each(cases)("%s", (text, expected) => expect(detectSubject(text)).toBe(expected))
  it("no devuelve asuntos demasiado largos ni sin letras", () => {
    expect(detectSubject(`Asunto: "${"a".repeat(150)}"`)).toBeUndefined()
    expect(detectSubject('Asunto: "123"')).toBeUndefined()
  })
})

describe("fillSubject", () => {
  it("rellena marcadores con datos reales", () => {
    expect(fillSubject("Postulación [Cargo] - [Tu nombre]", { name: "Ana Pérez", title: "Diseñadora UX" })).toEqual({ text: "Postulación Diseñadora UX - Ana Pérez", pending: false })
  })
  it("deja el marcador y avisa si falta el dato", () => {
    expect(fillSubject("Postulación - {nombre}", {})).toEqual({ text: "Postulación - {nombre}", pending: true })
  })
  it("un asunto sin marcadores no cambia", () => {
    expect(fillSubject("REF-123", { name: "Ana" })).toEqual({ text: "REF-123", pending: false })
  })
})

describe("detectApply guarda el asunto", () => {
  it("lo incluye solo si la oferta lo pide", () => {
    const a = detectApply({ sourceUrl: "texto:abc", text: "Envía tu CV a rrhh@acme.com con el asunto \"Diseñador UX/UI\"." })
    expect(a.subject).toBe("Diseñador UX/UI")
    expect(detectApply({ sourceUrl: "texto:abc", text: "Envía tu CV a rrhh@acme.com." })).not.toHaveProperty("subject")
  })
})
