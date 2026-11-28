import { describe, expect, it } from "vitest"
import { cvFacts, echoedPhrases, ECHO_WORDS, isGroundedMiddle, templateMiddles, type BodyInput } from "@/lib/apply/body-ai"

const REQS = [
  "Experiencia comprobable diseñando sistemas de diseño para productos digitales a escala",
  "3 años de experiencia en Python y SQL",
  "Capacidad de trabajar con equipos de ingeniería de forma autónoma y colaborativa",
]
const input: BodyInput = {
  title: "Diseñador/a UX/UI",
  company: "Vos Consultora",
  requirements: REQS,
  covered: ["Figma", "Sistemas de diseño", "Python"],
  facts: { headline: "Product Designer", skills: ["Figma", "Python"], roles: [{ role: "Diseñador UX/UI", company: "Acme" }], languages: ["Español"] },
}

describe("trampa de eco: copiar los requisitos de la oferta", () => {
  it(`detecta ${ECHO_WORDS} o más palabras seguidas copiadas, sin importar tildes, mayúsculas ni signos`, () => {
    const copy = "En Acme tengo EXPERIENCIA comprobable, diseñando sistemas de diseño para productos digitales."
    expect(echoedPhrases(copy, REQS).length).toBeGreaterThan(0)
  })
  it("un requisito corto que la persona cumple y dice igual («3 años de experiencia en Python y SQL») NO salta", () => {
    expect(echoedPhrases("Tengo 3 años de experiencia en Python y SQL, y uso Figma a diario.", REQS)).toEqual([])
  })
  it("términos sueltos y vocabulario de la oferta no cuentan", () => {
    expect(echoedPhrases("Trabajé con equipos de ingeniería en sistemas de diseño para productos digitales de Acme.", REQS)).toEqual([])
  })
  it("sin requisitos o con texto corto no hace nada", () => {
    expect(echoedPhrases("Hola", REQS)).toEqual([])
    expect(echoedPhrases("Trabajé en equipos de ingeniería de forma autónoma y colaborativa en Acme.", [])).toEqual([])
  })
})

describe("la trampa rechaza la propuesta de la IA, no la plantilla", () => {
  const own = "Trabajé como Diseñador UX/UI en Acme y uso Figma a diario para armar sistemas de diseño. Creo que mi perfil encaja con lo que buscan en Vos Consultora para este cargo y me gustaría conversar."
  it("un párrafo propio pasa", () => expect(isGroundedMiddle(own, input, "corto")).toBe(true))
  it("el mismo párrafo con un requisito copiado de corrido se rechaza", () => {
    const echo = `${own} Tengo experiencia comprobable diseñando sistemas de diseño para productos digitales a escala.`
    expect(isGroundedMiddle(echo, input, "medio")).toBe(false)
    expect(isGroundedMiddle(echo, input, "medio", false)).toBe(true) // style=false: solo se mide el dato, como antes
  })
  it("las plantillas (sin IA) no copian requisitos de corrido", () => {
    for (const t of templateMiddles(input)) expect(echoedPhrases(t, REQS), t).toEqual([])
  })
  it("cvFacts sigue disponible (sin cambios de contrato)", () => expect(typeof cvFacts).toBe("function"))
})
