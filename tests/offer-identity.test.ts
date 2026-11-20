import { describe, expect, it } from "vitest"
import { buildDraft } from "@/lib/jobs/draft"
import { companyLine } from "@/lib/jobs/facts"
import { classifyRole } from "@/lib/jobs/classify"
import { isSectionHeading, plausibleCompany, plausibleTitle, refineIdentity, titleFromHook } from "@/lib/offer/identity"
import { offerSchema, type Offer } from "@/lib/schemas/offer"

const POST = `Estamos seleccionando diseñadora UX/UI para un proyecto remoto con una consultora aliada.

🔹 Experiencia comprobable
diseño de interfaces (UI) e investigación de experiencia de usuario
Dominio de Figma y Design Systems

Envía tu hoja de vida a candidatos@consultoravos.com`

const offer = (over: Partial<Offer>): Offer =>
  offerSchema.parse({ title: "x", language: "es", requirements: [], niceToHave: [], responsibilities: [], ...over })

describe("encabezados y cargos", () => {
  it("reconoce encabezados de sección, no cargos con emoji", () => {
    expect(isSectionHeading("🔹 Experiencia comprobable")).toBe(true)
    expect(isSectionHeading("Requisitos:")).toBe(true)
    expect(isSectionHeading("🚀 Diseñadora UX/UI")).toBe(false)
    expect(isSectionHeading("Product Designer")).toBe(false)
  })
  it("un encabezado o una frase de apertura no es un cargo", () => {
    expect(plausibleTitle("🔹 Experiencia comprobable")).toBe(false)
    expect(plausibleTitle("Estamos seleccionando diseñadora UX/UI")).toBe(false)
    expect(plausibleTitle("Senior UX/UI Designer")).toBe(true)
  })
  it("deduce el cargo de la frase de apertura, tal como está escrito", () => {
    expect(titleFromHook(POST)).toBe("Diseñadora UX/UI")
    expect(titleFromHook("We're hiring a Data Engineer for our team")).toBe("Data Engineer")
    expect(titleFromHook("Buenos días a todos, comparto una novedad")).toBeUndefined()
  })
})

describe("empresa", () => {
  const o = offer({ requirements: ["diseño de interfaces (UI) e investigación de experiencia de usuario"] })
  it("rechaza una frase de requisito como empresa y acepta nombres reales", () => {
    expect(plausibleCompany("diseño de interfaces (UI) e investigación de experiencia de usuario", o)).toBe(false)
    expect(plausibleCompany("Banco de Bogotá", o)).toBe(true)
    expect(plausibleCompany("Mercado Libre", o)).toBe(true)
    expect(plausibleCompany("Requisitos:", o)).toBe(false)
  })
  it("sin empresa, la tarjeta dice dónde se publicó", () => {
    expect(companyLine({ company: "Acme", sourceName: "linkedin" })).toBe("Acme")
    expect(companyLine({ company: null, sourceName: "linkedin" })).toBe("Publicado en LinkedIn")
    expect(companyLine({ company: null, sourceName: "manual" })).toBeUndefined()
  })
})

describe("la publicación de LinkedIn sin título", () => {
  const bad = offer({ title: "🔹 Experiencia comprobable", company: "diseño de interfaces (UI) e investigación de experiencia de usuario", requirements: ["diseño de interfaces (UI) e investigación de experiencia de usuario"], tools: ["Figma", "Systems", "Trabajo"] })
  it("refina el cargo (inferido) y descarta la empresa falsa", () => {
    expect(refineIdentity(bad, POST)).toEqual({ title: "Diseñadora UX/UI", titleSource: "inferido", company: undefined })
  })
  it("sin frase de apertura, el cargo queda vacío y marcado como faltante", () => {
    expect(refineIdentity(bad, "🔹 Experiencia comprobable\nDominio de Figma")).toMatchObject({ title: "", titleSource: "falta" })
  })
  it("el borrador queda clasificado como tecnología, abierto a todas las regiones y sin habilidades basura", () => {
    const d = buildDraft({ offer: bad, text: POST, url: "https://www.linkedin.com/posts/x-7521651446090559488-uzUA/", fallbackHash: "h" })
    expect(d).toMatchObject({ title: "Diseñadora UX/UI", titleSource: "inferido", workMode: "remoto" })
    expect(d.company).toBeUndefined()
    expect(d.regions).toEqual(["TODAS"])
    expect(d.skills).toContain("Figma")
    expect(d.skills.map((s) => s.toLowerCase())).not.toContain("trabajo")
    expect(d.skills.map((s) => s.toLowerCase())).not.toContain("systems")
    expect(d.roleFamily).toBe("diseno-digital")
    expect(classifyRole({ title: d.title, skills: d.skills }).family).toBe("diseno-digital")
    expect(d.apply.alt?.[0]).toMatchObject({ method: "correo", email: "candidatos@consultoravos.com" })
  })
})

describe("la tarjeta guardada se encuentra en el buscador", () => {
  it("el filtro de región deja pasar las tarjetas «TODAS» en cualquier región, y no filtra con «TODAS»", async () => {
    const { PgDialect } = await import("drizzle-orm/pg-core")
    const { regionFilter } = await import("@/lib/jobs/search")
    const dialect = new PgDialect()
    for (const region of ["CO", "LATAM", "US"]) {
      const q = dialect.sqlToQuery(regionFilter(region)!)
      expect(q.params).toContain("TODAS")
      expect(q.sql).toContain("@>")
    }
    expect(regionFilter("TODAS")).toBeUndefined()
  })
})
