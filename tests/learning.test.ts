import { beforeEach, describe, expect, it, vi } from "vitest"

type Call = { system: string; user: string }
const calls: Call[] = []
let respond: ((c: Call) => unknown) | null = null
vi.mock("@/lib/ai", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai")>()),
  getProvider: () => ({
    name: "mock",
    generateStructured: (r: Call) => {
      calls.push({ system: r.system, user: r.user })
      return Promise.resolve({ data: respond!(r), meta: {} })
    },
  }),
}))

import { rewriteGroup } from "@/lib/ai/rewrite-cv"
import type { Db } from "@/lib/db"
import { createTestDb } from "@/lib/db/testing"
import { addRule, deleteRule, examplesFor, getStats, listRules, recordDecision, replaceLearnedRules, resetAll, setDecisionReason, updateRule, type DecisionInput } from "@/lib/learning/store"
import { maybeSummarize, sanitizeRules, SUMMARIZE_PROMPT } from "@/lib/learning/summarize"
import { loadPreferences } from "@/lib/learning/preferences"
import { describeChange } from "@/lib/rewrite/describe"
import { proposeExtras } from "@/lib/rewrite/extras"
import { applyDecisions, type RewriteItem } from "@/lib/rewrite/groups"
import { runMatch } from "@/lib/match/engine"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

const cv = cvSchema.parse({
  header: { fullName: "Laura Mendoza" },
  summary: "Analista de datos con 6 años de experiencia.",
  experience: [{ company: "Initech", role: "Analista", startDate: "2021", bullets: ["Reduje en 35% el tiempo de los reportes con SQL.", "Armé tableros en Power BI para la gerencia comercial.", "Apoyo.", "Armé tableros en Power BI para la gerencia comercial."] }],
  skills: [{ items: ["SQL"] }],
})
const offer = offerSchema.parse({ title: "Analista de Datos", language: "es", requirements: ["SQL"], tools: ["Power BI", "SQL", "Docker"], softSkills: [] })

const dec = (n: number, over: Partial<DecisionInput> = {}): DecisionInput => ({ ref: `r${n}`, kind: "cambiar", section: "Experiencia", risk: "bajo", original: `Original ${n}`, proposal: `Propuesta ${n}`, decision: "aceptado", ...over })
let db: Db
beforeEach(async () => {
  calls.length = 0
  respond = null
  db = await createTestDb()
})

describe("memoria de preferencias · decisiones", () => {
  it("guarda tipo, sección, original, propuesta, decisión, texto editado y motivo opcional", async () => {
    await recordDecision(db, dec(1, { decision: "editado", editedText: "Final 1", reason: "Más corto", changeReason: "Reordena", offerTitle: "Analista", language: "es" }))
    const [ex] = await examplesFor(db, "cambiar", "Experiencia")
    expect(ex).toMatchObject({ original: "Original 1", final: "Final 1", decision: "editado" })
    expect((await getStats(db)).edited).toBe(1)
  })
  it("cambiar de opinión actualiza la fila (misma ref), no la duplica", async () => {
    await recordDecision(db, dec(1, { decision: "aceptado" }))
    await recordDecision(db, dec(1, { decision: "rechazado" }))
    const s = await getStats(db)
    expect(s.total).toBe(1)
    expect(s.rejected).toBe(1)
    await setDecisionReason(db, "r1", "No suena como yo")
  })
  it("los ejemplos son solo lo aceptado/editado, priorizando lo editado y la misma sección", async () => {
    await recordDecision(db, dec(1, { decision: "rechazado" }))
    await recordDecision(db, dec(2, { decision: "aceptado", section: "Resumen" }))
    await recordDecision(db, dec(3, { decision: "editado", editedText: "Editado 3", section: "Experiencia" }))
    await recordDecision(db, dec(4, { decision: "aceptado", section: "Experiencia" }))
    const ex = await examplesFor(db, "cambiar", "Experiencia", 3)
    expect(ex.map((e) => e.original)).toEqual(["Original 3", "Original 4", "Original 2"])
    expect(ex.every((e) => e.decision !== ("rechazado" as never))).toBe(true)
  })
})

describe("memoria de preferencias · reglas", () => {
  it("visibles, editables (editar una aprendida la vuelve manual), desactivables y borrables", async () => {
    await replaceLearnedRules(db, ["Prefiere viñetas de una sola línea", "Evita cambiar sus herramientas por sinónimos"])
    let rules = await listRules(db)
    expect(rules.map((r) => r.source)).toEqual(["aprendida", "aprendida"])
    await updateRule(db, rules[0].id, { text: "Prefiere viñetas de máximo dos líneas" })
    await updateRule(db, rules[1].id, { enabled: false })
    rules = await listRules(db)
    expect(rules[0]).toMatchObject({ text: "Prefiere viñetas de máximo dos líneas", source: "manual", enabled: true })
    expect(rules[1].enabled).toBe(false)
    await deleteRule(db, rules[1].id)
    expect(await listRules(db)).toHaveLength(1)
  })
  it("un nuevo resumen reemplaza las aprendidas pero respeta las manuales y no las duplica", async () => {
    await addRule(db, "Siempre en primera persona", "manual")
    await replaceLearnedRules(db, ["Viñetas cortas", "siempre en primera persona"])
    await replaceLearnedRules(db, ["Empieza con verbo de acción"])
    expect((await listRules(db)).map((r) => [r.text, r.source])).toEqual([["Siempre en primera persona", "manual"], ["Empieza con verbo de acción", "aprendida"]])
  })
  it("reiniciar borra decisiones, reglas y contadores", async () => {
    await recordDecision(db, dec(1))
    await addRule(db, "Regla manual de prueba", "manual")
    await resetAll(db)
    expect(await getStats(db)).toMatchObject({ total: 0, sinceSummary: 0 })
    expect(await listRules(db)).toEqual([])
  })
})

describe("resumen periódico de preferencias", () => {
  it("no se ejecuta hasta juntar N decisiones nuevas; entonces el modelo resume reglas", async () => {
    respond = () => ({ rules: ["Prefiere viñetas de una sola línea", "x", "Evita añadir adjetivos de relleno"] })
    for (let i = 0; i < 9; i++) await recordDecision(db, dec(i))
    expect(await maybeSummarize(db, { every: 10 })).toEqual({ ran: false })
    expect(calls).toHaveLength(0)
    await recordDecision(db, dec(9, { decision: "editado", editedText: "Más corto" }))
    const r = await maybeSummarize(db, { every: 10 })
    expect(r.ran).toBe(true)
    expect(calls[0].system).toBe(SUMMARIZE_PROMPT)
    expect(calls[0].user).toMatch(/\[editado\].*editó: «Más corto»/)
    expect((await listRules(db)).map((x) => x.text)).toEqual(["Prefiere viñetas de una sola línea", "Evita añadir adjetivos de relleno"]) // «x» es demasiado corta
    expect((await getStats(db)).sinceSummary).toBe(0) // el contador se reinicia
    expect(await maybeSummarize(db, { every: 10 })).toEqual({ ran: false })
  })
  it("sanea las reglas: sin correos/URLs, sin duplicados, máximo 8", () => {
    const out = sanitizeRules(["- Usa verbos de acción al empezar", "Usa verbos de acción al empezar", "Escribe a ana@example.com siempre", "Ver https://x.com para más", ...Array.from({ length: 12 }, (_, i) => `Regla de estilo número ${i} válida`)])
    expect(out[0]).toBe("Usa verbos de acción al empezar")
    expect(out.join(" ")).not.toMatch(/@|https/)
    expect(out.length).toBeLessThanOrEqual(8)
  })
  it("dice claramente que son preferencias de redacción, sin datos personales", () => {
    expect(SUMMARIZE_PROMPT).toMatch(/PREFERENCIAS DE REDACCIÓN/)
    expect(SUMMARIZE_PROMPT).toMatch(/Sin datos personales/)
  })
})

describe("preferencias dentro del prompt de reescritura", () => {
  it("se inyectan reglas activas y pocos ejemplos, y el CV conserva su estilo", async () => {
    await addRule(db, "Prefiere viñetas de una sola línea", "manual")
    await addRule(db, "Regla desactivada que no debe aparecer", "manual")
    const off = (await listRules(db))[1]
    await updateRule(db, off.id, { enabled: false })
    await recordDecision(db, dec(1, { original: "Hice reportes", proposal: "Elaboré reportes", decision: "editado", editedText: "Elaboré reportes semanales" }))
    const prefs = await loadPreferences(db)
    respond = (c) => ({ items: [...c.user.split("Textos a reformular:\n")[1].split("\n\n")[0].matchAll(/^\d+\. (.*)$/gm)].map((m) => m[1]) })
    await rewriteGroup(cv, offer, "exp.0", undefined, undefined, { preferences: prefs, style: "Primera persona, verbos en pasado, con viñetas." })
    const u = calls[0].user
    expect(u).toMatch(/PREFERENCIAS DE ESTA PERSONA/)
    expect(u).toContain("Prefiere viñetas de una sola línea")
    expect(u).not.toContain("Regla desactivada")
    expect(u).toContain("Antes: Hice reportes")
    expect(u).toContain("Después: Elaboré reportes semanales")
    expect(u).toContain("Estilo del CV que debes conservar: Primera persona")
    expect(calls[0].system).toMatch(/PROHIBIDO añadir/) // las reglas de no inventar siguen mandando
  })
})

describe("cambios con motivo, evidencia y riesgo", () => {
  it("una reformulación que incorpora un término de la oferta que ya está en el CV cita la evidencia y es de riesgo bajo", () => {
    const d = describeChange(cv, offer, "Armé tableros para la gerencia comercial.", "Armé tableros en Power BI para la gerencia comercial.")
    expect(d.risk).toBe("bajo")
    expect(d.reason).toMatch(/«Power BI»/)
    expect(d.evidence).toContain("Armé tableros para la gerencia comercial.")
    expect(d.evidence).toContain("Armé tableros en Power BI para la gerencia comercial.") // el fragmento del CV que respalda el término
  })
  it("sin términos nuevos es solo reordenar; muchos cambios o mucho más largo = más riesgo", () => {
    expect(describeChange(cv, offer, "Reduje costos.", "Costos reducidos.").reason).toMatch(/Reordena/)
    const big = describeChange(cv, offer, "Armé tableros.", "Armé tableros con SQL y Power BI y Docker para toda la compañía y sus áreas.")
    expect(big.risk).not.toBe("bajo")
  })
})

describe("cambios deterministas: quitar y añadir", () => {
  it("quita viñetas demasiado cortas o repetidas, con la evidencia exacta", () => {
    const ex = proposeExtras(cv, null).filter((i) => i.kind === "quitar")
    expect(ex.map((i) => [i.id, i.reason])).toEqual([
      ["rm.exp.0.2", "Es demasiado corta para aportar información útil."],
      ["rm.exp.0.3", "Está repetida: ya la dices en otra viñeta."],
    ])
    expect(ex[0]).toMatchObject({ proposed: "", risk: "medio", evidence: ["Apoyo."] })
  })
  it("añade a habilidades lo que tu experiencia ya demuestra con las mismas palabras de la oferta", async () => {
    const match = await runMatch(cv, offer, { embed: null })
    const add = proposeExtras(cv, match).filter((i) => i.kind === "añadir")
    expect(add.map((i) => i.proposed)).toEqual(["Power BI"]) // SQL ya está en habilidades; Docker no está en el CV
    expect(add[0]).toMatchObject({ risk: "bajo", section: "Habilidades" })
    expect(add[0].evidence?.[0]).toMatch(/Power BI/)
  })
  it("nunca añade lo que el CV no dice (Docker)", async () => {
    const match = await runMatch(cv, offer, { embed: null })
    expect(proposeExtras(cv, match).some((i) => i.proposed === "Docker")).toBe(false)
  })
})

describe("applyDecisions con quitar y añadir", () => {
  const items: RewriteItem[] = [
    { id: "rm.exp.0.2", label: "v3", original: "Apoyo.", proposed: "", status: "changed", kind: "quitar" },
    { id: "rm.exp.0.3", label: "v4", original: "dup", proposed: "", status: "changed", kind: "quitar" },
    { id: "add.skill.0", label: "Habilidades", original: "", proposed: "Power BI", status: "changed", kind: "añadir" },
    { id: "exp.0.0", label: "v1", original: cv.experience[0].bullets[0], proposed: "Nuevo texto.", status: "changed", kind: "cambiar" },
  ]
  it("aplica solo lo aceptado; quita de atrás hacia adelante sin desordenar", () => {
    const out = applyDecisions(cv, items, { "rm.exp.0.2": { status: "accepted" }, "rm.exp.0.3": { status: "accepted" }, "add.skill.0": { status: "accepted" }, "exp.0.0": { status: "rejected" } })
    expect(out.experience[0].bullets).toEqual([cv.experience[0].bullets[0], cv.experience[0].bullets[1]])
    expect(out.skills[0].items).toEqual(["SQL", "Power BI"])
  })
  it("lo pendiente o rechazado no cambia nada, y una habilidad editada se usa tal cual", () => {
    expect(applyDecisions(cv, items, {})).toEqual(cv)
    const out = applyDecisions(cv, items, { "add.skill.0": { status: "accepted", edited: "Microsoft Power BI" } })
    expect(out.skills[0].items).toContain("Microsoft Power BI")
  })
})
