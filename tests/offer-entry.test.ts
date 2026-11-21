import { describe, expect, it, vi } from "vitest"
import { detectApply } from "@/lib/jobs/apply"
import { classifyEntry } from "@/lib/jobs/entry-kind"
import { splitPostHeader } from "@/lib/offer/header"
import { externalLinkIn, isShortLink, resolveShortLink } from "@/lib/offer/short-links"

describe("caja única: enlace o texto", () => {
  it("una sola «palabra» con http es un enlace; lo demás es texto", () => {
    expect(classifyEntry("  https://www.linkedin.com/posts/x-123  ")).toBe("url")
    expect(classifyEntry("https://lnkd.in/p/ekvnyVQn")).toBe("url")
    expect(classifyEntry("Estamos seleccionando diseñadora. Más info: https://lnkd.in/abc")).toBe("text")
    expect(classifyEntry("https://a.co/x y más texto")).toBe("text")
    expect(classifyEntry("")).toBe("text")
  })
})

describe("encabezado pegado de una publicación de LinkedIn", () => {
  const body = "Estamos seleccionando Diseñador/a UX/UI para sumarse al equipo.\n🔹 Dominio de Figma"
  it("una página de empresa (con «seguidores») da la empresa y el encabezado sale del texto", () => {
    const r = splitPostHeader(`Vos Consultora\n34.982 seguidores\n3 sem •\n${body}`)
    expect(r.company).toBe("Vos Consultora")
    expect(r.text).toBe(body)
  })
  it("una persona solo da quién publicó: no se inventa una empresa", () => {
    const r = splitPostHeader(`Marta Quispe\nTalent Acquisition en Initech\n3 sem • Editado\n${body}`)
    expect(r.company).toBeUndefined()
    expect(r.postedBy).toBe("Marta Quispe")
    expect(r.text).toBe(body)
  })
  it("sin encabezado, o con una primera línea que es una frase, no toca nada", () => {
    expect(splitPostHeader(body)).toEqual({ text: body })
    const frase = `Hace 3 semanas empezamos este proceso de selección.\n${body}`
    expect(splitPostHeader(frase).text).toBe(frase)
  })
})

describe("enlaces cortos de LinkedIn", () => {
  const dns = async () => ["34.120.0.1"]
  const html = '<a href="https://www.linkedin.com/help">ayuda</a><a href="https://static.licdn.com/x.css">css</a><a href="https://forms.gle/U13v4492isxwh9aJ9?a=1&amp;b=2">continuar</a>'
  it("reconoce lnkd.in y toma el primer enlace que no es de LinkedIn", () => {
    expect(isShortLink("https://lnkd.in/d92iP43G")).toBe(true)
    expect(isShortLink("https://www.linkedin.com/posts/x")).toBe(false)
    expect(externalLinkIn(html)).toBe("https://forms.gle/U13v4492isxwh9aJ9?a=1&b=2")
  })
  it("el corto del post redirige a la publicación; el del texto muestra una página con el destino", async () => {
    const post = vi.fn(async () => new Response(null, { status: 301, headers: { location: "https://www.linkedin.com/posts/x-123/" } }))
    expect(await resolveShortLink("https://lnkd.in/p/ekvnyVQn", { fetchImpl: post as unknown as typeof fetch, lookup: dns })).toBe("https://www.linkedin.com/posts/x-123/")
    const page = vi.fn(async () => new Response(html, { status: 200 }))
    expect(await resolveShortLink("https://lnkd.in/d92iP43G", { fetchImpl: page as unknown as typeof fetch, lookup: dns })).toBe("https://forms.gle/U13v4492isxwh9aJ9?a=1&b=2")
  })
  it("solo sigue enlaces de LinkedIn y rechaza destinos privados", async () => {
    const never = vi.fn()
    expect(await resolveShortLink("https://example.com/x", { fetchImpl: never as unknown as typeof fetch, lookup: dns })).toBeUndefined()
    expect(never).not.toHaveBeenCalled()
    const page = vi.fn(async () => new Response('<a href="http://intranet.local/x">x</a>', { status: 200 }))
    expect(await resolveShortLink("https://lnkd.in/zz", { fetchImpl: page as unknown as typeof fetch, lookup: async (h) => (h === "lnkd.in" ? ["34.120.0.1"] : ["10.0.0.5"]) })).toBeUndefined()
  })
  it("un enlace corto resuelto a un formulario es otra vía; sin resolver no cuenta; lnkd.in/p es LinkedIn", () => {
    const text = "Envianos tu CV a rh@acme.example. O cargá tus datos en este link: https://lnkd.in/d92iP43G"
    const a = detectApply({ sourceUrl: "texto:x", text, resolved: { "https://lnkd.in/d92iP43G": "https://forms.gle/U13v4492isxwh9aJ9" } })
    expect(a.method).toBe("correo")
    expect(a.alt).toEqual([{ method: "formulario", url: "https://forms.gle/U13v4492isxwh9aJ9" }])
    expect(detectApply({ sourceUrl: "texto:x", text }).alt).toBeUndefined()
    expect(detectApply({ sourceUrl: "https://lnkd.in/p/ekvnyVQn" })).toMatchObject({ method: "plataforma", platform: "LinkedIn" })
  })
})
