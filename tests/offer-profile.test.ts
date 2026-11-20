import { describe, expect, it } from "vitest"
import { buildOfferProfile, offerProfileSchema, roleFamily, skillsIn } from "@/lib/analysis/offer-profile"
import { fold } from "@/lib/keywords/normalize"
import { SKILLS } from "@/lib/taxonomy/skills"
import type { Offer } from "@/lib/schemas/offer"

const offer: Offer = {
  title: "Analista de Datos Senior (Híbrido)",
  company: "Initech",
  language: "es",
  seniority: "senior",
  yearsExperience: { min: 3 },
  requirements: [
    "Mínimo 3 años de experiencia en SQL y Python (indispensable)",
    "Dominio de Power BI para construir dashboards",
    "Licenciatura en Ingeniería de Sistemas o afines",
    "Comunicación efectiva con stakeholders",
    "Experiencia con el ciclo completo de vida del dato",
  ],
  niceToHave: ["Se valora certificación AWS Certified", "Conocimientos de Airflow", "Experiencia en fintech"],
  responsibilities: ["Construir tableros para el equipo comercial", "Presentar hallazgos a la gerencia", "Mantener pipelines ETL"],
  tools: ["SQL", "Python", "Power BI"],
  softSkills: ["Trabajo en equipo"],
  languagesRequired: [{ language: "Inglés", level: "B2" }],
}
const raw = "Buscamos analista. SQL es clave: SQL diario, SQL avanzado. Python y Power BI. Se valora Airflow. Sector fintech."

describe("perfil enriquecido de la oferta (K2)", () => {
  const p = buildOfferProfile(offer, raw)
  const term = (id: string) => p.terms.find((t) => t.canonical === id)

  it("valida contra su esquema y es determinista (misma entrada, misma salida)", () => {
    expect(offerProfileSchema.safeParse(p).success).toBe(true)
    expect(buildOfferProfile(offer, raw)).toEqual(p)
  })
  it("separa obligatorio, deseable y contexto", () => {
    expect(term("sql")?.necessity).toBe("obligatorio")
    expect(term("airflow")?.necessity).toBe("deseable")
    expect(term("etl")?.necessity).toBe("contexto")
  })
  it("clasifica por categoría usando la taxonomía", () => {
    expect(term("sql")?.category).toBe("herramienta")
    expect(term("communication")?.category).toBe("transversal")
    expect(term("aws-cert")?.category).toBe("certificacion")
    expect(term("data-viz")?.category).toBe("tecnica")
  })
  it("el énfasis y la repetición suben el peso; lo obligatorio pesa más que lo deseable", () => {
    expect(term("sql")!.weight).toBeGreaterThan(term("power-bi")!.weight)
    expect(term("sql")!.mentions).toBeGreaterThanOrEqual(3)
    expect(term("sql")!.weight).toBeGreaterThan(term("airflow")!.weight)
  })
  it("conserva la frase exacta de la oferta y los años por habilidad", () => {
    expect(term("sql")!.atsPhrase).toContain("SQL y Python")
    expect(term("sql")!.years).toBe(3)
    expect(term("airflow")!.years).toBeNull()
  })
  it("normaliza alias (es/en) a la misma habilidad", () => {
    expect(skillsIn("Experiencia con tableros y análisis de datos").map((s) => s.id)).toEqual(expect.arrayContaining(["data-viz", "data-analysis"]))
    expect(skillsIn("project management y metodologías ágiles").map((s) => s.id)).toEqual(expect.arrayContaining(["project-mgmt", "agile"]))
  })
  it("no confunde palabras comunes con herramientas (Swift, Notion, Slack solo con mayúscula)", () => {
    expect(skillsIn("a swift response and a notion of slack").map((s) => s.id)).toEqual([])
    expect(skillsIn("Experiencia en Swift y Notion").map((s) => s.id)).toEqual(["swift", "notion"])
  })
  it("no pierde lo que la taxonomía no conoce", () => {
    expect(p.terms.some((t) => t.canonical === null && t.atsPhrase.includes("ciclo completo de vida del dato"))).toBe(true)
  })
  it("idiomas, educación, certificaciones, dominio, rol y seniority", () => {
    expect(p.terms.some((t) => t.category === "idioma" && t.label === "Inglés B2")).toBe(true)
    expect(p.education).toMatchObject({ level: "grado", required: true })
    expect(p.education.fields).toContain("sistemas")
    expect(p.certifications).toEqual(["AWS Certified"])
    expect(p.domains).toContain("Fintech")
    expect(p.role).toBe("analista de datos")
    expect(p.seniority).toBe("senior")
    expect(p.years.min).toBe(3)
  })
  it("nunca añade habilidades que la oferta no nombra", () => {
    const canon = p.terms.map((t) => t.canonical).filter(Boolean) as string[]
    const text = fold([raw, ...offer.requirements, ...offer.niceToHave, ...offer.responsibilities, ...(offer.tools ?? []), ...(offer.softSkills ?? [])].join("\n"))
    for (const id of canon) {
      const sk = SKILLS.find((s) => s.id === id)!
      expect(sk.aliases.some((a) => text.includes(fold(a)))).toBe(true)
    }
  })
  it("roleFamily quita nivel, paréntesis y conectores de los extremos", () => {
    expect(roleFamily("Sr. Software Engineer | Remoto")).toBe("software engineer")
    expect(roleFamily("Desarrollador Backend Junior")).toBe("desarrollador backend")
  })
})

describe("robustez ante etiquetas erróneas del modelo", () => {
  it("encabezados como «Se valora:» no son términos, y una línea con una habilidad conocida no se duplica como brecha", () => {
    const messy: Offer = { ...offer, requirements: [...offer.requirements, "Se valora:", "Conocimientos de Airflow."], niceToHave: ["Conocimientos de Airflow", "Responsabilidades:"], responsibilities: [] }
    const p = buildOfferProfile(messy)
    expect(p.terms.some((t) => /^se valora/i.test(t.label) || /:$/.test(t.label))).toBe(false)
    expect(p.terms.filter((t) => /airflow/i.test(t.atsPhrase) || t.canonical === "airflow")).toHaveLength(1)
  })
})

describe("taxonomía local", () => {
  it("ids únicos y ningún alias compartido entre habilidades distintas", () => {
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length)
    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const s of SKILLS) for (const a of s.aliases.map(fold)) {
      if (seen.has(a) && seen.get(a) !== s.id) clashes.push(`${a}: ${seen.get(a)} / ${s.id}`)
      seen.set(a, s.id)
    }
    expect(clashes).toEqual([])
  })
})
