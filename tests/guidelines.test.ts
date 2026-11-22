import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, TONES } from "@/lib/apply/body-settings"
import { bodyPrompt, calm, isGroundedMiddle } from "@/lib/apply/body-ai"
import { GUIDE_ES, guideBlock, styleIssues } from "@/lib/apply/guidelines"

const input = { title: "Diseñador/a UX/UI", company: "Acme", requirements: ["Figma"], covered: ["Figma"], facts: { headline: "Diseñadora UX/UI", skills: ["Figma", "Investigación"], roles: [{ role: "Diseñadora", company: "Beta" }], languages: [] } }

describe("styleIssues", () => {
  it("un párrafo limpio no tiene problemas", () => {
    expect(styleIssues("Diseño interfaces con Figma y me interesa el cargo. Mi perfil responde a lo que piden.", "es")).toEqual([])
  })
  it("«me permite» en primera persona no es relleno", () => {
    expect(styleIssues("Mi dominio de Figma me permite crear interfaces coherentes.", "es")).toEqual([])
  })
  it("detecta exclamaciones, emojis, aperturas de relleno, frases de relleno y gerundios de posterioridad", () => {
    expect(styleIssues("¡Me encanta el cargo!", "es")).toContain("exclamación")
    expect(styleIssues("Me interesa el cargo 😀", "es")).toContain("emoji")
    expect(styleIssues("Mi nombre es Ana y me interesa el cargo.", "es")).toContain("apertura de relleno")
    expect(styleIssues("Es una excelente oportunidad para mí.", "es")).toContain("frase de relleno")
    expect(styleIssues("Trabajé en Beta, desarrollando interfaces y logrando mejoras.", "es")).toContain("gerundio de posterioridad")
  })
  it("una frase de más de 35 palabras es larga", () => {
    expect(styleIssues(Array(40).fill("palabra").join(" ") + ".", "es")).toContain("frase larga")
  })
  it("en inglés aplica lo que corresponde", () => {
    expect(styleIssues("I am writing to apply! It is an exciting opportunity.", "en").sort()).toEqual(["apertura de relleno", "exclamación", "frase de relleno"])
  })
})

describe("calm", () => {
  it("convierte exclamaciones en puntos", () => {
    expect(calm("¡Hola! Me interesa el cargo!!")).toBe("Hola. Me interesa el cargo.")
  })
})

describe("la guía en el prompt", () => {
  it("va apagada por defecto; si se pide, se agrega antes de la orden del JSON, con un ejemplo del tono elegido", () => {
    expect(bodyPrompt(input, DEFAULT_SETTINGS, [], "experiencia", 0).system).not.toContain("Guía de redacción")
    const withGuide = bodyPrompt(input, DEFAULT_SETTINGS, [], "experiencia", 0, { guide: true })
    expect(withGuide.system).toContain("Guía de redacción")
    expect(withGuide.system).toContain(TONES[0].value === "cercano" ? "Me gusta tomar decisiones de diseño" : "")
    expect(withGuide.system.trim().endsWith('{"text":"..."}.')).toBe(true)
  })
  it("solo en español; sin tono reconocible va la guía sin ejemplo", () => {
    expect(guideBlock(DEFAULT_SETTINGS, "en")).toBe("")
    expect(guideBlock({ ...DEFAULT_SETTINGS, warmth: "entusiasta" }, "es")).toBe(GUIDE_ES)
  })
})

describe("verificador con estilo", () => {
  const text = "Trabajo con Figma y me interesa el cargo porque mi perfil encaja con lo que piden. Quiero aportar al equipo con mi trabajo de diseño."
  it("acepta un texto limpio y rechaza el que incumple la guía (salvo que se pida solo datos)", () => {
    expect(isGroundedMiddle(text, input, "corto")).toBe(true)
    const bad = "¡" + text + "!"
    expect(isGroundedMiddle(bad, input, "corto")).toBe(false)
    expect(isGroundedMiddle(bad, input, "corto", false)).toBe(true)
  })
})
