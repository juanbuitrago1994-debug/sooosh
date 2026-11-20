import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { matchKey, matchReady, StepAnalysis, type MatchState } from "@/components/steps/step-analysis"
import { AiWorkProvider } from "@/components/ai/ai-work"
import { runMatch } from "@/lib/match/engine"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

const cv = cvSchema.parse({ header: { fullName: "Ana Zapata" }, skills: [{ items: ["SQL", "comunicación"] }], experience: [{ company: "Initech", role: "Analista", startDate: "2020", bullets: ["Armé tableros de ventas."] }] })
const offer = offerSchema.parse({ title: "Analista", language: "en", requirements: ["SQL"], tools: ["Docker", "SQL"], softSkills: ["Communication"] })

const render = (props: Partial<Parameters<typeof StepAnalysis>[0]>) =>
  renderToStaticMarkup(
    <AiWorkProvider>
      <StepAnalysis cv={cv} offer={offer} value={null} onChange={() => {}} {...props} />
    </AiWorkProvider>,
  )

describe("StepAnalysis", () => {
  it("sin oferta o sin perfil muestra el estado vacío (Empty)", () => {
    expect(render({ offer: null })).toContain("Falta la oferta")
    expect(render({ cv: null })).toContain("Falta tu perfil")
    expect(render({ offer: null })).not.toContain('data-slot="card"')
  })
  it("mientras compara muestra la línea de tiempo y ninguna ficha todavía", () => {
    const html = render({})
    expect(html).toContain("Comparando lo que dice tu CV")
    expect(html).toContain("Etapas del análisis")
    expect(html).toContain("Cruzando requisitos con tu CV")
    expect(html).not.toContain("Ficha del CV")
    expect(html).not.toContain('data-slot="progress"')
  })
  it("con resultado: ficha de 9 dimensiones, brechas (con aviso de que no se inventan) y línea de estado", async () => {
    const result = await runMatch(cv, offer, { embed: null })
    const value: MatchState = { key: matchKey(cv, offer), result }
    const html = render({ value })
    expect(html).toContain("Ficha del CV")
    expect(html).toMatch(/Resumen: \d+ de 100/)
    for (const d of ["Habilidades técnicas", "Herramientas y tecnologías", "Experiencia profesional", "Estructura, formato y lectura por ATS"]) expect(html).toContain(d)
    expect((html.match(/data-slot="progress"/g) ?? []).length).toBeGreaterThan(3)
    expect(html).toContain("No está en tu CV")
    expect(html).toContain("Docker")
    expect(html).toContain("No se agregará ni se inventará")
    expect(html).toContain("Comparación limitada") // sin embeddings: avisa
    expect(html).toContain("Profundizar con IA")
  })
  it("el resultado solo vale para el mismo CV y la misma oferta", async () => {
    const result = await runMatch(cv, offer, { embed: null })
    const value: MatchState = { key: matchKey(cv, offer), result }
    expect(matchReady(value, cv, offer)).toBe(true)
    expect(matchReady(value, cv, { ...offer, title: "Otro" })).toBe(false)
    expect(matchReady(null, cv, offer)).toBe(false)
  })
})
