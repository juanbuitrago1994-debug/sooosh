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
    // frases que salen de partir la frase de apertura por «en»
    expect(plausibleCompany("crecimiento. ¿Qué buscamos?", o)).toBe(false)
    expect(plausibleCompany("una empresa en crecimiento", o)).toBe(false)
    expect(plausibleCompany("Acme S.A.S", o)).toBe(true)
    expect(plausibleCompany("nubank", o)).toBe(true)
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

describe("revisión dato por dato", () => {
  const text = `Estamos seleccionando diseñadora UX/UI para un proyecto 100% remoto.
Nivel: Senior, con 3 a 5 años de experiencia. Contrato a término indefinido.
Salario: $4.000.000 COP al mes.
Dominio de Figma e inglés B2.
Envía tu hoja de vida a candidatos@consultoravos.com o postula en https://forms.gle/abc123`
  it("cada dato trae su estado y la frase de donde sale; lo que no está se marca «falta»", async () => {
    const { buildEvidence } = await import("@/lib/jobs/evidence")
    const bad = offer({ title: "🔹 Experiencia comprobable", requirements: ["Dominio de Figma e inglés B2"], tools: ["Figma"], languagesRequired: [{ language: "inglés", level: "B2" }], seniority: "senior", yearsExperience: { min: 3, max: 5 } })
    const d = buildDraft({ offer: bad, text, url: "https://www.linkedin.com/posts/x-1/", fallbackHash: "h" })
    const ev = Object.fromEntries(buildEvidence(d, text).map((e) => [e.key, e]))
    expect(ev.titulo).toMatchObject({ status: "inferido", value: "Diseñadora UX/UI" })
    expect(ev.titulo.quote).toContain("Estamos seleccionando")
    expect(ev.empresa).toMatchObject({ status: "falta" })
    expect(ev.modalidad).toMatchObject({ status: "texto", value: "Remoto" })
    expect(ev.modalidad.quote).toContain("remoto")
    expect(ev.nivel.quote).toContain("Senior")
    expect(ev.experiencia).toMatchObject({ status: "texto", value: "3–5 años" })
    expect(ev.salario.quote).toContain("4.000.000")
    expect(ev.idiomas.quote).toContain("inglés")
    expect(ev.postulacion.quote).toContain("candidatos@consultoravos.com")
    expect(ev.region).toMatchObject({ status: "inferido", value: "Todas" })
    expect(ev.contrato.quote).toContain("indefinido")
  })
  it("la cita es una frase corta del texto, no un párrafo", async () => {
    const { findQuote } = await import("@/lib/jobs/evidence")
    const long = `${"Texto de relleno sin importancia. ".repeat(12)}Salario: 5.000 USD al mes. ${"Más relleno. ".repeat(10)}`
    const q = findQuote(long, (l) => l.includes("5.000 USD"))
    expect(q).toBe("Salario: 5.000 USD al mes.")
    expect(findQuote("nada que ver", () => false)).toBeUndefined()
  })
  it("«Quitar» deja el dato como «No indicado» y no se puede quitar el cargo ni las listas", async () => {
    const { clearPatch, fieldValues } = await import("@/lib/jobs/field-values")
    const d = buildDraft({ offer: offer({ title: "Senior UX/UI Designer", seniority: "senior", yearsExperience: { min: 3 } }), text, fallbackHash: "h" })
    expect(fieldValues(d).experiencia).toBe("3+ años")
    expect(fieldValues({ ...d, ...clearPatch("experiencia", d)! }).experiencia).toBeUndefined()
    expect(fieldValues({ ...d, ...clearPatch("nivel", d)! }).nivel).toBeUndefined()
    expect(clearPatch("titulo", d)).toBeNull()
    expect(clearPatch("requisitos", d)).toBeNull()
  })
})

describe("la empresa de la página manda sobre la deducida del texto", () => {
  const post = "Estamos seleccionando Diseñador/a UX/UI para sumarse al equipo de una empresa en crecimiento.  ¿Qué buscamos?\n🔹 Modalidad: Remoto."
  it("con empresa de la página, la tarjeta la usa y la evidencia dice de dónde sale; la fecha de la fuente decide si es «Nueva»", async () => {
    const { buildEvidence } = await import("@/lib/jobs/evidence")
    const o = offer({ title: "Estamos seleccionando Diseñador/a UX/UI", company: "crecimiento. ¿Qué buscamos?" })
    const d = buildDraft({ offer: o, text: post, url: "https://www.linkedin.com/posts/x", company: "Vos Consultora", ld: { datePosted: "2026-10-29T19:17:30.572Z" }, fallbackHash: "h" })
    expect(d.company).toBe("Vos Consultora")
    expect(d.postedAt).toBe("2026-10-29T19:17:30.572Z")
    const ev = buildEvidence(d, post, { companyFrom: "pagina" }).find((e) => e.key === "empresa")!
    expect(ev).toMatchObject({ status: "texto", value: "Vos Consultora" })
    expect(ev.quote).toContain("LinkedIn")
  })
  it("«Nueva» cuenta desde la fecha de publicación, no desde la de carga", async () => {
    const { jobCols } = await import("@/lib/jobs/search")
    const { PgDialect } = await import("drizzle-orm/pg-core")
    const q = new PgDialect().sqlToQuery(jobCols.isNew as never).sql
    expect(q).toContain("coalesce")
    expect(q).toContain("posted_at")
  })
})
