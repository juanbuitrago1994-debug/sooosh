import { describe, expect, it } from "vitest"
import { completeness, nextMissing, profileChecklist } from "@/lib/cv/completeness"
import { describeFill, emptyCv } from "@/lib/cv/merge"
import type { CV } from "@/lib/schemas/cv"

const full: CV = {
  ...emptyCv(),
  header: { fullName: "Ana Pérez", headline: "Diseñadora", email: "ana@mail.com", phone: "+57 300", location: "Bogotá", taglines: ["Figma"], links: [{ label: "LinkedIn", url: "linkedin.com/in/ana" }] },
  summary: "Diseñadora de producto.",
  experience: [{ company: "Acme", role: "Diseñadora", startDate: "2020", bullets: ["Rediseñé el pago"] }],
  education: [{ institution: "UNAL", degree: "Diseño", startDate: "2014", endDate: "2019", details: [] }],
  skills: [{ items: ["Figma"] }],
  languages: [{ name: "Inglés" }],
}

describe("qué le falta al perfil", () => {
  it("vacío: 0 % y todo pendiente, de arriba hacia abajo (nombre primero)", () => {
    const c = completeness(emptyCv())
    expect(c).toMatchObject({ done: 0, percent: 0 })
    expect(c.missing.map((m) => m.id).slice(0, 8)).toEqual(["name", "headline", "taglines", "email", "phone", "location", "links", "summary"])
    expect(c.missing.map((m) => m.id).slice(8)).toEqual(["experience", "education", "skills", "languages"])
  })
  it("completo: 100 % y sin pendientes; proyectos, certificaciones, etc. no cuentan", () => {
    const c = completeness(full)
    expect(c).toMatchObject({ percent: 100 })
    expect(c.done).toBe(c.total)
    expect(c.missing).toEqual([])
  })
  it("cada campo cuenta por separado: quitar SOLO el teléfono baja la barra y lleva a ese campo", () => {
    const before = completeness(full)
    const after = completeness({ ...full, header: { ...full.header, phone: undefined } })
    expect(after.done).toBe(before.done - 1)
    expect(after.percent).toBeLessThan(before.percent)
    expect(after.missing.map((m) => [m.id, m.target])).toEqual([["phone", "header.phone"]])
  })
  it("dentro de cada puesto y estudio se piden sus datos clave, con su nombre", () => {
    const c = completeness({ ...full, experience: [{ company: "Acme", role: "X", startDate: "", bullets: [] }], education: [{ institution: "UNAL", details: [] }] })
    expect(c.missing.map((m) => m.label)).toEqual(["Fecha de inicio (Acme)", "Logros (Acme)", "Título (UNAL)", "Fechas (UNAL)"])
    expect(c.missing.find((m) => m.id === "experience.0.bullets")?.target).toBe("experience.0.bullets")
  })
  it("«Sin nombre» no cuenta como nombre", () => {
    const c = profileChecklist({ ...full, header: { ...full.header, fullName: "Sin nombre" } })
    expect(c.find((i) => i.id === "name")?.done).toBe(false)
  })
  it("tolera un CV sin listas", () => {
    const c = completeness({ header: { fullName: "Ana", links: [], taglines: [] } } as unknown as Partial<CV>)
    expect(c.missing.find((m) => m.id === "education")?.target).toBe("educacion")
  })
  it("el botón recorre los pendientes en orden y da la vuelta", () => {
    const { missing } = completeness(emptyCv())
    expect(nextMissing(missing)?.id).toBe(missing[0].id)
    expect(nextMissing(missing, missing[0].id)?.id).toBe(missing[1].id)
    expect(nextMissing(missing, missing[missing.length - 1].id)?.id).toBe(missing[0].id)
    expect(nextMissing([])).toBeNull()
  })
})

describe("qué cambiaría «Llenar con tu CV» (para mostrarlo antes)", () => {
  const incoming: CV = { ...full, header: { ...full.header, headline: "Product Designer", phone: "+57 300", taglines: ["Figma"] }, certifications: [{ name: "Google UX" }, { name: "NN/g" }] }
  it("lo vacío se llena y lo que ya tienes distinto se conserva (con aviso)", () => {
    const mine: CV = { ...emptyCv(), header: { fullName: "Ana Pérez", headline: "Mi título", taglines: [], links: [] }, experience: [{ company: "Mi empresa", role: "Líder", startDate: "2022", bullets: [] }] }
    const d = describeFill(mine, incoming)
    expect(d.fills).toEqual(expect.arrayContaining(["Correo", "Teléfono", "Ubicación", "Titulares (1)", "Enlaces (+1)", "Resumen profesional", "Educación (1)", "Certificaciones (2)"]))
    expect(d.fills).not.toContain("Título profesional")
    expect(d.keeps).toContain("Título profesional: conservas «Mi título»")
    expect(d.keeps.some((k) => k.startsWith("Experiencia: conservas tus 1; el archivo trae 1"))).toBe(true)
  })
  it("si el archivo trae lo mismo que ya tienes, no hay nada que completar ni que avisar", () => {
    expect(describeFill(incoming, incoming)).toEqual({ fills: [], keeps: [] })
  })
})
