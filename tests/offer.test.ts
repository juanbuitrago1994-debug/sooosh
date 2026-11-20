import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { htmlToText } from "@/lib/offer/html"
import { fetchOfferText, isPrivateAddress, looksLikeLoginWall, OfferError, parseOfferUrl } from "@/lib/offer/fetch-url"
import { offerSchema } from "@/lib/schemas/offer"

const fx = (n: string) => readFileSync(path.join(__dirname, "fixtures/offers", n), "utf8")
const publicLookup = async () => ["93.184.216.34"]
const page = (body: string, init: ResponseInit = {}) =>
  (async () => new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init })) as unknown as typeof fetch

describe("htmlToText", () => {
  it("usa el JSON-LD JobPosting y decodifica entidades y listas", () => {
    const t = htmlToText(fx("jsonld.html"))
    expect(t).toContain("Desarrolladora Frontend")
    expect(t).toContain("Acme Digital")
    expect(t).toContain("- 3 años con React y TypeScript")
    expect(t).toContain("Inglés B2")
    expect(t).not.toMatch(/<[a-z]/i)
    expect(t).not.toContain("Cookies")
  })

  it("extrae <main> sin menús, scripts, estilos ni pie de página", () => {
    const t = htmlToText(fx("main.html"))
    expect(t).toContain("Senior Data Engineer")
    expect(t).toContain("- 5+ years of experience with Python and SQL")
    expect(t).toContain("Mentor junior engineers & improve data quality.")
    for (const noise of ["Globex Careers", "window.track", "Privacy", "color:red"]) expect(t).not.toContain(noise)
  })

  it("devuelve cadena vacía si la página no tiene texto", () => {
    expect(htmlToText("<html><body><script>x()</script></body></html>")).toBe("")
  })
})

describe("parseOfferUrl", () => {
  it("rechaza lo que no es http(s)", () => {
    expect(() => parseOfferUrl("no es una url")).toThrow(OfferError)
    expect(() => parseOfferUrl("file:///etc/passwd")).toThrow(/http/)
    expect(parseOfferUrl(" https://ejemplo.com/empleo ").hostname).toBe("ejemplo.com")
  })
})

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.20.0.1", "169.254.1.1", "::1", "fd00::1", "::ffff:127.0.0.1"])("%s es privada", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true)
  })
  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1"])("%s es pública", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false)
  })
})

describe("fetchOfferText", () => {
  it("descarga y extrae el texto de una oferta HTML", async () => {
    const text = await fetchOfferText("https://empleo.ejemplo/1", { fetchImpl: page(fx("main.html")), lookup: publicLookup })
    expect(text).toContain("Hands-on experience with Airflow")
  })

  it("acepta texto plano", async () => {
    const text = await fetchOfferText("https://empleo.ejemplo/2", {
      fetchImpl: page(fx("texto.txt"), { headers: { "content-type": "text/plain" } }),
      lookup: publicLookup,
    })
    expect(text).toContain("Analista de Datos Junior")
  })

  it("bloquea hosts de la red local, también tras una redirección", async () => {
    await expect(fetchOfferText("http://127.0.0.1/admin", { fetchImpl: page("x"), lookup: publicLookup })).rejects.toMatchObject({ code: "blocked_host" })
    const redirect = (async () => new Response(null, { status: 302, headers: { location: "http://192.168.1.1/" } })) as unknown as typeof fetch
    await expect(fetchOfferText("https://empleo.ejemplo/r", { fetchImpl: redirect, lookup: publicLookup })).rejects.toMatchObject({ code: "blocked_host" })
  })

  it("avisa cuando el sitio exige iniciar sesión (403, ruta de login o texto de login)", async () => {
    await expect(fetchOfferText("https://x.ejemplo/j", { fetchImpl: page("no", { status: 403 }), lookup: publicLookup })).rejects.toMatchObject({ code: "login_required" })
    await expect(fetchOfferText("https://x.ejemplo/login", { fetchImpl: page(fx("texto.txt")), lookup: publicLookup })).rejects.toMatchObject({ code: "login_required" })
    await expect(fetchOfferText("https://x.ejemplo/j", { fetchImpl: page(fx("login.html")), lookup: publicLookup })).rejects.toThrow(/Pegar texto/)
  })

  it("informa errores: sin texto, red caída, tipo no admitido, DNS", async () => {
    await expect(fetchOfferText("https://x.ejemplo/e", { fetchImpl: page("<html><body></body></html>"), lookup: publicLookup })).rejects.toMatchObject({ code: "empty" })
    const down = vi.fn().mockRejectedValue(new Error("boom")) as unknown as typeof fetch
    await expect(fetchOfferText("https://x.ejemplo/d", { fetchImpl: down, lookup: publicLookup })).rejects.toMatchObject({ code: "unreachable" })
    await expect(fetchOfferText("https://x.ejemplo/p", { fetchImpl: page("%PDF", { headers: { "content-type": "application/pdf" } }), lookup: publicLookup })).rejects.toMatchObject({ code: "not_html" })
    await expect(fetchOfferText("https://nope.ejemplo/", { fetchImpl: page("x"), lookup: async () => { throw new Error("ENOTFOUND") } })).rejects.toMatchObject({ code: "unreachable" })
  })
})

describe("looksLikeLoginWall", () => {
  it("no confunde una oferta larga que menciona 'sign in' con un muro", () => {
    expect(looksLikeLoginWall("https://a.co/job/1", "x ".repeat(400) + " sign in to apply")).toBe(false)
  })
})

describe("offerSchema", () => {
  it("acepta una oferta mínima y rellena listas vacías", () => {
    const o = offerSchema.parse({ title: "Dev", language: "es" })
    expect(o.requirements).toEqual([])
    expect(o.niceToHave).toEqual([])
    expect(o.responsibilities).toEqual([])
  })
  it("rechaza idioma desconocido o título vacío", () => {
    expect(offerSchema.safeParse({ title: "Dev", language: "fr" }).success).toBe(false)
    expect(offerSchema.safeParse({ title: "", language: "es" }).success).toBe(false)
  })
})
