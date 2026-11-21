import { describe, expect, it } from "vitest"
import { isBareHeading, isSectionHeading } from "@/lib/offer/identity"
import { headingKind, reconcileOffer, segmentOffer } from "@/lib/offer/segment"
import { offerSchema, type Offer } from "@/lib/schemas/offer"

const offer = (over: Partial<Offer>): Offer => offerSchema.parse({ title: "Diseñadora UX/UI", language: "es", requirements: [], niceToHave: [], responsibilities: [], ...over })

const POST = `Estamos seleccionando diseñadora UX/UI para un proyecto remoto.

🔹 Requisitos
- 3 años de experiencia en diseño de producto
- Dominio de Figma

🔹 Funciones
- Diseñar flujos y prototipos
- Investigar usuarios

Se valora: conocimientos de Design Systems

🔹 Ofrecemos
- Seguro de salud
- Bono anual

Envía tu hoja de vida a candidatos@consultoravos.com
#diseño #ux #hiring`

describe("segmentación por reglas", () => {
  it("reconoce el tipo de cada encabezado", () => {
    expect(headingKind("🔹 Requisitos")).toBe("requisitos")
    expect(headingKind("🔹 Experiencia comprobable")).toBe("requisitos")
    expect(headingKind("Funciones:")).toBe("funciones")
    expect(headingKind("Se valora")).toBe("deseables")
    expect(headingKind("🔹 Ofrecemos")).toBe("beneficios")
    expect(headingKind("Diseñadora UX/UI")).toBeUndefined()
  })
  it("separa gancho, secciones, contacto y hashtags", () => {
    const b = segmentOffer(POST)
    expect(b.map((x) => x.kind)).toEqual(["gancho", "requisitos", "funciones", "deseables", "beneficios", "contacto", "hashtags"])
    expect(b[0].lines[0]).toContain("Estamos seleccionando")
    expect(b[3].lines).toEqual(["conocimientos de Design Systems"]) // «Se valora: …» en la misma línea
    expect(b[5].lines[0]).toContain("candidatos@consultoravos.com")
  })
  it("tras el contacto, lo que sigue no abre una sección", () => {
    const b = segmentOffer("Requisitos:\n- SQL\nEscríbenos a rrhh@acme.com\nGracias por leer")
    expect(b.map((x) => x.kind)).toEqual(["requisitos", "contacto", "otro"])
  })
})

describe("encabezados frente a requisitos que empiezan igual", () => {
  it("«Experiencia» solo es encabezado si es toda la línea; «Experiencia con Power BI» es un requisito", () => {
    expect(isSectionHeading("🔹 Experiencia")).toBe(true)
    expect(isSectionHeading("Experiencia con Power BI o Tableau")).toBe(false)
    expect(isSectionHeading("Perfil")).toBe(true)
    expect(isSectionHeading("Perfil técnico con inglés avanzado")).toBe(false)
    expect(isSectionHeading("Requisitos mínimos")).toBe(true)
    expect(headingKind("Experiencia con Power BI o Tableau")).toBeUndefined()
  })
  it("los encabezados en inglés son encabezados y no entran a las listas", () => {
    const text = "We're hiring a Backend Engineer.\nWhat you'll do\n- Design APIs\nWhat you bring\n- 5+ years of Python\nNice to have\n- Kubernetes"
    expect(segmentOffer(text).map((b) => b.kind)).toEqual(["gancho", "funciones", "requisitos", "deseables"])
    const model = offer({ requirements: ["5+ years of Python"], responsibilities: ["What you'll do", "Design APIs", "What you bring"], niceToHave: ["Nice to have", "Kubernetes"] })
    const r = reconcileOffer(model, text)
    expect(r.offer.responsibilities).toEqual(["Design APIs"])
    expect(r.offer.niceToHave).toEqual(["Kubernetes"])
    expect(r.removed).toBe(3)
  })
  it("una línea con dato tras los dos puntos no es un encabezado pelado", () => {
    expect(isBareHeading("Se valora:")).toBe(true)
    expect(isBareHeading("Se valora: Python")).toBe(false)
  })
})

describe("conciliar las listas del modelo con los bloques", () => {
  it("mueve cada línea a su lista, quita contacto y beneficios, y agrega lo que el modelo omitió", () => {
    const model = offer({
      requirements: ["3 años de experiencia en diseño de producto", "Diseñar flujos y prototipos", "Seguro de salud", "Envía tu hoja de vida a candidatos@consultoravos.com"],
      niceToHave: ["Dominio de Figma"],
      responsibilities: [],
    })
    const r = reconcileOffer(model, POST)
    expect(r.offer.requirements).toEqual(["3 años de experiencia en diseño de producto", "Dominio de Figma"])
    expect(r.offer.responsibilities).toEqual(["Diseñar flujos y prototipos", "Investigar usuarios"])
    expect(r.offer.niceToHave).toEqual(["conocimientos de Design Systems"])
    expect(r).toMatchObject({ moved: 2, removed: 2, added: 2 })
  })
  it("sin encabezados no toca nada", () => {
    const model = offer({ requirements: ["Dominio de SQL"], responsibilities: ["Armar tableros"] })
    const r = reconcileOffer(model, "Buscamos analista.\nDominio de SQL\nArmar tableros")
    expect(r.offer).toEqual(model)
    expect(r).toMatchObject({ moved: 0, removed: 0, added: 0 })
  })
  it("no repite líneas ni agrega frases de contacto o demasiado largas", () => {
    const model = offer({ requirements: ["Dominio de SQL", "Dominio de SQL"] })
    const long = "x".repeat(300)
    const r = reconcileOffer(model, `Requisitos:\n- Dominio de SQL\n- ${long}\n- Escríbenos a a@b.co`)
    expect(r.offer.requirements).toEqual(["Dominio de SQL"])
  })
})

describe("limpieza: línea suelta descartada entre líneas conservadas", () => {
  it("recupera un hueco de una sola línea y respeta los de dos o más", async () => {
    const { fillSingleGaps } = await import("@/lib/offer/clean")
    expect([...fillSingleGaps(new Set([0, 1, 3, 4]), 6)].sort()).toEqual([0, 1, 2, 3, 4])
    expect([...fillSingleGaps(new Set([0, 3, 4]), 6)].sort()).toEqual([0, 3, 4]) // hueco de dos líneas: se respeta
    expect([...fillSingleGaps(new Set([0, 1]), 6)].sort()).toEqual([0, 1]) // comentarios al final: no se tocan
  })
})

describe("publicación sin encabezados: «¿Qué buscamos?» abre los requisitos", () => {
  const post = `Estamos seleccionando Diseñador/a UX/UI para sumarse al equipo de una empresa en crecimiento.  ¿Qué buscamos?
🔹 Experiencia comprobable en diseño de interfaces (UI).
🔹 Dominio de Figma y sistemas de diseño.
🔹 Trabajo en equipo junto a desarrolladores.
🔹 Modalidad: Remoto.
📩 ¿Cómo postularte? Envianos tu CV a candidatos@consultoravos.com`
  it("las viñetas que siguen son requisitos y el contacto cierra la lista", () => {
    const b = segmentOffer(post)
    expect(b.map((x) => x.kind)).toEqual(["gancho", "requisitos", "contacto"])
    expect(b[1].lines).toHaveLength(4)
  })
  it("agrega el requisito que el modelo omitió y deja «Modalidad: Remoto» fuera de las listas (tiene su campo)", () => {
    const model = offer({ requirements: ["🔹 Experiencia comprobable en diseño de interfaces (UI).", "🔹 Dominio de Figma y sistemas de diseño."], responsibilities: ["🔹 Modalidad: Remoto."] })
    const r = reconcileOffer(model, post)
    expect(r.offer.requirements.map((x) => x.replace(/^🔹 /, ""))).toEqual(["Experiencia comprobable en diseño de interfaces (UI).", "Dominio de Figma y sistemas de diseño.", "Trabajo en equipo junto a desarrolladores."])
    expect(r.offer.responsibilities).toEqual([])
  })
})
