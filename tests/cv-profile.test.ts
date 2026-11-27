import { describe, expect, it } from "vitest"
import { actionVerb, buildCvProfile, clichesIn, cvProfileSchema, metricsIn } from "@/lib/analysis/cv-profile"
import type { CV } from "@/lib/schemas/cv"

const NOW = new Date(2026, 10, 18)
const cv: CV = {
  header: { fullName: "Ana Torres", headline: "Analista de Datos", email: "ana@mail.com", phone: "", location: "Lima", links: [] },
  summary: "Persona proactiva y dinámica con 6 años de experiencia en análisis de datos. Experta en SQL.",
  experience: [
    { company: "Globex", role: "Analista Sr", startDate: "Mar 2023", endDate: "Actual", bullets: ["Reduje el tiempo de reporte en 40% con SQL y Python", "Responsable de los reportes semanales", "Lideré un equipo de 5 analistas"] },
    { company: "Initech", role: "Analista", startDate: "Ene 2020", endDate: "Dic 2021", bullets: ["Desarrollé dashboards en Power BI", "Participé en reuniones de equipo"] },
    { company: "Hooli", role: "Asistente", startDate: "2017", endDate: "2018", bullets: [] },
  ],
  education: [{ institution: "UNI", degree: "Ingeniería de Sistemas", field: "", startDate: "2012", endDate: "2017", details: [] }],
  skills: [{ category: "Datos", items: ["SQL", "Python", "Power BI", "Airflow"] }],
  languages: [{ name: "Inglés", level: "B2" }],
  projects: [], certifications: [], volunteering: [], awards: [], publications: [],
}

describe("perfil del CV por secciones (K3)", () => {
  const p = buildCvProfile(cv, NOW)
  it("valida contra su esquema y es determinista", () => {
    expect(cvProfileSchema.safeParse(p).success).toBe(true)
    expect(buildCvProfile(cv, NOW)).toEqual(p)
  })
  it("calcula años sin contar solapes, duración por puesto y puesto actual", () => {
    expect(p.experience[0]).toMatchObject({ current: true, endedYearsAgo: 0 })
    expect(p.experience[1].months).toBe(24)
    expect(p.totalYears).toBeGreaterThan(6)
  })
  it("detecta cronología inversa y huecos con evidencia literal", () => {
    expect(p.chronology).toBe("inversa")
    // Hooli (2017–2018) → Initech (Ene 2020): 12 meses; Initech (Dic 2021) → Globex (Mar 2023): 14 meses.
    expect(p.gaps.map((g) => [g.after, g.months, g.evidence])).toEqual([["Hooli", 12, "Ene 2020"], ["Initech", 14, "Mar 2023"]])
    for (const g of p.gaps) expect(JSON.stringify(cv)).toContain(g.evidence)
    expect(buildCvProfile({ ...cv, experience: [...cv.experience].reverse() }, NOW).chronology).toBe("directa")
  })
  it("viñetas: cifras reales (no años), verbos de acción y tareas", () => {
    expect(p.bullets.total).toBe(5)
    expect(p.bullets.withMetrics).toBe(2) // 40% y 5 analistas
    expect(p.bullets.tasks).toBe(2) // «Responsable de…» y «Participé…»
    expect(p.bullets.items.find((b) => b.text.startsWith("Reduje"))!.verb).toBe("Reduje")
    expect(metricsIn("Trabajé de 2019 a 2021")).toEqual([])
    expect(metricsIn("Ahorré $12,000 y subí ventas 15%")).toEqual(expect.arrayContaining(["15%"]))
    expect(actionVerb("Responsable de reportes")).toBeNull()
  })
  it("resumen: clichés con texto literal y años mencionados", () => {
    expect(p.summary.cliches.length).toBeGreaterThan(0)
    for (const c of p.summary.cliches) expect(cv.summary).toContain(c)
    expect(p.summary.mentionsYears).toBe(6)
    expect(clichesIn("Analista con 5 años en pricing")).toEqual([])
  })
  it("habilidades: en contexto vs solo en lista", () => {
    expect(p.skills.inContext).toEqual(expect.arrayContaining(["SQL", "Python", "Power BI"]))
    expect(p.skills.listOnly).toEqual(["Airflow"])
    expect(p.skills.categorized).toBe(true)
  })
  it("contacto, educación, secciones y extensión", () => {
    expect(p.contact.missing).toEqual(["teléfono o enlace profesional"])
    expect(p.education.highest).toBe("grado")
    expect(p.sections).toMatchObject({ summary: true, experience: true, projects: false })
    expect(p.length.words).toBeGreaterThan(50)
  })
  it("un CV vacío no rompe nada y no inventa", () => {
    const empty = buildCvProfile({ header: { fullName: "X", links: [] }, experience: [], education: [], skills: [], languages: [], projects: [], certifications: [], volunteering: [], awards: [], publications: [] }, NOW)
    expect(cvProfileSchema.safeParse(empty).success).toBe(true)
    expect(empty).toMatchObject({ totalYears: null, chronology: "desconocida", bullets: { total: 0, metricRatio: 0 } })
  })
})
