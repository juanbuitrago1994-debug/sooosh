import { PgDialect } from "drizzle-orm/pg-core"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AppHeader } from "@/components/wizard/app-header"
import { jobEmbeddingText } from "@/lib/jobs/embed"
import { clearPrefill, offerToText, PREFILL_KEY, readPrefill, savePrefill } from "@/lib/jobs/prefill"
import { rankByFit } from "@/lib/jobs/rank"
import { ALL_REGIONS, defaultRegion, isRegion } from "@/lib/jobs/region"
import { fuse, regionFilter, type JobCard } from "@/lib/jobs/search"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

const sqlText = (q: ReturnType<typeof regionFilter>) => (q ? new PgDialect().sqlToQuery(q) : null)

describe("región por defecto (sin pedir ubicación)", () => {
  it("la zona horaria manda sobre el idioma", () => {
    expect(defaultRegion("en-US", "America/Bogota")).toBe("CO")
    expect(defaultRegion("es-ES", "America/Mexico_City")).toBe("MX")
    expect(defaultRegion("es", "America/Argentina/Buenos_Aires")).toBe("AR")
    expect(defaultRegion("es", "Europe/Madrid")).toBe("ES")
    expect(defaultRegion("en", "America/New_York")).toBe("US")
  })
  it("sin zona conocida usa la región del idioma; el español sin región es LATAM; lo demás, todas", () => {
    expect(defaultRegion("es-PE", "UTC")).toBe("PE")
    expect(defaultRegion("es", undefined)).toBe("LATAM")
    expect(defaultRegion("fr-FR", "UTC")).toBe(ALL_REGIONS)
    expect(defaultRegion(undefined, undefined)).toBe(ALL_REGIONS)
  })
  it("solo acepta regiones conocidas", () => {
    expect(isRegion("CO") && isRegion("LATAM") && isRegion(ALL_REGIONS)).toBe(true)
    expect(isRegion("XX") || isRegion("co") || isRegion("")).toBe(false)
  })
})

describe("filtro de región (SQL)", () => {
  it("«todas» no filtra; LATAM exige la región LATAM", () => {
    expect(regionFilter(ALL_REGIONS)).toBeUndefined()
    expect(sqlText(regionFilter("LATAM"))?.sql).toContain("@> ARRAY['LATAM']")
  })
  it("un país latinoamericano también ve las remotas abiertas a toda Latinoamérica; EE. UU. y España no", () => {
    const co = sqlText(regionFilter("CO"))!
    expect(co.sql).toContain("'LATAM'")
    expect(co.sql).toContain("remoto")
    expect(co.params).toContain("CO")
    const us = sqlText(regionFilter("US"))!
    expect(us.sql).not.toContain("LATAM")
    expect(us.params).toEqual(["US", "TODAS"]) // «TODAS» = tarjetas cargadas a mano sin región conocida: abiertas a cualquiera
  })
  it("el valor va como parámetro, nunca pegado en el SQL", () => {
    expect(sqlText(regionFilter("CO"))!.sql).not.toContain("CO'")
  })
})

describe("mezcla texto + significado (RRF)", () => {
  const a = { id: "a" }, b = { id: "b" }, c = { id: "c" }
  it("lo que aparece en las dos listas gana sobre lo que aparece en una sola", () => {
    expect(fuse([[a, b, c], [b]]).map((x) => x.id)).toEqual(["b", "a", "c"])
  })
  it("sin duplicados y con listas vacías", () => {
    expect(fuse([[a], [a]])).toHaveLength(1)
    expect(fuse([[], []])).toEqual([])
  })
})

const mkOffer = (title: string, reqs: string[], tools: string[]) => offerSchema.parse({ title, language: "es", requirements: reqs, tools })
const mkJob = (id: string, title: string, offer: ReturnType<typeof mkOffer>, createdAt: string): JobCard => ({
  id, title, origin: "feed", isNew: false, company: "X", locationText: null, country: null, regions: ["LATAM"], workMode: "remoto", remoteScope: null, employmentType: null, seniority: null, language: "es", skills: [], apply: null, salary: null, roleFamily: null, isTech: true, sourceName: "manual", sourceUrl: "https://x/" + id, postedAt: null, createdAt, offer,
})
const cv = cvSchema.parse({
  header: { fullName: "Ana" },
  summary: "Diseñadora de producto.",
  experience: [{ company: "Acme", role: "Product Designer", startDate: "2020", bullets: ["Diseñé un design system en Figma usado por 4 equipos."] }],
  skills: [{ items: ["Figma", "Design systems"] }],
})
const designJob = mkJob("1", "Product Designer", mkOffer("Product Designer", ["Figma", "Design systems"], ["Figma"]), "2026-11-01T00:00:00Z")
const dataJob = mkJob("2", "Data Analyst", mkOffer("Data Analyst", ["SQL", "Power BI"], ["SQL", "Power BI"]), "2026-11-10T00:00:00Z")

describe("encaje con el CV", () => {
  it("ordena por encaje: la oferta que el CV cubre queda arriba", () => {
    const r = rankByFit([dataJob, designJob], cv, "encaje")
    expect(r.map((j) => j.id)).toEqual(["1", "2"])
    expect(r[0].fit!.score).toBeGreaterThan(r[1].fit!.score)
    expect(r[1].fit!.missing).toEqual(expect.arrayContaining(["SQL"]))
  })
  it("una oferta con casi nada que comparar no muestra un porcentaje de relleno", () => {
    const poor = mkJob("3", "Analista", mkOffer("Analista", [], []), "2026-11-05T00:00:00Z")
    expect(rankByFit([poor], cv, "encaje")[0].fit).toBeUndefined()
  })
  it("sin CV no hay encaje y «encaje» respeta el orden de la búsqueda", () => {
    const r = rankByFit([dataJob, designJob], null, "encaje")
    expect(r.map((j) => j.id)).toEqual(["2", "1"])
    expect(r.every((j) => j.fit === undefined)).toBe(true)
  })
  it("«recientes» ordena por fecha y conserva el encaje calculado", () => {
    const r = rankByFit([designJob, dataJob], cv, "recientes")
    expect(r.map((j) => j.id)).toEqual(["2", "1"])
    expect(r[0].fit).toBeDefined()
  })
})

describe("de la tarjeta a la adaptación del CV", () => {
  afterEach(() => vi.unstubAllGlobals())
  const store = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
  }
  it("el texto se reconstruye solo con lo ya extraído", () => {
    const t = offerToText(mkOffer("Product Designer", ["Figma"], ["Figma"]), { location: "Bogotá, Colombia", remoteScope: "Solo Colombia" })
    expect(t).toContain("Product Designer")
    expect(t).toContain("Ubicación: Bogotá, Colombia")
    expect(t).toContain("Requisitos:\n- Figma")
    expect(t).toContain("Herramientas: Figma")
  })
  it("guarda, lee y borra la oferta de la pestaña; ignora basura", () => {
    vi.stubGlobal("sessionStorage", store())
    expect(readPrefill()).toBeNull()
    expect(savePrefill(designJob.offer)).toBe(true)
    expect(readPrefill()?.offer.title).toBe("Product Designer")
    clearPrefill()
    expect(readPrefill()).toBeNull()
    sessionStorage.setItem(PREFILL_KEY, "no es json")
    expect(readPrefill()).toBeNull()
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify({ offer: { title: 1 }, text: "x" }))
    expect(readPrefill()).toBeNull()
  })
})

describe("vector de la oferta", () => {
  it("el texto resume título, empresa, ubicación, habilidades y requisitos sin pasarse de largo", () => {
    const t = jobEmbeddingText({ title: "Product Designer", company: "Acme", locationText: "Bogotá", skills: ["Figma"], offer: mkOffer("Product Designer", Array.from({ length: 50 }, (_, i) => `Requisito ${i} ${"x".repeat(80)}`), []) })
    expect(t).toContain("Product Designer\nAcme\nBogotá")
    expect(t).toContain("Habilidades: Figma")
    expect(t.length).toBeLessThanOrEqual(1800)
  })
})

describe("cabecera", () => {
  it("tiene el acceso «Buscar ofertas» hacia /ofertas", () => {
    const html = renderToStaticMarkup(<AppHeader actions={{ onLearning: () => {}, onReopen: () => {} }} />)
    expect(html).toContain('aria-label="Buscar ofertas"')
    expect(html).toContain('href="/ofertas"')
  })
})
