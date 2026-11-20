import { afterEach, describe, expect, it } from "vitest"
import { requireAdmin } from "@/lib/jobs/admin"
import { buildDraft, detectEmploymentType, detectRemoteScope, detectWorkMode } from "@/lib/jobs/draft"
import { countryFromName, detectGeo, regionsFor } from "@/lib/jobs/geo"
import { jobDraftSchema } from "@/lib/jobs/store"
import { normalizeSourceUrl } from "@/lib/jobs/url"
import { jobPostingFromJsonLd } from "@/lib/offer/html"
import { offerSchema } from "@/lib/schemas/offer"

describe("dirección canónica de la oferta", () => {
  it("LinkedIn: solo importa el id numérico, sin rastreadores ni título", () => {
    const a = normalizeSourceUrl("https://co.linkedin.com/jobs/view/product-designer-at-acme-3912345678?trk=public_jobs&refId=abc#x")
    expect(a).toEqual({ url: "https://www.linkedin.com/jobs/view/3912345678/", source: "linkedin" })
    expect(normalizeSourceUrl("https://www.linkedin.com/jobs/search/?currentJobId=3912345678&keywords=x").url).toBe(a.url)
  })
  it("Indeed: la clave es jk", () => {
    expect(normalizeSourceUrl("https://co.indeed.com/viewjob?jk=abc123def&from=serp&vjs=3")).toEqual({ url: "https://co.indeed.com/viewjob?jk=abc123def", source: "indeed" })
  })
  it("otros sitios: quita utm_*, ancla y barra final; conserva parámetros que identifican la oferta", () => {
    const r = normalizeSourceUrl("http://www.Boards.greenhouse.io/acme/jobs/123/?utm_source=x&gh_jid=123&fbclid=z#apply")
    expect(r).toEqual({ url: "https://boards.greenhouse.io/acme/jobs/123?gh_jid=123", source: "greenhouse" })
  })
})

describe("geografía sin IA", () => {
  it("deduce país por ciudad y marca LATAM", () => {
    const g = detectGeo("Product Designer\nUbicación: Medellín, Antioquia. Trabajo híbrido.")
    expect(g.country).toBe("CO")
    expect(regionsFor(g)).toEqual(["CO", "LATAM"])
  })
  it("el encabezado pesa más que el resto del texto", () => {
    const g = detectGeo("Diseñador UX — Ciudad de México\n" + "Trabajarás con clientes de España y de Argentina. ".repeat(1))
    expect(g.country).toBe("MX")
  })
  it("ciudades ambiguas (Valencia, Santiago, San José) no cuentan si no aparece el país", () => {
    expect(detectGeo("Reunión en Valencia con el equipo.").country).toBeUndefined()
    expect(detectGeo("Oficina en Valencia, España").country).toBe("ES")
  })
  it("«LATAM» sin país da región LATAM; EE. UU. y España no son LATAM", () => {
    expect(regionsFor(detectGeo("Remote position open to candidates across LATAM"))).toEqual(["LATAM"])
    expect(regionsFor(detectGeo("Remote, United States only"))).toEqual(["US"])
  })
  it("nombres de país libres (JSON-LD) a código", () => {
    expect(countryFromName("Colombia")).toBe("CO")
    expect(countryFromName("MX")).toBe("MX")
    expect(countryFromName("Mexico")).toBe("MX")
    expect(countryFromName("Narnia")).toBeUndefined()
  })
})

describe("modalidad, contrato y alcance remoto", () => {
  it("modalidad: híbrido gana; remoto sin «presencial» es remoto; JSON-LD TELECOMMUTE manda", () => {
    expect(detectWorkMode("Modalidad híbrida, 2 días remoto")).toBe("hibrido")
    expect(detectWorkMode("100% remoto desde cualquier lugar")).toBe("remoto")
    expect(detectWorkMode("Trabajo presencial en oficina")).toBe("presencial")
    expect(detectWorkMode("Sin datos", { remote: true })).toBe("remoto")
    expect(detectWorkMode("Texto sin modalidad")).toBeUndefined()
  })
  it("tipo de contrato desde JSON-LD o desde el texto", () => {
    expect(detectEmploymentType("x", { employmentType: "FULL_TIME" })).toBe("Tiempo completo")
    expect(detectEmploymentType("Contrato de medio tiempo")).toBe("Medio tiempo")
    expect(detectEmploymentType("Buscamos practicante")).toBeUndefined()
  })
  it("alcance remoto: copia la frase del texto", () => {
    expect(detectRemoteScope("Posición remota. Solo para residentes en Colombia con experiencia.")).toMatch(/residentes en Colombia/)
    expect(detectRemoteScope("Horario flexible en zona horaria GMT-5 con el equipo")).toMatch(/GMT-5/)
    expect(detectRemoteScope("Remoto sin restricciones")).toBeUndefined()
  })
})

const offer = offerSchema.parse({ title: "Product Designer", company: "Acme", language: "es", seniority: "senior", requirements: ["Figma"], tools: ["Figma"] })
describe("borrador de tarjeta", () => {
  const text = "Product Designer en Acme\nUbicación: Bogotá, Colombia\nModalidad híbrida. Tiempo completo.\nUsarás Figma y Jira en un equipo ágil."
  it("arma la tarjeta con país, regiones, modalidad, contrato y habilidades del texto", () => {
    const d = buildDraft({ offer, text, url: "https://co.linkedin.com/jobs/view/title-3912345678?trk=x", fallbackHash: "h" })
    expect(d).toMatchObject({
      sourceUrl: "https://www.linkedin.com/jobs/view/3912345678/",
      sourceName: "linkedin",
      locationText: "Bogotá, Colombia",
      country: "CO",
      regions: ["CO", "LATAM"],
      workMode: "hibrido",
      employmentType: "Tiempo completo",
      seniority: "senior",
    })
    expect(d.skills).toEqual(expect.arrayContaining(["Figma", "Jira"]))
    expect(d.remoteScope).toBeUndefined() // no es remoto
  })
  it("un puesto híbrido o presencial solo abre su país, aunque la empresa tenga presencia en otros", () => {
    const t = "Product Designer\nUbicación: Bogotá, Colombia\nSomos una fintech con presencia en Colombia, México y Perú. Modalidad híbrida."
    expect(buildDraft({ offer, text: t, fallbackHash: "h" }).regions).toEqual(["CO", "LATAM"])
    const remote = "Product Designer 100% remoto. Abierto a candidatos de Colombia, México y Perú."
    expect(buildDraft({ offer, text: remote, fallbackHash: "h" }).regions).toEqual(expect.arrayContaining(["CO", "MX", "PE", "LATAM"]))
  })
  it("sin enlace usa la huella del texto como clave; con enlace manual lo normaliza", () => {
    expect(buildDraft({ offer, text, fallbackHash: "abc" }).sourceUrl).toBe("texto:abc")
    expect(buildDraft({ offer, text, link: "https://x.com/empleo/1/?utm_source=a", fallbackHash: "abc" }).sourceUrl).toBe("https://x.com/empleo/1")
  })
  it("los datos estructurados (JSON-LD) mandan sobre las heurísticas", () => {
    const d = buildDraft({ offer, text: "Product Designer. Trabajo remoto.", ld: { location: "Lima, Lima, Perú", remote: true, validThrough: "2026-12-31", datePosted: "2026-11-01" }, fallbackHash: "h" })
    expect(d).toMatchObject({ country: "PE", workMode: "remoto", locationText: "Lima, Lima, Perú" })
    expect(d.validThrough).toBe("2026-12-31T00:00:00.000Z")
    expect(d.regions).toContain("LATAM")
  })
  it("el borrador pasa el esquema de guardado", () => {
    expect(jobDraftSchema.safeParse(buildDraft({ offer, text, fallbackHash: "h" })).success).toBe(true)
  })
})

describe("JSON-LD de la oferta", () => {
  it("lee ubicación, teletrabajo, país del candidato, contrato y fechas", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      title: "Dev",
      description: "<p>x</p>",
      hiringOrganization: { name: "Acme" },
      jobLocation: { address: { addressLocality: "Bogotá", addressRegion: "Cundinamarca", addressCountry: "CO" } },
      jobLocationType: "TELECOMMUTE",
      applicantLocationRequirements: [{ "@type": "Country", name: "Colombia" }],
      employmentType: ["FULL_TIME"],
      datePosted: "2026-11-01",
      validThrough: "2026-12-01",
    })}</script>`
    expect(jobPostingFromJsonLd(html)?.ld).toEqual({ location: "Bogotá, Cundinamarca, CO", remote: true, applicantCountries: ["Colombia"], employmentType: "FULL_TIME", datePosted: "2026-11-01", validThrough: "2026-12-01" })
  })
})

describe("acceso de administrador", () => {
  const prev = process.env.ADMIN_TOKEN
  afterEach(() => {
    if (prev === undefined) delete process.env.ADMIN_TOKEN
    else process.env.ADMIN_TOKEN = prev
  })
  const req = (t?: string) => new Request("http://x/api/jobs", { headers: t ? { "x-admin-token": t } : {} })
  it("sin ADMIN_TOKEN configurado responde 503 (nunca deja pasar)", async () => {
    delete process.env.ADMIN_TOKEN
    expect(requireAdmin(req("cualquiera-123456"))?.status).toBe(503)
  })
  it("rechaza clave ausente o incorrecta con 401 y deja pasar la correcta", () => {
    process.env.ADMIN_TOKEN = "clave-de-prueba-123"
    expect(requireAdmin(req())?.status).toBe(401)
    expect(requireAdmin(req("otra-clave-123456"))?.status).toBe(401)
    expect(requireAdmin(req("clave-de-prueba-123"))).toBeNull()
  })
  it("una clave demasiado corta en el entorno no se acepta", () => {
    process.env.ADMIN_TOKEN = "corta"
    expect(requireAdmin(req("corta"))?.status).toBe(503)
  })
})
