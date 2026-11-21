import { describe, expect, it } from "vitest"
import { buildBody, buildSubject, personName, pickMatches, webLinks } from "@/lib/apply/email"
import type { CV } from "@/lib/schemas/cv"

const cv = (header: Partial<CV["header"]> = {}): CV => ({ header: { fullName: "Ana Pérez", links: [], ...header }, experience: [], education: [], skills: [], languages: [], projects: [] }) as CV
const job = { title: "Diseñador/a UX/UI", company: "Vos Consultora" }

describe("asunto", () => {
  it("plantilla sin asunto detectado", () => {
    expect(buildSubject({ cv: cv(), job })).toEqual({ text: "Postulación: Diseñador/a UX/UI – Ana Pérez", fromOffer: false, pending: false })
  })
  it("usa el asunto de la oferta y rellena marcadores", () => {
    expect(buildSubject({ detected: "Postulación [Cargo] - [Tu nombre]", cv: cv(), job }).text).toBe("Postulación Diseñador/a UX/UI - Ana Pérez")
    expect(buildSubject({ detected: "REF-123", cv: cv(), job })).toMatchObject({ text: "REF-123", fromOffer: true })
  })
  it("sin nombre en el CV, el asunto no lo inventa", () => {
    expect(buildSubject({ cv: cv({ fullName: "Sin nombre" }), job }).text).toBe("Postulación: Diseñador/a UX/UI")
    expect(personName(cv({ fullName: "Sin nombre" }))).toBeUndefined()
  })
})

describe("cuerpo", () => {
  it("lleva solo datos del CV y de la oferta", () => {
    const body = buildBody({ cv: cv({ phone: "+57 300 000 0000", email: "ana@x.com" }), job, covered: ["Figma", "Sistemas de diseño", "Investigación UX", "Prototipado"], includeWeb: false })
    expect(body).toContain("Hola, equipo de Vos Consultora:")
    expect(body).toContain("vacante de Diseñador/a UX/UI")
    expect(body).toContain("• Figma\n• Sistemas de diseño\n• Investigación UX")
    expect(body).not.toContain("Prototipado")
    expect(body).toMatch(/Ana Pérez\n\+57 300 000 0000 · ana@x\.com$/)
    expect(body).not.toMatch(/[{}]|undefined|null/)
  })
  it("omite coincidencias si hay menos de 2, y empresa/teléfono/correo si faltan", () => {
    const body = buildBody({ cv: cv(), job: { title: "Analista" }, covered: ["SQL"], includeWeb: false })
    expect(body).not.toContain("•")
    expect(body).toMatch(/^Hola:/)
    expect(body.endsWith("Ana Pérez")).toBe(true)
  })
  it("el portafolio solo entra si la persona lo pidió y existe en el CV", () => {
    const withLinks = cv({ links: [{ label: "Portafolio", url: "https://ana.design" }, { label: "LinkedIn", url: "https://linkedin.com/in/ana" }] })
    expect(buildBody({ cv: withLinks, job, covered: [], includeWeb: false })).not.toContain("ana.design")
    const b = buildBody({ cv: withLinks, job, covered: [], includeWeb: true })
    expect(b).toContain("Portafolio: https://ana.design")
    expect(b).not.toContain("linkedin")
    expect(buildBody({ cv: cv(), job, covered: [], includeWeb: true })).not.toMatch(/https?:/)
    expect(webLinks(withLinks)).toHaveLength(1)
  })
  it("sin usted y sin adjuntar en la app", () => {
    const b = buildBody({ cv: cv(), job, covered: [], includeWeb: false })
    expect(b).not.toMatch(/\busted(es)?\b|\bsu tiempo\b/i)
  })
  it("pickMatches deduplica y limita a 3", () => {
    expect(pickMatches(["Figma", "figma", " ", "A", "B", "C"])).toEqual(["Figma", "A", "B"])
  })
})
