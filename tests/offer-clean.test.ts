import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

type Call = { system: string; user: string }
const calls: Call[] = []
let decide: ((c: Call) => number[]) | null = null
let failWith: Error | null = null
vi.mock("@/lib/ai", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai")>()),
  getProvider: () => ({
    name: "mock",
    generateStructured: (r: Call) => {
      calls.push({ system: r.system, user: r.user })
      if (failWith) return Promise.reject(failWith)
      return Promise.resolve({ data: { keep: decide!(r) }, meta: {} })
    },
  }),
}))

import { cleanOfferText, CLEAN_SYSTEM_PROMPT, isNoiseLine, prefilterLines } from "@/lib/offer/clean"

const fx = (n: string) => readFileSync(path.join(__dirname, "fixtures/offers", n), "utf8")
const pasted = fx("linkedin-post-hilo.txt")

/** Simula al modelo: numera igual que el prompt y conserva las líneas hasta el inicio de los comentarios. */
const keepUntilComments = (c: Call) => {
  const rows = [...c.user.matchAll(/^(\d+): (.*)$/gm)].map((m) => ({ n: Number(m[1]), t: m[2] }))
  const cut = rows.find((r) => r.t === "Carlos Pérez")?.n ?? Infinity
  return rows.filter((r) => r.n < cut).map((r) => r.n)
}

beforeEach(() => {
  calls.length = 0
  decide = null
  failWith = null
})

describe("prefiltro determinista", () => {
  it("reconoce líneas basura típicas (es/en)", () => {
    for (const l of ["Me gusta", "Responder", "Comentar", "124 reacciones", "38 comentarios", "Ver más comentarios", "Iniciar sesión", "Política de privacidad", "Ofertas similares", "Promocionado", "Like", "Reply"]) {
      expect(isNoiseLine(l), l).toBe(true)
    }
  })
  it("no toca líneas de la oferta", () => {
    for (const l of ["Requisitos:", "- Dominio de SQL y Excel avanzado", "Ofrecemos seguro de salud y bono anual.", "Experiencia con Power BI o Tableau", "Responsabilidades:"]) expect(isNoiseLine(l), l).toBe(false)
  })
  it("quita basura y líneas repetidas consecutivas, conservando el orden", () => {
    expect(prefilterLines("Título\n\nMe gusta\nTítulo\nTítulo\nRequisitos\nResponder\n38 comentarios")).toEqual(["Título", "Requisitos"])
  })
})

describe("capa 2 · limpieza con el modelo local", () => {
  it("el prompt excluye comentarios, reacciones y navegación; la salida es una lista de números de línea", async () => {
    decide = keepUntilComments
    await cleanOfferText(pasted)
    expect(calls[0].system).toBe(CLEAN_SYSTEM_PROMPT)
    expect(calls[0].system).toMatch(/comentarios y respuestas de otras personas/)
    expect(calls[0].user).toMatch(/^0: Marta Quispe/m)
  })

  it("solo pasan las líneas que el modelo elige, tal cual el original (no puede inventar)", async () => {
    decide = keepUntilComments
    const r = await cleanOfferText(pasted)
    expect(r.llm).toBe(true)
    expect(r.text).toContain("Estamos contratando: Analista de Datos Semi Senior en Initech")
    expect(r.text).toContain("- Dominio de SQL y Excel avanzado")
    for (const leak of ["¿Es 100% remoto?", "Carlos Pérez", "10 años de experiencia en Spark", "Hola Lucía", "¿Pagan en dólares?", "Responder", "Me gusta", "124 reacciones"]) expect(r.text, leak).not.toContain(leak)
    // cada línea de la salida existe, idéntica, en el texto de entrada
    const input = new Set(pasted.split("\n").map((l) => l.trim()))
    for (const l of r.text.split("\n")) expect(input.has(l), l).toBe(true)
    expect(r.removed).toBeGreaterThan(8)
  })

  it("ignora números de línea que no existen o fuera del trozo", async () => {
    decide = (c) => [...keepUntilComments(c), 9999, -1 as number].filter((n) => n >= 0)
    const r = await cleanOfferText(pasted)
    expect(r.text).not.toContain("undefined")
  })

  it("si el modelo no está disponible se conserva solo el prefiltro y se avisa", async () => {
    failWith = new Error("Ollama caído")
    const r = await cleanOfferText(pasted)
    expect(r.llm).toBe(false)
    expect(r.warning).toMatch(/solo se quitó el ruido evidente/)
    expect(r.text).toContain("Analista de Datos Semi Senior")
    expect(r.text).not.toContain("124 reacciones") // el prefiltro sí actúa
  })

  it("si el modelo no deja casi nada, no se tira la oferta", async () => {
    decide = () => []
    const r = await cleanOfferText(pasted)
    // lo claramente propio de la oferta (frase de apertura, viñetas, contacto) se conserva aunque el modelo no deje nada
    expect(r.text).toContain("Dominio de SQL y Excel avanzado")
    expect(r.text).toContain("talento@initech.example")
    expect(r.text).not.toContain("Excelente oportunidad")
  })

  it("nunca quita el cargo, los requisitos ni el correo de una publicación corta, aunque el modelo los descarte", async () => {
    const post = `Estamos seleccionando Diseñador/a UX/UI para sumarse al equipo de una empresa en crecimiento.  ¿Qué buscamos?
🔹 Experiencia comprobable en diseño de interfaces (UI) e investigación de experiencia de usuario (UX).
🔹 Dominio de Figma y sistemas de diseño (Design Systems).
🔹 Trabajo en equipo junto a desarrolladores y área de producto.
🔹 Modalidad: Remoto.
📩 ¿Cómo postularte?Envianos tu CV + Portfolio actualizado a candidatos@consultoravos.com (Asunto: UX/UI).  O cargá tus datos directamente en este link: https://lnkd.in/d92iP43G`
    decide = () => [1] // el modelo descarta casi todo (lo que se midió con el modelo real)
    const r = await cleanOfferText(post)
    for (const x of ["Estamos seleccionando", "Dominio de Figma", "Trabajo en equipo", "candidatos@consultoravos.com", "lnkd.in/d92iP43G"]) expect(r.text).toContain(x)
    expect(calls).toHaveLength(0) // todo está protegido: no queda nada dudoso, ni siquiera se llama al modelo
  })

  it("protege solo lo propio de la oferta: los comentarios de otras personas siguen siendo del modelo", async () => {
    const { protectedLines } = await import("@/lib/offer/clean")
    const lines = ["Estamos contratando: Analista de Datos", "Requisitos:", "- SQL", "Envía tu CV a rh@acme.example", "Carlos Pérez", "Analista BI", "Excelente oportunidad, ¿pagan en dólares?"]
    const safe = protectedLines(lines)
    expect([...safe].sort()).toEqual([0, 1, 2, 3])
  })

  it("useLlm:false aplica solo el prefiltro sin llamar al modelo", async () => {
    const r = await cleanOfferText(pasted, { useLlm: false })
    expect(calls).toHaveLength(0)
    expect(r.llm).toBe(false)
  })

  it("textos largos se procesan en trozos con numeración global", async () => {
    const long = Array.from({ length: 400 }, (_, i) => `Línea de la oferta número ${i} con bastante texto para ocupar espacio`).join("\n")
    decide = (c) => [...c.user.matchAll(/^(\d+): /gm)].map((m) => Number(m[1]))
    const r = await cleanOfferText(long)
    expect(calls.length).toBeGreaterThan(1)
    expect(calls[1].user).toMatch(/^\d{2,}: /m) // el segundo trozo no reinicia en 0
    expect(r.text.split("\n").length).toBeGreaterThan(100)
  })
})
