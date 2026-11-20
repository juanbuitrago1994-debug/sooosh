import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { extractOffer } from "@/lib/offer/extract"
import { fetchOffer } from "@/lib/offer/fetch-url"

const fx = (n: string) => readFileSync(path.join(__dirname, "fixtures/offers", n), "utf8")
const LI_POST = "https://www.linkedin.com/posts/marta-quispe_hiring-datos-activity-123-abc"
const publicLookup = async () => ["93.184.216.34"]
const page = (body: string) => (async () => new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })) as unknown as typeof fetch

describe("capa 1 · publicación de LinkedIn con hilo de comentarios", () => {
  const r = extractOffer(fx("linkedin-post-hilo.html"), LI_POST)!

  it("usa los selectores de LinkedIn y recupera el texto de la oferta", () => {
    expect(r.method).toBe("site")
    expect(r.site).toBe("linkedin-publicacion")
    for (const t of ["Analista de Datos Semi Senior", "Dominio de SQL y Excel avanzado", "Power BI o Tableau", "tableros de ventas", "bono anual"]) expect(r.text).toContain(t)
  })

  it("los comentarios, respuestas y reacciones NO pasan", () => {
    for (const leak of [
      "¿Es 100% remoto?", "Carlos Pérez", "Lucía Ramos", "10 años de experiencia en Spark", "no se dejen engañar", "Hola Lucía", "¿Pagan en dólares?",
      "Responder", "Ver más comentarios", "124 reacciones", "38 comentarios", "Me gusta", "Iniciar sesión", "Política de privacidad", "Todos los derechos reservados",
    ]) {
      expect(r.text, leak).not.toContain(leak)
    }
  })
})

describe("capa 1 · otros sitios y respaldos", () => {
  it("LinkedIn (oferta de empleo): título, empresa y descripción; sin ofertas similares ni comentarios", () => {
    const r = extractOffer(fx("linkedin-empleo.html"), "https://www.linkedin.com/jobs/view/123456")!
    expect(r.site).toBe("linkedin-empleo")
    expect(r.title).toBe("Ingeniero/a de Datos Senior")
    expect(r.company).toBe("Globex")
    expect(r.text).toContain("5+ años de experiencia con Python y SQL")
    for (const leak of ["Ofertas de empleo similares", "Analista de BI en Hooli", "Alguien sabe el sueldo", "Política de cookies"]) expect(r.text).not.toContain(leak)
  })

  it("Indeed: descripción sin banner de cookies, inicio de sesión ni empleos relacionados", () => {
    const r = extractOffer(fx("indeed.html"), "https://pe.indeed.com/viewjob?jk=abc")!
    expect(r.site).toBe("indeed")
    expect(r.company).toBe("Hooli Perú")
    expect(r.text).toContain("Google Analytics y Google Ads")
    for (const leak of ["Usamos cookies", "Iniciar sesión", "Community Manager en Soylent", "Todos los derechos reservados"]) expect(r.text).not.toContain(leak)
  })

  it("JSON-LD JobPosting tiene prioridad sobre todo lo demás", () => {
    const r = extractOffer(fx("jsonld.html"), "https://www.linkedin.com/jobs/view/1")!
    expect(r.method).toBe("json-ld")
    expect(r.company).toBe("Acme Digital")
  })

  it("sitio desconocido: Readability como respaldo, sin barra lateral ni pie", () => {
    const r = extractOffer(fx("articulo-generico.html"), "https://empleos.soylent.example/vacante/9")!
    expect(r.method).toBe("readability")
    expect(r.text).toContain("Coordinador/a de Logística")
    expect(r.text).toContain("Manejo de Excel y de un sistema ERP")
    for (const leak of ["Publicaciones recientes", "Taller de seguridad", "© Soylent"]) expect(r.text).not.toContain(leak)
  })

  it("si el sitio no coincide con ningún selector cae a Readability/heurística", () => {
    const r = extractOffer(fx("main.html"), "https://www.indeed.com/viewjob?jk=xyz")!
    expect(["readability", "heuristic"]).toContain(r.method)
    expect(r.text).toContain("Senior Data Engineer")
  })

  it("devuelve null si no hay texto", () => {
    expect(extractOffer("<html><body><script>x()</script></body></html>", "https://a.example/")).toBeNull()
  })
})

describe("fetchOffer", () => {
  it("descarga una publicación de LinkedIn y devuelve el contenido propio con el método usado", async () => {
    const r = await fetchOffer(LI_POST, { fetchImpl: page(fx("linkedin-post-hilo.html")), lookup: publicLookup })
    expect(r.method).toBe("site")
    expect(r.text).toContain("Analista de Datos Semi Senior")
    expect(r.text).not.toContain("¿Es 100% remoto?")
  })
  it("si la página exige sesión pide pegar el texto con un mensaje claro", async () => {
    await expect(fetchOffer("https://www.linkedin.com/jobs/view/1", { fetchImpl: page(fx("login.html")), lookup: publicLookup })).rejects.toThrow(/Pegar texto/)
    for (const status of [401, 403]) {
      const denied = (async () => new Response("no", { status })) as unknown as typeof fetch
      await expect(fetchOffer("https://www.linkedin.com/jobs/view/1", { fetchImpl: denied, lookup: publicLookup })).rejects.toMatchObject({ code: "login_required" })
    }
  })
})
