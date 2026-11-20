import { describe, expect, it } from "vitest"
import { fetchJobicy, mapHimalayasJob, mapJobicyJob, mapRemotiveJob, openToLatam } from "@/lib/sources/adapters/remote"
import { externalToDraft } from "@/lib/sources/normalize"

describe("fuentes remotas con API gratuita", () => {
  it("solo se conservan las abiertas a Latinoamérica", () => {
    expect(openToLatam("Worldwide")).toBe(true)
    expect(openToLatam("")).toBe(true)
    expect(openToLatam("LATAM, Colombia")).toBe(true)
    expect(openToLatam("Colombia, Argentina")).toBe(true)
    expect(openToLatam("USA, Canada, USA timezones")).toBe(false)
    expect(openToLatam("Europe")).toBe(false)
  })
  it("Remotive: «USA only» se descarta aunque el texto hable de Latinoamérica; «Worldwide» entra como remota de LATAM", () => {
    expect(mapRemotiveJob({ id: 1, url: "https://remotive.com/r/1", title: "Dev", candidate_required_location: "USA", description: "<p>Clients in Latin America</p>" })).toBeNull()
    const j = mapRemotiveJob({ id: 2, url: "https://remotive.com/r/2", title: "Backend Dev", company_name: "Acme", candidate_required_location: "Worldwide", job_type: "full_time", publication_date: "2026-11-14T20:33:53", description: "<p>Hola</p><ul><li>SQL</li></ul>" })!
    expect(j).toMatchObject({ applyUrl: "https://remotive.com/r/2", sourceName: "Remotive", assumeRemoteLatam: true, employmentType: "Tiempo completo" })
    const d = externalToDraft(j)!.draft
    expect(d.regions).toContain("LATAM")
    expect(d.apply?.url ?? j.url).toContain("remotive.com")
  })
  it("Jobicy y Himalayas: el enlace de postulación es el de la fuente; sin restricción = abierta", () => {
    expect(mapJobicyJob({ id: 3, url: "https://jobicy.com/jobs/3-x", jobTitle: "QA", jobGeo: "Mexico", jobType: ["Full-Time"], jobLevel: "Senior", jobDescription: "<p>x</p>" })).toMatchObject({ applyUrl: "https://jobicy.com/jobs/3-x", countries: ["Mexico"], seniority: "senior" })
    expect(mapJobicyJob({ id: 4, url: "u", jobTitle: "QA", jobGeo: "USA" })).toBeNull()
    const h = mapHimalayasJob({ title: "SRE", companyName: "Z", locationRestrictions: [], applicationLink: "https://himalayas.app/companies/z/jobs/sre", guid: "g1", minSalary: 50000, maxSalary: 80000, salaryPeriod: "annual", currency: "USD", pubDate: 1795101568, expiryDate: 1800285567, description: "<p>x</p>" })!
    expect(h).toMatchObject({ applyUrl: "https://himalayas.app/companies/z/jobs/sre", assumeRemoteLatam: true, salary: { min: 50000, max: 80000, currency: "USD", period: "año" } })
    expect(h.validThrough).toMatch(/^2027/)
    expect(mapHimalayasJob({ title: "SRE", locationRestrictions: ["United Kingdom"], applicationLink: "u" })).toBeNull()
  })
  it("Jobicy lee una vez por zona y quita repetidas", async () => {
    const asked: string[] = []
    const f = (async (u: string) => { asked.push(u); return { ok: true, status: 200, json: async () => ({ jobs: [{ id: 1, url: "https://jobicy.com/jobs/1", jobTitle: "Dev", jobGeo: "Anywhere" }] }) } }) as unknown as typeof fetch
    const r = await fetchJobicy({ fetchImpl: f, pauseMs: 0 })
    expect(asked.length).toBe(4)
    expect(r.jobs).toHaveLength(1)
    expect(r.complete).toBe(false)
  })
})
