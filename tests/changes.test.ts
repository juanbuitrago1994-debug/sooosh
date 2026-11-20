import { describe, expect, it } from "vitest"
import { computeFit } from "@/lib/analysis/fit"
import { buildChangeSet, proposeGaps, proposeStructural, tagItems } from "@/lib/changes/propose"
import { BIAS_MIN_REJECTIONS, typeBias, typeOfRef } from "@/lib/changes/bias"
import { renderCvHtml } from "@/lib/pdf/template"
import { applyDecisions, type RewriteItem } from "@/lib/rewrite/groups"
import type { CV } from "@/lib/schemas/cv"
import { mid, NOW, offer, strong, weak } from "./fixtures/fit-cases"

const cv: CV = {
  ...strong,
  skills: [{ category: "Datos", items: ["Excel", "Word", "SQL", "Python", "Power BI"] }],
  experience: [{ ...strong.experience[0], bullets: ["Apoyé al equipo en reuniones", "Mantuve pipelines ETL en Airflow", "Reduje 40% el tiempo de reporte con SQL y Python", "Construí 12 dashboards en Power BI"] }, strong.experience[1]],
}
const fit = computeFit(cv, offer, { now: NOW })
const text = (c: CV) => JSON.stringify(c)

describe("cambios atómicos (K5)", () => {
  const items = proposeStructural(cv, offer, fit)
  const byId = (id: string) => items.find((i) => i.id === id)!

  it("reordena habilidades: lo que pide la oferta primero, sin añadir ni quitar nada", () => {
    const it = byId("reorder.skills.0")
    expect(it.type).toBe("reordenar-habilidades")
    const after = applyDecisions(cv, [it], { [it.id]: { status: "accepted" } })
    expect(after.skills[0].items.slice(0, 3).sort()).toEqual(["Power BI", "Python", "SQL"])
    expect([...after.skills[0].items].sort()).toEqual([...cv.skills[0].items].sort())
    for (const e of it.evidence!) expect(text(cv)).toContain(e)
  })
  it("reordena viñetas: la que mejor demuestra lo que pide la oferta sube; el texto no cambia", () => {
    const it = byId("reorder.bullets.0")
    const after = applyDecisions(cv, [it], { [it.id]: { status: "accepted" } })
    expect(after.experience[0].bullets[0]).not.toBe("Apoyé al equipo en reuniones")
    expect([...after.experience[0].bullets].sort()).toEqual([...cv.experience[0].bullets].sort())
  })
  it("reordenar + quitar + editar en la misma lista no se pisan (los índices son los del original)", () => {
    const reorder = byId("reorder.bullets.0")
    const remove: RewriteItem = { id: "rm.exp.0.0", label: "x", original: cv.experience[0].bullets[0], proposed: "", status: "changed", kind: "quitar" }
    const edit: RewriteItem = { id: "exp.0.3", label: "x", original: cv.experience[0].bullets[3], proposed: "Construí 12 dashboards en Power BI para ventas", status: "changed", kind: "cambiar" }
    const after = applyDecisions(cv, [reorder, remove, edit], { [reorder.id]: { status: "accepted" }, [remove.id]: { status: "accepted" }, [edit.id]: { status: "accepted" } })
    expect(after.experience[0].bullets).toHaveLength(3)
    expect(after.experience[0].bullets).not.toContain("Apoyé al equipo en reuniones")
    expect(after.experience[0].bullets).toContain("Construí 12 dashboards en Power BI para ventas")
  })
  it("secciones: con poca experiencia la educación va antes; el PDF respeta el orden elegido", () => {
    const junior: CV = { ...cv, experience: [{ ...cv.experience[0], startDate: "Mar 2026", endDate: "Actual" }] }
    const it = proposeStructural(junior, offer, computeFit(junior, offer, { now: NOW })).find((i) => i.id === "reorder.sections")!
    expect(it.proposed.indexOf("education")).toBeLessThan(it.proposed.indexOf("experience"))
    const after = applyDecisions(junior, [it], { [it.id]: { status: "accepted" } })
    const html = renderCvHtml(after, "es")
    expect(html.indexOf("Educación")).toBeLessThan(html.indexOf("Experiencia"))
    expect(renderCvHtml(junior, "es").indexOf("Experiencia")).toBeLessThan(renderCvHtml(junior, "es").indexOf("Educación"))
    const senior = items.find((i) => i.id === "reorder.sections")
    if (senior) expect(senior.proposed.indexOf("education")).toBeGreaterThan(senior.proposed.indexOf("experience")) // con 6 años nunca pone la educación primero
  })
  it("titular: se completa solo con habilidades de la propia lista; sin titular usa el último puesto", () => {
    const hl = proposeStructural({ ...cv, header: { ...cv.header, headline: "Analista de Datos" } }, offer, fit).find((i) => i.id === "headline")!
    const added = hl.proposed.split(" | ")[1].split(" · ")
    for (const a of added) expect(cv.skills[0].items).toContain(a)
    const none = proposeStructural({ ...cv, header: { ...cv.header, headline: undefined } }, offer, fit).find((i) => i.id === "headline")!
    expect(none.proposed.startsWith(cv.experience[0].role)).toBe(true)
    expect(applyDecisions(cv, [hl], { headline: { status: "accepted" } }).header.headline).toBe(hl.proposed)
  })
  it("brechas: se preguntan, nunca se rellenan solas", () => {
    const gaps = proposeGaps(computeFit(mid, offer, { now: NOW }))
    expect(gaps.map((g) => g.label)).toEqual(expect.arrayContaining(["Falta: Python", "Falta: Power BI"]))
    for (const g of gaps) expect(g).toMatchObject({ type: "brecha", userProvided: true, proposed: "" })
    expect(g0(gaps).question).toContain("no lo agregamos por ti")
    const untouched = applyDecisions(mid, gaps, Object.fromEntries(gaps.map((g) => [g.id, { status: "accepted" as const }])))
    expect(untouched.skills).toEqual(mid.skills) // aceptar sin escribir nada no inventa nada
    const answered = applyDecisions(mid, [gaps[0]], { [gaps[0].id]: { status: "accepted", edited: "Python (pandas)" } })
    expect(answered.skills.flatMap((s) => s.items)).toContain("Python (pandas)")
  })
  it("el conjunto completo trae tipo, criterio, motivo y efecto recalculado con el mismo motor", () => {
    const { items: set, before } = buildChangeSet(weak, offer, [], { now: NOW })
    expect(before.overall).toBeLessThan(40)
    for (const i of set) {
      expect(i.type).toBeTruthy()
      expect(i.reason).toBeTruthy()
      expect(i.impact).toBeDefined()
    }
    const gap = set.find((i) => i.type === "brecha")!
    expect(gap.impact!.hypothetical).toBe(true)
    expect(gap.impact!.overall).toBeGreaterThan(0)
    expect(buildChangeSet(weak, offer, [], { now: NOW }).items).toEqual(set) // determinista
  })
  it("el efecto de un reordenamiento se ve en la ficha (lo importante se ve primero)", () => {
    // Sin resumen que ya los muestre, el orden de la lista decide si se ven al inicio.
    const noSummary: CV = { ...cv, summary: undefined, experience: cv.experience.map((e) => ({ ...e, bullets: ["Apoyé al equipo en reuniones", "Participé en comités"] })) }
    const { items: set } = buildChangeSet(noSummary, offer, [], { now: NOW })
    const r = set.find((i) => i.id === "reorder.skills.0")!
    expect(r.impact!.dimensions.some((d) => d.id === "habilidades-tecnicas")).toBe(true)
    expect(r.impact!.overall).toBeGreaterThan(0)
  })
  it("tagItems clasifica los cambios existentes", () => {
    const tagged = tagItems([
      { id: "summary", label: "Resumen", original: "a", proposed: "b", status: "changed", kind: "cambiar" },
      { id: "rm.exp.0.1", label: "x", original: "a", proposed: "", status: "changed", kind: "quitar" },
      { id: "add.skill.0", label: "x", original: "", proposed: "SQL", status: "changed", kind: "añadir" },
      { id: "exp.0.0", label: "x", original: "a", proposed: "b", status: "changed", kind: "cambiar" },
    ])
    expect(tagged.map((t) => t.type)).toEqual(["resumen", "quitar-relleno", "habilidad", "viñeta"])
  })
})

describe("propiedad: añadir lo que sí tienes nunca baja el encaje", () => {
  it("responder una brecha (hipotético) no baja el global en ninguno de los CV de referencia", () => {
    for (const c of [mid, strong, cv, weak]) {
      const { items } = buildChangeSet(c, offer, [], { now: NOW })
      for (const g of items.filter((i) => i.type === "brecha")) expect(g.impact!.overall, `${g.label}`).toBeGreaterThanOrEqual(0)
    }
  })
})

describe("memoria de preferencias por tipo", () => {
  it("3 rechazos sin ninguna aceptación bajan la prioridad del tipo (nunca lo ocultan)", () => {
    const h = (ref: string, decision: string) => ({ ref, decision })
    expect(typeBias(Array.from({ length: BIAS_MIN_REJECTIONS }, (_, i) => h(`reorder.skills.${i}`, "rechazado")))).toEqual({ "reordenar-habilidades": "baja" })
    expect(typeBias([h("headline", "rechazado"), h("headline", "rechazado"), h("headline", "rechazado"), h("headline", "aceptado")])).toEqual({})
    expect(typeOfRef("exp.1.2")).toBe("viñeta")
    expect(typeOfRef("k3j9x:reorder.skills.0")).toBe("reordenar-habilidades") // formato real guardado por la interfaz
    expect(typeOfRef("k3j9x:gap.sql")).toBe("brecha")
  })
  it("los tipos de baja prioridad van al final", () => {
    const history = Array.from({ length: 3 }, (_, i) => ({ ref: `reorder.skills.${i}`, decision: "rechazado" }))
    const { items } = buildChangeSet(cv, offer, [], { now: NOW, history })
    const lowIdx = items.findIndex((i) => i.priority === "baja")
    expect(lowIdx).toBeGreaterThanOrEqual(0)
    expect(items.slice(lowIdx).every((i) => i.priority === "baja")).toBe(true)
  })
})

function g0<T>(xs: T[]): T {
  return xs[0]
}
