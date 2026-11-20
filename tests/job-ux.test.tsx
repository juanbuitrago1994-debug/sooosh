import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { JobCard } from "@/components/jobs/job-card"
import { applyCta, applyHint, applyLabel, detectApply } from "@/lib/jobs/apply"
import { buildDraft } from "@/lib/jobs/draft"
import { ago, buildFacts, yearsLabel } from "@/lib/jobs/facts"
import { detectSalary, formatSalary, parseAmount } from "@/lib/jobs/salary"
import type { JobCard as Job } from "@/lib/jobs/search"
import { jobDraftSchema } from "@/lib/jobs/store"
import { jobPostingFromJsonLd } from "@/lib/offer/html"
import { offerSchema } from "@/lib/schemas/offer"

describe("cómo se postula", () => {
  it("por el sitio de la oferta: portal, formulario de la empresa o sitio propio", () => {
    expect(detectApply({ sourceUrl: "https://www.linkedin.com/jobs/view/3912345678/" })).toEqual({ method: "plataforma", platform: "LinkedIn", url: "https://www.linkedin.com/jobs/view/3912345678/" })
    expect(detectApply({ sourceUrl: "https://co.computrabajo.com/ofertas-de-trabajo/x" }).platform).toBe("Computrabajo")
    expect(detectApply({ sourceUrl: "https://boards.greenhouse.io/acme/jobs/1" }).method).toBe("formulario")
    expect(detectApply({ sourceUrl: "https://jobs.lever.co/acme/abc" }).method).toBe("formulario")
    expect(detectApply({ sourceUrl: "https://careers.acme.com/jobs/1" }).method).toBe("sitio")
  })
  it("el enlace de postulación que entrega la fuente manda sobre el enlace de la oferta", () => {
    const a = detectApply({ sourceUrl: "https://www.linkedin.com/jobs/view/3912345678/", applyUrl: "https://jobs.lever.co/acme/abc/apply" })
    expect(a.method).toBe("formulario")
    expect(a.url).toBe("https://jobs.lever.co/acme/abc/apply")
  })
  it("correo: solo con un verbo de postulación cerca; un correo suelto no cuenta", () => {
    const a = detectApply({ sourceUrl: "texto:abc", text: "Interesados enviar hoja de vida al correo talento@acme.com antes del viernes." })
    expect(a).toEqual({ method: "correo", email: "talento@acme.com", url: "mailto:talento@acme.com" })
    expect(detectApply({ sourceUrl: "texto:abc", text: "Para dudas del proceso: rrhh@acme.com" }).method).toBe("desconocido")
  })
  it("un correo de postulación gana sobre un sitio de empresa genérico, pero no sobre un portal", () => {
    expect(detectApply({ sourceUrl: "https://careers.acme.com/1", text: "Envía tu CV a talento@acme.com" }).method).toBe("correo")
    expect(detectApply({ sourceUrl: "https://www.linkedin.com/jobs/view/3912345678/", text: "Envía tu CV a talento@acme.com" }).method).toBe("plataforma")
  })
  it("sin información no adivina", () => {
    expect(detectApply({ sourceUrl: "texto:abc", text: "Buscamos diseñador." })).toEqual({ method: "desconocido" })
  })
  it("frases para la tarjeta, el botón y la ayuda", () => {
    expect(applyLabel({ method: "plataforma", platform: "LinkedIn" })).toBe("Se aplica en LinkedIn")
    expect(applyLabel({ method: "formulario" })).toBe("Formulario de la empresa")
    expect(applyLabel({ method: "correo", email: "a@b.co" })).toBe("Se aplica por correo")
    expect(applyLabel(null)).toBe("Ver la oferta original")
    expect(applyCta({ method: "plataforma", platform: "Indeed" })).toBe("Postular en Indeed")
    expect(applyHint({ method: "correo", email: "a@b.co" })).toContain("a@b.co")
    expect(applyHint({ method: "plataforma", platform: "LinkedIn" })).toContain("iniciar sesión")
  })
})

describe("salario solo con moneda explícita", () => {
  it("rangos con moneda y palabra de salario", () => {
    expect(detectSalary("Salario: COP 4.000.000 - 6.000.000 mensuales")).toEqual({ min: 4_000_000, max: 6_000_000, currency: "COP", period: "mes" })
    expect(detectSalary("Sueldo: USD 4k – 6k")).toEqual({ min: 4000, max: 6000, currency: "USD", period: "mes" })
    expect(detectSalary("Compensación: 3.500 dólares al año")).toEqual({ min: 3500, currency: "USD", period: "año" })
    expect(detectSalary("Pago: USD 25 por hora")?.period).toBe("hora")
  })
  it("no inventa: sin moneda, sin palabra de salario o sin monto → null", () => {
    expect(detectSalary("Salario competitivo y bonos")).toBeNull()
    expect(detectSalary("Salario: $5.000.000")).toBeNull() // «$» solo: no se sabe la moneda
    expect(detectSalary("Manejarás un presupuesto de USD 10.000 para campañas")).toBeNull()
  })
  it("números con separadores de miles de la región y en inglés", () => {
    expect(parseAmount("4.500.000")).toBe(4_500_000)
    expect(parseAmount("4,500")).toBe(4500)
    expect(parseAmount("4", "millones")).toBe(4_000_000)
    expect(parseAmount("2.5", "k")).toBe(2500)
  })
  it("formato legible", () => {
    expect(formatSalary({ min: 4_000_000, max: 6_000_000, currency: "COP", period: "mes" })).toMatch(/^COP 4\.000\.000 – 6\.000\.000 al mes$/)
    expect(formatSalary({ min: 3000, currency: "USD", period: "año" })).toMatch(/^USD 3\.000 al año$/)
  })
})

const offer = (extra: object = {}) => offerSchema.parse({ title: "Product Designer", company: "Acme", language: "es", requirements: ["Figma"], ...extra })
const job = (over: Partial<Job> = {}): Job => ({
  id: "11111111-1111-4111-8111-111111111111", title: "Product Designer", company: "Acme", locationText: "Bogotá, Colombia", country: "CO", regions: ["CO", "LATAM"], workMode: null, remoteScope: null,
  employmentType: null, seniority: null, language: "es", skills: [], apply: null, salary: null, roleFamily: null, isTech: true, sourceName: "linkedin", sourceUrl: "https://www.linkedin.com/jobs/view/1/", postedAt: null, createdAt: "2026-11-19T00:00:00Z", offer: offer(), ...over,
})

describe("datos que sí tenemos", () => {
  it("solo aparecen los datos que existen", () => {
    expect(buildFacts(job())).toEqual([])
    const f = buildFacts(job({ workMode: "hibrido", salary: { min: 4_000_000, max: 6_000_000, currency: "COP", period: "mes" }, offer: offer({ yearsExperience: { min: 5 } }) }))
    expect(f.map((x) => [x.key, x.value])).toEqual([["exp", "5+ años"], ["salario", "COP 4.000.000 – 6.000.000 al mes"], ["modalidad", "Híbrido"]])
  })
  it("experiencia en sus variantes y fecha relativa solo con la fecha de la fuente", () => {
    expect(yearsLabel({ min: 3, max: 5 })).toBe("3–5 años")
    expect(yearsLabel({ min: 0 })).toBe("Sin experiencia")
    expect(yearsLabel({ max: 2 })).toBe("Hasta 2 años")
    expect(yearsLabel({})).toBeNull()
    const now = new Date("2026-11-19T12:00:00Z")
    expect(ago("2026-11-19T08:00:00Z", now)).toBe("hoy")
    expect(ago("2026-11-16T00:00:00Z", now)).toBe("hace 3 días")
    expect(ago("2026-09-01T00:00:00Z", now)).toBe("hace 2 meses")
    expect(ago(null, now)).toBeNull()
  })
})

describe("tarjeta de oferta", () => {
  it("con pocos datos: título, empresa y cómo se postula; sin etiquetas vacías", () => {
    const html = renderToStaticMarkup(<JobCard job={job({ apply: { method: "plataforma", platform: "LinkedIn" } })} />)
    expect(html).toContain("Product Designer")
    expect(html).toContain("Acme · Bogotá, Colombia")
    expect(html).toContain("Se aplica en LinkedIn")
    expect(html).toContain('href="/ofertas/11111111-1111-4111-8111-111111111111"')
    for (const t of ["Salario", "Experiencia", "Modalidad", "No indica", "encaje"]) expect(html).not.toContain(t)
  })
  it("con más datos: hasta 3 datos clave y el encaje si hay CV", () => {
    const html = renderToStaticMarkup(
      <JobCard job={{ ...job({ workMode: "remoto", employmentType: "Tiempo completo", skills: ["Figma", "Jira"], apply: { method: "formulario" }, salary: { min: 3000, currency: "USD", period: "mes" }, offer: offer({ yearsExperience: { min: 4 } }) }), fit: { score: 78, match: true, covered: 3, missing: [] } }} />,
    )
    expect(html).toContain("Experiencia")
    expect(html).toContain("4+ años")
    expect(html).toContain("USD 3.000 al mes")
    expect(html).toContain("Remoto")
    expect(html).not.toContain("Tiempo completo") // el 4.º dato queda para el detalle
    expect(html).toContain("Match 78 %")
    expect(html).toContain("Formulario de la empresa")
    expect(html).toContain("Figma")
  })
})

describe("borrador con camino de postulación y salario", () => {
  const o = offer()
  it("LinkedIn → «Se aplica en LinkedIn»; el salario sale del texto cuando trae moneda", () => {
    const d = buildDraft({ offer: o, text: "Product Designer\nSalario: COP 5.000.000 - 7.000.000 mensuales", url: "https://co.linkedin.com/jobs/view/t-3912345678?trk=x", fallbackHash: "h" })
    expect(d.apply).toMatchObject({ method: "plataforma", platform: "LinkedIn" })
    expect(d.salary).toEqual({ min: 5_000_000, max: 7_000_000, currency: "COP", period: "mes" })
    expect(jobDraftSchema.safeParse(d).success).toBe(true)
  })
  it("el JSON-LD (baseSalary) manda sobre el texto", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title: "Dev", description: "<p>x</p>", baseSalary: { "@type": "MonetaryAmount", currency: "usd", value: { minValue: 3000, maxValue: 4000, unitText: "MONTH" } } })}</script>`
    const ld = jobPostingFromJsonLd(html)!.ld
    expect(ld.salary).toEqual({ min: 3000, max: 4000, currency: "USD", period: "mes" })
    expect(buildDraft({ offer: o, text: "Salario: COP 1.000.000", ld, fallbackHash: "h" }).salary).toMatchObject({ currency: "USD", min: 3000 })
  })
  it("sin enlace ni correo: «Ver la oferta original»; sin monto: no hay salario", () => {
    const d = buildDraft({ offer: o, text: "Buscamos diseñador. Salario competitivo.", fallbackHash: "h" })
    expect(d.apply.method).toBe("desconocido")
    expect(d.salary).toBeUndefined()
  })
})
