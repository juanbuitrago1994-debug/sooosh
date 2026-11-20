import { describe, expect, it } from "vitest"
import { CHILETRABAJOS, TRABAJANDO, fetchPortal, jobFromPage } from "@/lib/sources/portals/portal"
import { isAllowed, loadRobots, parseRobots } from "@/lib/sources/portals/robots"
import { parseSitemap } from "@/lib/sources/portals/sitemap"
import { externalToDraft } from "@/lib/sources/normalize"

const ROBOTS = `User-agent: *\nDisallow: /empleos.html/111\nDisallow: /*recientes=true\nDisallow: /privado/\nAllow: /privado/publico\nSitemap: https://x.cl/sitemap.xml\n\nUser-agent: Scrapy,proximic\nDisallow: /`

describe("robots.txt", () => {
  const r = parseRobots(ROBOTS)
  it("respeta Disallow con comodines y la regla más específica gana", () => {
    expect(isAllowed(r, "/trabajo/analista-123")).toBe(true)
    expect(isAllowed(r, "/empleos.html/111")).toBe(false)
    expect(isAllowed(r, "/lista?recientes=true")).toBe(false)
    expect(isAllowed(r, "/privado/secreto")).toBe(false)
    expect(isAllowed(r, "/privado/publico")).toBe(true)
    expect(r.sitemaps).toEqual(["https://x.cl/sitemap.xml"])
  })
  it("un grupo propio de SoooshBot manda sobre «*», y un bloqueo total lo cierra", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: SoooshBot\nAllow: /"), "/x")).toBe(true)
    expect(isAllowed(parseRobots("User-agent: SoooshBot\nDisallow: /"), "/x")).toBe(false)
  })
  it("si el sitio no deja ni leer su robots.txt (403…) NO se entra; 404 = sin restricciones", async () => {
    const f = (status: number) => (async () => ({ ok: status < 400, status, text: async () => "" })) as unknown as typeof fetch
    expect((await loadRobots("https://x.cl", f(403))).blocked).toBe(true)
    expect((await loadRobots("https://x.cl", f(500))).blocked).toBe(true)
    expect((await loadRobots("https://x.cl", f(404))).blocked).toBe(false)
    expect((await loadRobots("https://x.cl", (async () => { throw new Error("red") }) as unknown as typeof fetch)).blocked).toBe(true)
  })
})

describe("sitemap", () => {
  it("lee sitemaps normales, con CDATA y índices", () => {
    const a = parseSitemap(`<urlset><url><loc><![CDATA[https://x.cl/trabajo/a-1]]></loc><lastmod>2026-11-19</lastmod></url><url><loc>https://x.cl/trabajo/b-2</loc></url></urlset>`)
    expect(a.index).toBe(false)
    expect(a.entries).toEqual([{ loc: "https://x.cl/trabajo/a-1", lastmod: "2026-11-19" }, { loc: "https://x.cl/trabajo/b-2", lastmod: undefined }])
    expect(parseSitemap(`<sitemapindex><sitemap><loc>https://x.cl/s1.xml</loc></sitemap></sitemapindex>`)).toMatchObject({ index: true, entries: [{ loc: "https://x.cl/s1.xml" }] })
  })
})

const page = (title: string) =>
  `<html><script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title, description: "<p>Requisitos</p><ul><li>SQL</li><li>Python</li></ul>", hiringOrganization: { name: "Acme" }, jobLocation: { address: { addressLocality: "Santiago", addressCountry: "CL" } }, employmentType: "FULL_TIME", datePosted: "2026-11-19", validThrough: "2026-12-31" })}</script></html>`

describe("lector de portales sin API", () => {
  it("de la página (JSON-LD) a una oferta con enlace al original, país y vigencia", () => {
    const j = jobFromPage(CHILETRABAJOS, "https://www.chiletrabajos.cl/trabajo/analista-de-datos-9", page("Analista de Datos"))!
    expect(j).toMatchObject({ sourceKey: "portal:chiletrabajos", title: "Analista de Datos", company: "Acme", countries: ["CL"], employmentType: "Tiempo completo", validThrough: "2026-12-31" })
    const d = externalToDraft(j)!.draft
    expect(d).toMatchObject({ country: "CL", apply: { method: "plataforma", platform: "Chiletrabajos" }, validThrough: "2026-12-31" })
  })
  it("elige solo ofertas nuevas de tecnología por el cargo de la dirección, y respeta el robots.txt", async () => {
    const asked: string[] = []
    const fake = (async (u: string) => {
      asked.push(u)
      const ok = (text: string) => ({ ok: true, status: 200, text: async () => text })
      if (u.endsWith("/robots.txt")) return ok("User-agent: *\nDisallow: /trabajo/prohibido")
      if (u.endsWith("/sitemap.xml")) return ok(`<urlset><url><loc>https://www.chiletrabajos.cl/trabajo/desarrollador-backend-1</loc></url><url><loc>https://www.chiletrabajos.cl/trabajo/bartender-2</loc></url><url><loc>https://www.chiletrabajos.cl/trabajo/desarrollador-viejo-3</loc></url><url><loc>https://www.chiletrabajos.cl/trabajo/prohibido-4</loc></url></urlset>`)
      return ok(page("Desarrollador Backend"))
    }) as unknown as typeof fetch
    const r = await fetchPortal(CHILETRABAJOS, { fetchImpl: fake, pauseMs: 0, onlyTech: true, known: new Set(["https://chiletrabajos.cl/trabajo/desarrollador-viejo-3"]) })
    expect(r.jobs).toHaveLength(1)
    expect(asked.some((u) => u.includes("bartender"))).toBe(false) // no es tecnología
    expect(asked.some((u) => u.includes("desarrollador-viejo"))).toBe(false) // ya la tenemos
    expect(asked.some((u) => u.includes("prohibido"))).toBe(false) // lo prohíbe el robots.txt
    expect(r.complete).toBe(false) // un sitemap enorme nunca se lee completo: no se cierra nada
  })
  it("ante un 403 se DETIENE sin reintentar", async () => {
    let pages = 0
    const fake = (async (u: string) => {
      if (u.endsWith("/robots.txt")) return { ok: true, status: 200, text: async () => "" }
      if (u.includes("sitemap")) return { ok: true, status: 200, text: async () => `<urlset><url><loc>https://www.chiletrabajos.cl/trabajo/desarrollador-a-1</loc></url><url><loc>https://www.chiletrabajos.cl/trabajo/desarrollador-b-2</loc></url></urlset>` }
      pages++
      return { ok: false, status: 403, text: async () => "" }
    }) as unknown as typeof fetch
    const r = await fetchPortal(CHILETRABAJOS, { fetchImpl: fake, pauseMs: 0 })
    expect(pages).toBe(1)
    expect(r.notes?.join(" ")).toMatch(/403.*detuvo/)
  })
  it("un sitio que bloquea hasta su robots.txt (como Computrabajo) no se toca", async () => {
    let calls = 0
    const fake = (async () => { calls++; return { ok: false, status: 403, text: async () => "" } }) as unknown as typeof fetch
    const r = await fetchPortal(TRABAJANDO, { fetchImpl: fake, pauseMs: 0 })
    expect(r.jobs).toEqual([])
    expect(calls).toBe(1)
    expect(r.notes?.[0]).toMatch(/robots/)
  })
})
