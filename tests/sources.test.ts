import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fetchGetOnBoard, mapGetOnBoardJob } from "@/lib/sources/adapters/getonboard"
import { mapAshbyJob } from "@/lib/sources/adapters/ashby"
import { mapGreenhouseJob } from "@/lib/sources/adapters/greenhouse"
import { mapLeverJob } from "@/lib/sources/adapters/lever"
import { parseAtsUrl } from "@/lib/sources/companies"
import { dedupeKey, externalToDraft } from "@/lib/sources/normalize"
import { splitSections, yearsFrom } from "@/lib/sources/sections"
import { htmlListItems, htmlToLines } from "@/lib/sources/text"

const gob = JSON.parse(readFileSync(path.join(__dirname, "fixtures/sources/getonboard.json"), "utf8"))

describe("texto de ofertas", () => {
  it("HTML normal y HTML escapado (Greenhouse) → líneas, con las listas como viñetas", () => {
    expect(htmlToLines("<p>Hola &amp; bienvenido</p><ul><li>Uno</li><li>Dos</li></ul>")).toEqual(["Hola & bienvenido", "• Uno", "• Dos"])
    expect(htmlToLines("&lt;p&gt;Texto&lt;/p&gt;&lt;ul&gt;&lt;li&gt;A&lt;/li&gt;&lt;/ul&gt;")).toEqual(["Texto", "• A"])
    expect(htmlListItems("<p>x</p><ul><li>Solo esto</li></ul>")).toEqual(["Solo esto"])
    expect(htmlToLines(null)).toEqual([])
  })
  it("separa requisitos, tareas y deseables por sus títulos; ignora beneficios", () => {
    const s = splitSections(["Sobre nosotros", "Somos una empresa.", "Requisitos:", "• SQL", "• Python", "Responsabilidades", "• Construir pipelines", "Se valora", "• Airflow", "Beneficios", "• Seguro"])
    expect(s).toEqual({ requirements: ["SQL", "Python"], responsibilities: ["Construir pipelines"], niceToHave: ["Airflow"] })
  })
  it("sin títulos ni viñetas no inventa nada", () => {
    expect(splitSections(["Buscamos a alguien con ganas de aprender."])).toEqual({ requirements: [], responsibilities: [], niceToHave: [] })
  })
  it("años de experiencia solo con cifra explícita", () => {
    expect(yearsFrom(["Entre 4 y 6 años de experiencia"])).toEqual({ min: 4, max: 6 })
    expect(yearsFrom(["Más de 5 años en diseño"])).toEqual({ min: 5 })
    expect(yearsFrom(["3+ years building APIs"])).toEqual({ min: 3 })
    expect(yearsFrom(["Experiencia en diseño"])).toBeUndefined()
  })
})

describe("Get on Board", () => {
  it("mapea una oferta con sus secciones ya separadas", () => {
    const j = mapGetOnBoardJob(gob.data[0])!
    expect(j).toMatchObject({ sourceKey: "getonboard", url: "https://www.getonbrd.com/jobs/ingeniero-datos-acme-santiago-1", title: "Ingeniero de Datos Senior", company: "Acme Datos", countries: ["Chile"], workMode: "hibrido", seniority: "senior", employmentType: "Tiempo completo", language: "es" })
    expect(j.structured).toEqual({ requirements: ["Entre 4 y 6 años de experiencia en ingeniería de datos.", "Dominio de SQL y Python."], responsibilities: ["Construir pipelines de datos en la nube.", "Mantener el almacén de datos."], niceToHave: ["Experiencia con Airflow."], skills: ["Data Engineering"] })
    expect(j.postedAt).toBe(new Date(1794847607 * 1000).toISOString())
  })
  it("no trae salario (la fuente no da la moneda)", () => {
    expect(mapGetOnBoardJob(gob.data[0])!.salary).toBeUndefined()
  })
  it("lee todas las páginas con una pausa y avisa que la lectura fue completa", async () => {
    const pages = [{ data: [gob.data[0]], meta: { total_pages: 2 } }, { data: [gob.data[1]], meta: { total_pages: 2 } }]
    let n = 0
    const fake = (async () => ({ ok: true, status: 200, json: async () => pages[n++] })) as unknown as typeof fetch
    const r = await fetchGetOnBoard({ fetchImpl: fake, pauseMs: 0 })
    expect(r.jobs).toHaveLength(2)
    expect(r.complete).toBe(true)
    expect(n).toBe(2)
  })
  it("si la fuente falla, lanza (nunca devuelve una lectura incompleta como completa)", async () => {
    const fake = (async () => ({ ok: false, status: 503 })) as unknown as typeof fetch
    await expect(fetchGetOnBoard({ fetchImpl: fake, pauseMs: 0 })).rejects.toThrow(/503/)
  })
})

describe("de oferta de fuente a tarjeta", () => {
  it("Chile híbrido: solo su país + LATAM, requisitos tal cual, años de la oferta, enlace «Se aplica en Get on Board»", () => {
    const { draft, dedupe } = externalToDraft(mapGetOnBoardJob(gob.data[0])!)!
    expect(draft).toMatchObject({ country: "CL", regions: ["CL", "LATAM"], workMode: "hibrido", seniority: "senior", language: "es", sourceName: "getonboard" })
    expect(draft.offer.requirements).toHaveLength(2)
    expect(draft.offer.yearsExperience).toEqual({ min: 4, max: 6 })
    expect(draft.apply).toMatchObject({ method: "plataforma", platform: "Get on Board" })
    expect(dedupe).toBe("ingeniero de datos senior|acme datos|cl")
  })
  it("remota de Get on Board: abierta a Latinoamérica (sin país propio)", () => {
    const { draft } = externalToDraft(mapGetOnBoardJob(gob.data[1])!)!
    expect(draft).toMatchObject({ workMode: "remoto", regions: ["LATAM"] })
    expect(draft.country).toBeUndefined()
  })
  it("una oferta de Estados Unidos no entra (el buscador es de Latinoamérica)", () => {
    expect(externalToDraft(mapGetOnBoardJob(gob.data[2])!)).toBeNull()
  })
  it("la clave de duplicados ignora tildes, mayúsculas y signos", () => {
    expect(dedupeKey("Ingeniero de Datos (Sr.)", "Acme S.A.", "CO")).toBe(dedupeKey("INGENIERO DE DATOS  Sr", "acme s a", "CO"))
    expect(dedupeKey("Diseñador UX", undefined, undefined)).toBe("disenador ux||")
  })
})

describe("empresas por tablero (ATS)", () => {
  const body = "&lt;p&gt;Buscamos analista.&lt;/p&gt;&lt;p&gt;Requisitos:&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Excel avanzado&lt;/li&gt;&lt;li&gt;2 años de experiencia&lt;/li&gt;&lt;/ul&gt;"
  it("Greenhouse con varias oficinas: abre las ciudades que lista, no las que menciona el texto", () => {
    const j = mapGreenhouseJob({ id: 1, title: "Analyst", absolute_url: "https://job-boards.greenhouse.io/clara/jobs/1", location: { name: "Bogotá / CUN / Colombia; Buenos Aires / C / Argentina" }, content: body }, "clara", "Clara")!
    const d = externalToDraft(j)!.draft
    expect(d.regions).toEqual(expect.arrayContaining(["CO", "AR", "LATAM"]))
    expect(d.country).toBeUndefined()
    expect(d.apply).toMatchObject({ method: "formulario" })
    expect(d.offer.requirements).toEqual(["Excel avanzado", "2 años de experiencia"])
  })
  it("Greenhouse de otra región se descarta", () => {
    expect(externalToDraft(mapGreenhouseJob({ id: 2, title: "Accountant", absolute_url: "https://job-boards.greenhouse.io/cabify/jobs/2", location: { name: "Madrid" }, content: body }, "cabify", "Cabify")!)).toBeNull()
  })
  it("Lever: usa applyUrl, el país y la modalidad que declara", () => {
    const j = mapLeverJob({ id: "x", text: "Planner", hostedUrl: "https://jobs.lever.co/despegar/x", applyUrl: "https://jobs.lever.co/despegar/x/apply", country: "AR", workplaceType: "hybrid", categories: { location: "Buenos Aires", commitment: "Full Time" }, descriptionPlain: "Somos Despegar.", lists: [{ text: "¿Qué valoramos?", content: "<li>Excel</li>" }, { text: "¿Qué desafíos te esperan?", content: "<li>Liderar proyecciones</li>" }] }, "despegar", "Despegar")!
    const d = externalToDraft(j)!.draft
    expect(d).toMatchObject({ country: "AR", workMode: "hibrido", employmentType: "Tiempo completo", regions: ["AR", "LATAM"] })
    expect(d.offer.niceToHave).toEqual(["Excel"])
    expect(d.offer.responsibilities).toEqual(["Liderar proyecciones"])
    expect(d.apply.url).toBe("https://jobs.lever.co/despegar/x/apply")
  })
  it("Ashby remoto en Colombia: queda para Colombia y LATAM; no para otros países", () => {
    const d = externalToDraft(mapAshbyJob({ id: "a", title: "Backend Engineer", location: "Colombia", isRemote: true, workplaceType: "Remote", employmentType: "FullTime", jobUrl: "https://jobs.ashbyhq.com/addi/a", applyUrl: "https://jobs.ashbyhq.com/addi/a/application", descriptionPlain: "About\n- Build APIs\n- Own services" }, "addi", "Addi")!)!.draft
    expect(d).toMatchObject({ country: "CO", workMode: "remoto", employmentType: "Tiempo completo" })
    expect(d.regions).toEqual(["CO", "LATAM"])
  })
  it("Ashby no listada se ignora", () => {
    expect(mapAshbyJob({ id: "b", title: "x", jobUrl: "https://jobs.ashbyhq.com/addi/b", isListed: false }, "addi")).toBeNull()
  })
})

describe("directorio de empresas desde un enlace", () => {
  it("reconoce el tablero en enlaces de oferta y de API", () => {
    expect(parseAtsUrl("https://boards.greenhouse.io/cabify/jobs/123")).toEqual({ ats: "greenhouse", token: "cabify" })
    expect(parseAtsUrl("https://job-boards.greenhouse.io/clara/jobs/9?gh_src=x")).toEqual({ ats: "greenhouse", token: "clara" })
    expect(parseAtsUrl("https://boards-api.greenhouse.io/v1/boards/cabify/jobs")).toEqual({ ats: "greenhouse", token: "cabify" })
    expect(parseAtsUrl("https://jobs.lever.co/despegar/4c07ba24-9a48")).toEqual({ ats: "lever", token: "despegar" })
    expect(parseAtsUrl("https://api.lever.co/v0/postings/despegar?mode=json")).toEqual({ ats: "lever", token: "despegar" })
    expect(parseAtsUrl("https://jobs.ashbyhq.com/addi/97f0cd1b")).toEqual({ ats: "ashby", token: "addi" })
  })
  it("otros sitios y enlaces rotos no son tableros", () => {
    expect(parseAtsUrl("https://www.linkedin.com/jobs/view/1/")).toBeNull()
    expect(parseAtsUrl("https://boards.greenhouse.io/")).toBeNull()
    expect(parseAtsUrl("no es un enlace")).toBeNull()
  })
})
