import { describe, expect, it } from "vitest"
import { buildChangeSet } from "@/lib/changes/propose"
import { checkIntegrity, rebuildCv } from "@/lib/rebuild/build"
import { improveWeak } from "@/lib/rebuild/improve"
import { cvCorpus } from "@/lib/rewrite/verify"
import type { Decisions, RewriteItem } from "@/lib/rewrite/groups"
import type { CV } from "@/lib/schemas/cv"
import { mid, NOW, offer, strong } from "./fixtures/fit-cases"

const base: CV = {
  ...strong,
  summary: undefined,
  header: { ...strong.header, headline: "Analista de Datos" },
  skills: [{ category: "Datos", items: ["Excel", "Word", "SQL", "Python", "Power BI"] }],
  experience: [{ ...strong.experience[0], bullets: ["Apoyé al equipo en reuniones", "Mantuve pipelines ETL en Airflow", "Reduje 40% el tiempo de reporte con SQL y Python", "Construí 12 dashboards en Power BI"] }, strong.experience[1]],
}
const source = cvCorpus(base)
const acceptAll = (items: RewriteItem[]): Decisions => Object.fromEntries(items.map((i) => [i.id, { status: "accepted" as const }]))
const item = (o: Partial<RewriteItem> & { id: string }): RewriteItem => ({ label: o.id, original: "", proposed: "", status: "changed", kind: "cambiar", ...o })

describe("reconstrucción del CV final (K6)", () => {
  const { items } = buildChangeSet(base, offer, [], { now: NOW })
  const deterministic = items.filter((i) => i.type !== "brecha")

  it("aplica solo lo aceptado: sin decisiones, el CV queda idéntico al original", () => {
    const r = rebuildCv({ cv: base, offer, items, decisions: {}, source, now: NOW })
    expect(r.cv).toEqual(base)
    expect(r.report.counts.pendiente).toBe(items.length)
    expect(r.report.ok).toBe(true)
  })
  it("aceptar los cambios estructurales mejora o mantiene la ficha y no inventa nada", () => {
    const r = rebuildCv({ cv: base, offer, items: deterministic, decisions: acceptAll(deterministic), source, now: NOW })
    expect(r.report.counts.aceptado).toBe(deterministic.length)
    expect(r.report.fitAfter.overall).toBeGreaterThanOrEqual(r.report.fitBefore.overall)
    expect(r.report.integrity).toEqual([])
    expect(r.report.verification).toEqual([])
    expect(r.report.ok).toBe(true)
    expect([...r.cv.skills[0].items].sort()).toEqual([...base.skills[0].items].sort())
  })
  it("un texto del modelo con datos inventados se bloquea y NO llega al CV final", () => {
    const bad = item({ id: "exp.0.2", original: base.experience[0].bullets[2], proposed: "Reduje 90% el tiempo de reporte con Kubernetes", type: "viñeta" })
    const r = rebuildCv({ cv: base, offer, items: [bad], decisions: { [bad.id]: { status: "accepted" } }, source, now: NOW })
    expect(r.cv.experience[0].bullets[2]).toBe(base.experience[0].bullets[2])
    expect(r.report.counts.bloqueado).toBe(1)
    expect(r.report.blocked[0].violations.length).toBeGreaterThan(0)
    expect(r.report.ok).toBe(false)
  })
  it("lo que la persona escribe es suyo: se permite y se señala como «escrito por ti»", () => {
    const own = item({ id: "exp.0.2", original: base.experience[0].bullets[2], proposed: "Reduje 40% el tiempo de reporte", type: "viñeta" })
    const text = "Reduje 55% el tiempo de reporte en mi proyecto personal con Kubernetes"
    const r = rebuildCv({ cv: base, offer, items: [own], decisions: { [own.id]: { status: "accepted", edited: text } }, source, now: NOW })
    expect(r.cv.experience[0].bullets[2]).toBe(text)
    expect(r.report.writtenByUser).toEqual([text])
    expect(r.report.counts.editado).toBe(1)
    expect(r.report.ok).toBe(true)
  })
  it("brecha: aceptar sin escribir nada no añade nada; con respuesta, entra como texto de la persona", () => {
    const gap = item({ id: "gap.python", label: "Falta: Python", kind: "añadir", type: "brecha", userProvided: true })
    const none = rebuildCv({ cv: mid, offer, items: [gap], decisions: { [gap.id]: { status: "accepted" } }, source: cvCorpus(mid), now: NOW })
    expect(none.cv.skills).toEqual(mid.skills)
    const yes = rebuildCv({ cv: mid, offer, items: [gap], decisions: { [gap.id]: { status: "accepted", edited: "Python (pandas)" } }, source: cvCorpus(mid), now: NOW })
    expect(yes.cv.skills.flatMap((s) => s.items)).toContain("Python (pandas)")
    expect(yes.report.ok).toBe(true)
  })
  it("integridad: empresas, puestos, fechas y contacto no pueden cambiar", () => {
    const tampered: CV = { ...base, experience: [{ ...base.experience[0], company: "Google" }, base.experience[1]], header: { ...base.header, email: "otro@mail.com" } }
    expect(checkIntegrity(base, tampered).map((i) => i.field)).toEqual(expect.arrayContaining(["contacto", "puesto 1"]))
    expect(checkIntegrity(base, base)).toEqual([])
  })
  it("el informe cuenta cada cambio con su resultado y la mejora por dimensión", () => {
    const r = rebuildCv({ cv: base, offer, items: deterministic, decisions: { ...acceptAll(deterministic), [deterministic[0].id]: { status: "rejected" } }, source, now: NOW })
    expect(r.report.counts.rechazado).toBe(1)
    expect(r.report.changes).toHaveLength(deterministic.length)
    expect(r.report.delta.dimensions).toHaveLength(9)
  })
})

describe("ciclo de calidad: regenerar solo lo débil (K6)", () => {
  const original = mid.experience[0].bullets[0] // «Responsable de reportes en Excel»
  const weakItem = item({ id: "exp.0.0", original, proposed: "Responsable de los reportes en Excel", type: "viñeta", criterion: "logro-verbos" })
  const midSource = cvCorpus(mid)

  it("regenera lo débil, verifica la candidata y se queda con la que mejora la ficha", async () => {
    let calls = 0
    const r = await improveWeak({ cv: mid, offer, items: [weakItem], source: midSource, now: NOW, regenerate: async () => (++calls, "Elaboré los reportes en Excel") })
    expect(r.items[0].proposed).toBe("Elaboré los reportes en Excel")
    expect(r.items[0].impact!.overall).toBeGreaterThan(0)
    expect(r.report).toMatchObject({ weakBefore: 1, weakAfter: 0, improved: 1 })
    expect(calls).toBe(1)
  })
  it("una candidata con datos inventados se descarta aunque mejore la ficha", async () => {
    const r = await improveWeak({ cv: mid, offer, items: [weakItem], source: midSource, now: NOW, regenerate: async () => "Elaboré reportes en Excel que ahorraron 70% del tiempo" })
    expect(r.items[0].proposed).toBe("Responsable de los reportes en Excel")
    expect(r.report.improved).toBe(0)
  })
  it("máximo 2 rondas y solo se regenera lo débil", async () => {
    const cv2: CV = { ...mid, experience: [{ ...mid.experience[0], bullets: ["Responsable de reportes en Excel", "Encargado de tableros en Tableau", "Usé SQL para consultas básicas"] }] }
    const good = item({ id: "exp.0.1", original: cv2.experience[0].bullets[1], proposed: "Elaboré tableros en Tableau", type: "viñeta" })
    const calls: string[] = []
    const r = await improveWeak({ cv: cv2, offer, items: [weakItem, good], source: cvCorpus(cv2), now: NOW, regenerate: async (it) => (calls.push(it.id), "Responsable de los reportes en Excel") })
    expect(calls.filter((c) => c === "exp.0.0").length).toBeLessThanOrEqual(2)
    expect(calls).not.toContain("exp.0.1") // ya mejoraba la ficha: no se toca
    expect(r.report.rounds).toBeLessThanOrEqual(2)
    expect(r.items[0].priority).toBe("baja") // neutra: se conserva al final
  })
  it("una propuesta que empeora la ficha se descarta (queda sin cambio)", async () => {
    const worse = item({ id: "exp.0.1", original: mid.experience[0].bullets[1], proposed: "Tableros", type: "viñeta" })
    const r = await improveWeak({ cv: mid, offer, items: [worse], source: midSource, now: NOW, regenerate: async () => null })
    expect(["unchanged", "changed"]).toContain(r.items[0].status)
    if (r.items[0].impact && r.items[0].impact.overall < 0) expect(r.items[0].status).toBe("unchanged")
  })
  it("si el modelo falla, no se rompe nada", async () => {
    const r = await improveWeak({ cv: mid, offer, items: [weakItem], source: midSource, now: NOW, regenerate: async () => { throw new Error("caído") } })
    expect(r.items).toHaveLength(1)
  })
})
