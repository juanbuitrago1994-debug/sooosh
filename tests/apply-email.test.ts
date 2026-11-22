import { describe, expect, it } from "vitest"
import { DEFAULT_CONTACT, buildBody, buildSubject, personName, pickMatches, platformLabel, webLinks } from "@/lib/apply/email"
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

const ALL_OFF = { phone: false, email: false, city: false, linkedin: false, web: false, source: false }
const body = (over: Partial<Parameters<typeof buildBody>[0]> = {}) => buildBody({ cv: cv(), job, covered: [], contact: ALL_OFF, ...over })

describe("cuerpo", () => {
  it("lleva solo datos del CV y de la oferta", () => {
    const b = body({ cv: cv({ phone: "+57 300 000 0000", email: "ana@x.com", location: "Bogotá" }), covered: ["Figma", "Sistemas de diseño", "Investigación UX", "Prototipado"], contact: { ...DEFAULT_CONTACT } })
    expect(b).toContain("Hola, equipo de Vos Consultora:")
    expect(b).toContain("vacante de Diseñador/a UX/UI")
    expect(b).toContain("• Figma\n• Sistemas de diseño\n• Investigación UX")
    expect(b).not.toContain("Prototipado")
    expect(b).toMatch(/Ana Pérez\n\+57 300 000 0000 · ana@x\.com$/)
    expect(b).not.toContain("Bogotá")
    expect(b).not.toMatch(/[{}]|undefined|null/)
  })
  it("omite coincidencias si hay menos de 2, y empresa/teléfono/correo si faltan", () => {
    const b = body({ job: { title: "Analista" }, covered: ["SQL"] })
    expect(b).not.toContain("•")
    expect(b).toMatch(/^Hola:/)
    expect(b.endsWith("Ana Pérez")).toBe(true)
  })
  it("cada dato de la firma sale solo si la persona lo dejó encendido y el CV lo trae", () => {
    const withData = cv({ phone: "+57 300", email: "ana@x.com", location: "Bogotá" })
    expect(body({ cv: withData }).endsWith("Ana Pérez")).toBe(true)
    expect(body({ cv: withData, contact: { ...ALL_OFF, phone: true } }).endsWith("Ana Pérez\n+57 300")).toBe(true)
    expect(body({ cv: withData, contact: { ...ALL_OFF, city: true, email: true } }).endsWith("Ana Pérez\nana@x.com · Bogotá")).toBe(true)
    // encendido pero sin dato en el CV: no aparece nada
    expect(body({ cv: cv(), contact: { ...DEFAULT_CONTACT } }).endsWith("Ana Pérez")).toBe(true)
  })
  it("LinkedIn y portafolio van en la firma, y solo si están encendidos", () => {
    const withLinks = cv({ links: [{ label: "Portafolio", url: "https://ana.design" }, { label: "LinkedIn", url: "https://linkedin.com/in/ana" }] })
    expect(body({ cv: withLinks })).not.toMatch(/ana\.design|linkedin/)
    const b = body({ cv: withLinks, contact: { ...ALL_OFF, web: true, linkedin: true } })
    expect(b.endsWith("Ana Pérez\nLinkedIn: https://linkedin.com/in/ana\nPortafolio: https://ana.design")).toBe(true)
    expect(body({ cv: withLinks, contact: { ...ALL_OFF, web: true } })).not.toContain("linkedin")
    expect(body({ cv: cv(), contact: { ...ALL_OFF, web: true } })).not.toMatch(/https?:/)
    expect(webLinks(withLinks)).toHaveLength(1)
  })
  it("el LinkedIn escrito a mano se usa solo si el CV no trae uno", () => {
    expect(body({ contact: { ...ALL_OFF, linkedin: true }, asks: { linkedin: "https://linkedin.com/in/yo" } })).toContain("LinkedIn: https://linkedin.com/in/yo")
    const withLi = cv({ links: [{ label: "LinkedIn", url: "https://linkedin.com/in/ana" }] })
    expect(body({ cv: withLi, contact: { ...ALL_OFF, linkedin: true }, asks: { linkedin: "https://linkedin.com/in/otro" } })).not.toContain("otro")
  })
  it("lo que pide la oferta entra solo con lo que la persona escribió", () => {
    const b = body({ asks: { salario: " $5.000.000 COP ", disponibilidad: "Inmediata", referencias: "" } })
    expect(b).toContain("Aspiración salarial: $5.000.000 COP\nDisponibilidad: Inmediata")
    expect(b).not.toContain("Referencias")
    expect(body({ asks: {} })).not.toMatch(/salarial|Disponibilidad/)
  })
  it("«dónde vi la oferta» solo con una plataforma conocida y si está encendido", () => {
    const li = { ...job, sourceName: "linkedin" }
    expect(body({ job: li, contact: { ...ALL_OFF, source: true } })).toContain("que vi publicada en LinkedIn")
    expect(body({ job: li })).not.toContain("que vi publicada")
    expect(body({ job: { ...job, sourceName: "manual" }, contact: { ...ALL_OFF, source: true } })).not.toContain("que vi publicada")
    expect(platformLabel("Indeed")).toBe("Indeed")
    expect(platformLabel(undefined)).toBeUndefined()
  })
  it("sin usted y sin adjuntar en la app", () => {
    expect(body()).not.toMatch(/\busted(es)?\b|\bsu tiempo\b/i)
  })
  it("pickMatches deduplica y limita a 3", () => {
    expect(pickMatches(["Figma", "figma", " ", "A", "B", "C"])).toEqual(["Figma", "A", "B"])
  })
})
