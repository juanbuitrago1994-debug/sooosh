import { describe, expect, it } from "vitest"
import { classifyRole, isTechFamily } from "@/lib/jobs/classify"
import { isMatch, MATCH_MIN } from "@/lib/jobs/match"
import { rankByFit } from "@/lib/jobs/rank"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"
import type { JobCard } from "@/lib/jobs/search"

const fam = (title: string, extra: { department?: string; skills?: string[] } = {}) => classifyRole({ title, ...extra }).family

describe("familia de cargo por el título (sin IA)", () => {
  it.each([
    ["Full-Stack Senior Node.js", "desarrollo"],
    ["Desarrolladores de SW", "desarrollo"],
    ["Arquitecto/a de Soluciones TI Senior", "consultoria-ti"],
    ["Data Engineer Semi Senior – AWS & Data Governance", "datos"],
    ["Cientista de Datos", "datos"],
    ["Staff Data Scientist / Machine Learning Engineer", "datos"],
    ["Senior UX/UI Designer", "diseno-digital"],
    ["UX y Design Systems", "diseno-digital"],
    ["Senior Product Manager - Marketplace", "producto"],
    ["Product Builder", "producto"],
    ["DevOps Senior – AWS (LATAM)", "infraestructura"],
    ["Core Network Engineer", "infraestructura"],
    ["Senior Atqc – Automation Frameworks", "calidad"],
    ["SecOps Manager", "seguridad"],
    ["Junior IT Support Technician", "soporte-ti"],
    ["Analista de Soporte TI N1 – Mesa de Ayuda", "soporte-ti"],
    ["Consultor SAP Group Reporting", "consultoria-ti"],
    ["Jefe de Aplicaciones y Soluciones SAP", "consultoria-ti"],
    ["Engineering Director", "gestion-ti"],
    ["Engineering Manager, Data Acquisition", "gestion-ti"],
  ])("%s → %s (tecnología)", (title, family) => {
    const c = classifyRole({ title })
    expect(c.family).toBe(family)
    expect(c.tech).toBe(true)
  })
  it.each([
    ["Key Account Manager", "ventas"],
    ["SDR Outbound", "ventas"],
    ["Sales Engineer", "ventas"],
    ["Local SEO Specialist", "marketing"],
    ["Head of Brand Design", "marketing"],
    ["Diseñador Gráfico", "marketing"],
    ["Analista de Recaudación y Cobranza", "finanzas"],
    ["Contador Senior", "finanzas"],
    ["Customer Experience Analyst", "atencion"],
    ["Analista de Treinamento - Conteudista", "rrhh"],
    ["Project Manager Operations", "operaciones"],
    ["Privacy Manager", "legal"],
    ["Asistente administrativo", "administracion"],
  ])("%s → %s (no es tecnología)", (title, family) => {
    const c = classifyRole({ title })
    expect(c.family).toBe(family)
    expect(c.tech).toBe(false)
  })
  it("un título sin pista no se adivina", () => {
    expect(classifyRole({ title: "Agente de viajes" })).toEqual({ family: "otros", tech: false, basis: "ninguna" })
  })
})

describe("área que declara la fuente y habilidades", () => {
  it("el área decide cuando el título no alcanza, y el título manda cuando es claro", () => {
    expect(classifyRole({ title: "Especialista", department: "Programming" })).toMatchObject({ family: "desarrollo", basis: "area" })
    expect(fam("Analista", { department: "Data Science / Analytics" })).toBe("datos")
    expect(fam("Product Designer", { department: "Marketing" })).toBe("diseno-digital")
  })
  it("un área de operaciones deja a un analista cualquiera en operaciones, no en tecnología", () => {
    expect(fam("Analista", { department: "Operations / Management" })).toBe("operaciones")
  })
  it("«Engineer» genérico sin otra señal no es tecnología; con habilidades sí; las demás ingenierías, no", () => {
    expect(fam("Specialist")).toBe("otros")
    expect(fam("Specialist", { skills: ["Python", "SQL"] })).toBe("otros") // solo «engineer/ingeniero/developer» sube por habilidades
    expect(fam("Engineer", { skills: ["Python", "SQL"] })).toBe("desarrollo")
    expect(fam("Ingeniero Industrial", { skills: ["Excel", "SQL"] })).toBe("otros")
  })
  it("solo estas familias son «tecnología»", () => {
    expect(isTechFamily("diseno-digital") && isTechFamily("soporte-ti")).toBe(true)
    expect(isTechFamily("ventas") || isTechFamily("otros") || isTechFamily(null)).toBe(false)
  })
})

describe("match = encaje de 75 % o más", () => {
  it("el mínimo es 75 y el borde cuenta", () => {
    expect(MATCH_MIN).toBe(75)
    expect(isMatch(75)).toBe(true)
    expect(isMatch(74)).toBe(false)
    expect(isMatch(null)).toBe(false)
  })
  const cv = cvSchema.parse({ header: { fullName: "Ana" }, summary: "Diseñadora de producto.", experience: [{ company: "Acme", role: "Product Designer", startDate: "2020", bullets: ["Diseñé un design system en Figma usado por 4 equipos."] }], skills: [{ items: ["Figma", "Design systems"] }] })
  const job = (id: string, reqs: string[]): JobCard => ({
    id, title: "Cargo " + id, company: "X", locationText: null, country: null, regions: ["LATAM"], workMode: "remoto", remoteScope: null, employmentType: null, seniority: null, language: "es", skills: [], apply: null, salary: null,
    sourceName: "manual", sourceUrl: "https://x/" + id, postedAt: null, origin: "feed", isNew: false, createdAt: "2026-11-01T00:00:00Z", roleFamily: "diseno-digital", isTech: true,
    offer: offerSchema.parse({ title: "Cargo " + id, language: "es", requirements: reqs, tools: reqs }),
  })
  it("marca match solo cuando el encaje llega al mínimo, y es coherente con el puntaje", () => {
    const r = rankByFit([job("a", ["Figma", "Design systems"]), job("b", ["SQL", "Power BI"])], cv, "encaje")
    for (const j of r) expect(j.fit!.match).toBe(j.fit!.score >= 75)
    expect(r[0].fit!.score).toBeGreaterThan(r[1].fit!.score)
  })
  it("el segundo cálculo con el mismo CV y la misma oferta viene de caché y da lo mismo", () => {
    const a = rankByFit([job("a", ["Figma"])], cv, "encaje")[0].fit
    const b = rankByFit([job("a", ["Figma"])], cv, "encaje")[0].fit
    expect(b).toBe(a) // misma referencia = salió de la caché
  })
})
