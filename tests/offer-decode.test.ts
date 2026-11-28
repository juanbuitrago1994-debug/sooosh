import { describe, expect, it } from "vitest"
import { decodePage, declaredCodec } from "@/lib/offer/decode"
import { fetchOfferText } from "@/lib/offer/fetch-url"
import { judgeResponse, probeOfferLink } from "@/lib/tracking/liveness"

const TEXT = "Ingeniero de datos · Diseño y planificación: años de experiencia en Bogotá, ñandú, ¿cómo?"
const latin1 = (s: string) => Uint8Array.from(Buffer.from(s, "latin1"))
const utf8 = (s: string) => Uint8Array.from(Buffer.from(s, "utf8"))

describe("decodePage: lee la página como un navegador", () => {
  it("UTF-8 válido gana aunque la cabecera diga latin-1 (sitios que mienten)", () => {
    expect(decodePage(utf8(TEXT), "text/html; charset=iso-8859-1")).toBe(TEXT)
  })
  it("latin-1 declarado en la cabecera: tildes y ñ salen bien (antes salían «�»)", () => {
    expect(decodePage(latin1(TEXT.replace("·", "-")), "text/html; charset=ISO-8859-1")).toBe(TEXT.replace("·", "-"))
  })
  it("windows-1252 declarado en <meta>, sin cabecera de charset; y comillas y guion largo propios de esa tabla", () => {
    const html = `<html><head><meta charset="windows-1252"></head><body>“Año” – Bogotá</body></html>`
    const bytes = Uint8Array.from(Buffer.concat([Buffer.from(html.replace(/[“”–]/g, "")), Buffer.from([0x93, 0x94, 0x96])]))
    const out = decodePage(bytes, "text/html")
    expect(out).toContain("“") // 0x93 en windows-1252
    expect(out).toContain("–") // 0x96
    const plain = Uint8Array.from(Buffer.from(`<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"><p>Año Bogotá</p>`, "latin1"))
    expect(decodePage(plain, "text/html")).toContain("Año Bogotá")
  })
  it("la cabecera manda sobre el <meta>", () => {
    const bytes = Uint8Array.from(Buffer.from(`<meta charset="windows-1251"><p>Año</p>`, "latin1"))
    expect(decodePage(bytes, "text/html; charset=iso-8859-1")).toContain("Año")
  })
  it("cirílico en windows-1251", () => {
    const bytes = Uint8Array.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]) // «Привет»
    expect(decodePage(bytes, "text/html; charset=windows-1251")).toBe("Привет")
  })
  it("una etiqueta desconocida o peligrosa (utf-7) no se usa: UTF-8 con reemplazos, sin lanzar", () => {
    expect(declaredCodec(latin1("<meta charset=utf-7>"), null)).toBeNull()
    expect(declaredCodec(latin1(""), "text/html; charset=x-no-existe")).toBeNull()
    expect(() => decodePage(latin1("Año"), "text/html; charset=utf-7")).not.toThrow()
  })
  it("sin ninguna etiqueta y bytes que no son UTF-8: no lanza", () => {
    expect(() => decodePage(latin1("Año"), null)).not.toThrow()
    expect(decodePage(new Uint8Array(), null)).toBe("")
  })
  it("UTF-16 con marca de orden de bytes", () => {
    const bytes = Uint8Array.from(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("Año", "utf16le")]))
    expect(decodePage(bytes, null)).toContain("Año")
  })
})

const LONG = "Buscamos analista de datos con experiencia en SQL y Python para nuestro equipo en Bogotá. ".repeat(12)
const page = (body: string) => `<html><head><meta charset="iso-8859-1"><title>Oferta</title></head><body><main><h1>Analista</h1><p>${body}</p></main></body></html>`
const latinResponse = (html: string) => new Response(latin1(html), { status: 200, headers: { "content-type": "text/html; charset=iso-8859-1" } })

describe("las tres rutas que descargan páginas usan decodePage", () => {
  it("fetchOfferText: una oferta en latin-1 conserva tildes y ñ", async () => {
    const text = await fetchOfferText("https://empleo.ejemplo/latin", { fetchImpl: (async () => latinResponse(page(LONG + "Diseño y gestión de año."))) as typeof fetch, lookup: async () => ["93.184.216.34"] })
    expect(text).toContain("Diseño y gestión de año.")
    expect(text).not.toContain("�")
  })
  it("probeOfferLink: la frase «ya no está disponible» en latin-1 se reconoce como oferta cerrada", async () => {
    const closed = page("Esta oferta ya no está disponible.")
    const v = await probeOfferLink("https://empleo.ejemplo/cerrada", { fetchImpl: (async () => latinResponse(closed)) as typeof fetch, lookup: async () => ["93.184.216.34"] })
    expect(v.state).toBe("dead")
  })
  it("judgeResponse sigue recibiendo texto ya decodificado (sin cambios)", () => {
    expect(judgeResponse({ status: 200, finalUrl: "https://a.co/1", originalUrl: "https://a.co/1", html: page(LONG) }).state).toBe("alive")
  })
})
