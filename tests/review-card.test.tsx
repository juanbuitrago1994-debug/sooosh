import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AiWorkProvider } from "@/components/ai/ai-work"
import { pendingCount, reviewKey, StepReview, type ReviewState } from "@/components/steps/step-review"
import type { RewriteItem } from "@/lib/rewrite/groups"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

const cv = cvSchema.parse({ header: { fullName: "Ana" }, experience: [{ company: "Initech", role: "Analista", startDate: "2020", bullets: ["Armé tableros de ventas."] }] })
const offer = offerSchema.parse({ title: "Analista", language: "es" })
const mk = (id: string, risk: "bajo" | "alto", kind: RewriteItem["kind"] = "cambiar"): RewriteItem => ({
  id, label: `Cambio ${id}`, original: "Armé tableros de ventas.", proposed: "Construí tableros de ventas.", status: "changed", kind, section: "Experiencia", reason: "Reordena y reformula.", evidence: ["Armé tableros de ventas."], risk,
})
const state = (items: RewriteItem[], decisions: ReviewState["decisions"] = {}): ReviewState => ({ inputKey: reviewKey(cv, offer), items, decisions })
const render = (value: ReviewState | null) =>
  renderToStaticMarkup(
    <AiWorkProvider>
      <StepReview cv={cv} guard={null} offer={offer} match={null} value={value} onChange={() => {}} />
    </AiWorkProvider>,
  )

describe("pantalla de revisión (una tarjeta por cambio)", () => {
  it("antes de generar: una sola acción primaria", () => {
    const html = render(null)
    expect(html).toContain("Proponer cambios para esta oferta")
    expect(html).not.toContain("Atajos")
  })
  it("muestra UN cambio a la vez con motivo, evidencia, riesgo y los atajos de teclado visibles (Kbd)", () => {
    const html = render(state([mk("a", "bajo"), mk("b", "alto")]))
    expect(html).toContain("Cambio 1 de 2")
    expect(html.match(/data-slot="glass-panel"/g)).toHaveLength(1)
    expect(html).toContain("Cambio a") // solo la primera tarjeta
    expect(html).not.toContain("Cambio b")
    expect(html).toContain("Motivo: ")
    expect(html).toContain("Evidencia: lo que dice tu CV")
    expect(html).toContain("«Armé tableros de ventas.»")
    expect(html).toContain("Riesgo bajo")
    expect((html.match(/data-slot="kbd"/g) ?? []).length).toBeGreaterThanOrEqual(8) // A, R, E y ← → en botones y pista
    for (const t of ["Aceptar", "Rechazar", "Editar"]) expect(html).toContain(t)
  })
  it("muestra el tipo de cambio y el efecto estimado en el encaje (mismo motor que la ficha)", () => {
    const item: RewriteItem = { ...mk("a", "bajo"), type: "viñeta", impact: { overall: 3, dimensions: [{ id: "logros", delta: 12 }] } }
    const html = render(state([item]))
    expect(html).toContain("Viñeta")
    expect(html).toContain("Efecto estimado en el encaje con la oferta: +3.")
    const reorder: RewriteItem = { ...mk("r", "bajo"), type: "reordenar-habilidades", original: "Excel · SQL", proposed: "SQL · Excel", op: { type: "reorder-skills", group: 0, order: [1, 0] }, impact: { overall: 0, dimensions: [] } }
    const h2 = render(state([reorder]))
    expect(h2).toContain("Mejora la lectura rápida; no cambia la ficha.")
    expect(h2).not.toContain("Editar <") // reordenar no se edita
  })
  it("una brecha se pregunta a la persona: no hay «Aceptar» que la rellene sola", () => {
    const gap: RewriteItem = { ...mk("gap.sql", "bajo", "añadir"), type: "brecha", userProvided: true, original: "", proposed: "", label: "Falta: SQL", question: "¿Tienes experiencia real con SQL? Si es así, escríbelo como lo usaste; si no, déjalo fuera (no lo agregamos por ti).", impact: { overall: 4, dimensions: [], hypothetical: true } }
    const html = render(state([gap]))
    expect(html).toContain("¿Tienes experiencia real con SQL?")
    expect(html).toContain("Sí, lo tengo")
    expect(html).toContain("No lo tengo")
    expect(html).toContain("Si de verdad lo tienes, el encaje con la oferta subiría +4.")
    expect(html).not.toContain("Aprobar los") // las brechas nunca se aprueban en bloque
  })
  it("«Aprobar todos los de bajo riesgo» cuenta solo los pendientes de riesgo bajo", () => {
    const html = render(state([mk("a", "bajo"), mk("b", "alto"), mk("c", "bajo")], { c: { status: "accepted" } }))
    expect(html).toContain("Aprobar los 1 de bajo riesgo")
  })
  it("un cambio de «quitar» no se puede editar y un «añadir» sí", () => {
    expect(render(state([mk("a", "bajo", "quitar")]))).not.toContain("Editar")
    expect(render(state([mk("a", "bajo", "añadir")]))).toContain("Editar")
  })
  it("cuenta pendientes (lo pendiente no se aplica)", () => {
    const s = state([mk("a", "bajo"), mk("b", "alto")], { a: { status: "rejected" } })
    expect(pendingCount(s)).toBe(1)
    expect(pendingCount(null)).toBe(0)
  })
  it("si cambió el CV o la oferta pide generar de nuevo", () => {
    expect(render({ ...state([mk("a", "bajo")]), inputKey: "otro" })).toContain("Tu CV o la oferta cambiaron")
  })
})
