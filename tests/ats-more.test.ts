import { describe, expect, it } from "vitest"
import { mapRecruiteeOffer } from "@/lib/sources/adapters/recruitee"
import { fetchSmartRecruiters, isRegionalPosting, mapSmartRecruitersJob } from "@/lib/sources/adapters/smartrecruiters"
import { parsePersonio } from "@/lib/sources/adapters/personio"
import { mapWorkableJob } from "@/lib/sources/adapters/workable"
import { parseAtsUrl } from "@/lib/sources/companies"

describe("sistemas de selección adicionales", () => {
  it("Workable: ubicación, remoto y enlaces", () => {
    const j = mapWorkableJob({ title: "Backend Engineer", shortcode: "AB12", url: "https://apply.workable.com/acme/j/AB12/", telecommuting: true, employment_type: "Full-time", locations: [{ country: "Colombia", countryCode: "CO", city: "Bogotá" }], description: "<p>Hola</p><ul><li>SQL</li></ul>" }, "acme", "Acme")!
    expect(j).toMatchObject({ sourceKey: "workable:acme", externalId: "AB12", remote: true, workMode: "remoto", countries: ["CO"], locationText: "Bogotá, Colombia", employmentType: "Tiempo completo" })
    expect(j.description).toContain("SQL")
    expect(mapWorkableJob({ title: "x" }, "a")).toBeNull()
  })
  it("Recruitee: requisitos aparte, modalidad y solo publicadas", () => {
    const base = { id: 1, title: "Dev", careers_url: "https://acme.recruitee.com/o/dev", requirements: "<ul><li>Python</li><li>SQL</li></ul>", description: "<p>Qué harás</p>", country_code: "CL", hybrid: true, employment_type_code: "fulltime_permanent", status: "published", published_at: "2026-11-18 16:23:32 UTC" }
    const j = mapRecruiteeOffer(base, "acme")!
    expect(j).toMatchObject({ workMode: "hibrido", countries: ["CL"], structured: { requirements: ["Python", "SQL"] }, postedAt: "2026-11-18T16:23:32Z" })
    expect(mapRecruiteeOffer({ ...base, status: "closed" }, "acme")).toBeNull()
  })
  it("SmartRecruiters: solo región o remoto; detalle con secciones", async () => {
    expect(isRegionalPosting({ country: "co" })).toBe(true)
    expect(isRegionalPosting({ country: "pl", remote: true })).toBe(true)
    expect(isRegionalPosting({ country: "de" })).toBe(false)
    const d = mapSmartRecruitersJob({ id: "9", name: "QA", postingUrl: "https://jobs.smartrecruiters.com/a/9", location: { country: "mx", fullLocation: "CDMX, México" }, experienceLevel: { label: "Mid-Senior Level" }, jobAd: { sections: { qualifications: { text: "<ul><li>Cypress</li></ul>" }, jobDescription: { text: "<p>Probar</p>" } } } }, "a")!
    expect(d).toMatchObject({ countries: ["MX"], seniority: "senior", structured: { requirements: ["Cypress"] } })
    const asked: string[] = []
    const f = (async (u: string) => {
      asked.push(u)
      const ok = (b: unknown) => ({ ok: true, status: 200, json: async () => b })
      if (u.includes("/postings?")) return ok({ totalFound: 2, content: [{ id: "1", name: "A", location: { country: "co" } }, { id: "2", name: "B", location: { country: "de" } }] })
      return ok({ id: "1", name: "A", postingUrl: "https://jobs.smartrecruiters.com/a/1", location: { country: "co" } })
    }) as unknown as typeof fetch
    const r = await fetchSmartRecruiters("a", "A", { fetchImpl: f, pauseMs: 0 })
    expect(r.jobs).toHaveLength(1)
    expect(asked.some((u) => u.endsWith("/2"))).toBe(false)
    expect(r.complete).toBe(false)
  })
  it("Personio: XML con secciones y entidades", () => {
    const xml = `<workzag-jobs><position><id>7</id><office>Bogotá</office><department>Tech</department><name>Data &amp; BI</name><jobDescriptions><jobDescription><name>Tu perfil</name><value><![CDATA[<ul><li>SQL</li></ul>]]></value></jobDescription></jobDescriptions><schedule>full-time</schedule><createdAt>2026-11-11T17:43:42+00:00</createdAt></position></workzag-jobs>`
    const [j] = parsePersonio(xml, "acme", "Acme")
    expect(j).toMatchObject({ title: "Data & BI", locationText: "Bogotá", employmentType: "Tiempo completo", structured: { requirements: ["SQL"] }, url: "https://acme.jobs.personio.de/job/7" })
  })
  it("reconoce los enlaces de los nuevos sistemas", () => {
    expect(parseAtsUrl("https://apply.workable.com/acme/j/AB12/")).toEqual({ ats: "workable", token: "acme" })
    expect(parseAtsUrl("https://acme.recruitee.com/o/dev")).toEqual({ ats: "recruitee", token: "acme" })
    expect(parseAtsUrl("https://jobs.smartrecruiters.com/Acme/123-dev")).toEqual({ ats: "smartrecruiters", token: "Acme" })
    expect(parseAtsUrl("https://acme.jobs.personio.de/job/7")).toEqual({ ats: "personio", token: "acme" })
  })
})
