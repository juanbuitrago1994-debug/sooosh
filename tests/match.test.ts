import { describe, expect, it, vi } from "vitest"
import { cosine } from "@/lib/ai/embeddings"
import { lexicalCoverage, runMatch, THRESHOLDS, type EmbedFn, type JudgeFn } from "@/lib/match/engine"
import { buildTerms, injectionTerms } from "@/lib/match/terms"
import { buildUnits } from "@/lib/match/units"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema, type Offer } from "@/lib/schemas/offer"

const cv = cvSchema.parse({
  header: { fullName: "Laura Mendoza", headline: "Analista de Datos" },
  summary: "Analista de datos con 6 años de experiencia en reportería comercial. Me enfoco en convertir datos de ventas en decisiones.",
  experience: [
    {
      company: "Initech",
      role: "Analista de Datos Senior",
      startDate: "2021",
      bullets: [
        "Reduje en 35% el tiempo de preparación de reportes semanales automatizando consultas en SQL y Python.",
        "Diseñé 12 tableros en Power BI usados por la gerencia comercial.",
        "Coordiné a un equipo de 3 analistas en la migración de informes desde Excel.",
        "Capacité a 10 usuarios del área comercial en el uso de tableros.",
      ],
    },
  ],
  education: [{ institution: "Universidad Nacional", degree: "Ingeniería Estadística" }],
  skills: [{ category: "Herramientas", items: ["Power BI", "Excel avanzado", "comunicación", "liderazgo", "JavaScript"] }],
  languages: [{ name: "Inglés", level: "B2" }],
})
const offer = (o: Partial<Offer>): Offer => offerSchema.parse({ title: "Analista", language: "en", ...o })

/** Embeddings de juguete por temas (es/en): lo bastante para probar la lógica sin un modelo real. */
const TOPICS = [/dashboard|tablero|power bi|tableau|visualiz/i, /kubernetes|docker|devops|contenedor/i, /lead|equipo|team|coordin|capacit|train|usuario/i, /sql|excel|report|informe|dato|data/i]
const toyEmbed: EmbedFn = async (texts) => texts.map((t) => [...TOPICS.map((re) => (re.test(t) ? 1 : 0)), 0.05])
const judgeAlways = (r: "mismo" | "relacionado" | "ninguno" | null): JudgeFn => vi.fn(async () => r)

describe("términos de la oferta (salen del esquema estructurado)", () => {
  it("cada elemento es un término tal cual; sin palabras sueltas de oraciones (regresión: «shows», «fine», «around»)", () => {
    const o = offer({
      requirements: ["Strong communication skills", "Experience working around large datasets"],
      responsibilities: ["Shows initiative", "Works fine under pressure"],
      tools: ["SQL"],
    })
    const texts = buildTerms(o).map((t) => t.text)
    expect(texts).toEqual(["Strong communication skills", "Experience working around large datasets", "SQL", "Shows initiative", "Works fine under pressure"])
    for (const junk of ["shows", "fine", "around", "working", "strong"]) expect(texts.map((t) => t.toLowerCase())).not.toContain(junk)
  })
  it("pesos: obligatorio 3 > herramienta/idioma/deseable 2 > blanda 1,5 > función 1; sin duplicados", () => {
    const t = buildTerms(offer({ requirements: ["SQL", "Inglés"], tools: ["sql"], niceToHave: ["Python"], softSkills: ["Liderazgo"], responsibilities: ["Armar reportes"], languagesRequired: [{ language: "Inglés", level: "B2" }] }))
    const w = Object.fromEntries(t.map((x) => [x.text, x.weight]))
    expect(w["SQL"]).toBe(3) // requisito y herramienta a la vez: vale el mayor
    expect(w["Python"]).toBe(2)
    expect(w["Liderazgo"]).toBe(1.5)
    expect(w["Armar reportes"]).toBe(1)
    expect(t.filter((x) => /^sql$/i.test(x.text))).toHaveLength(1)
  })
  it("términos de inyección (guardia de la reescritura): herramientas, blandas y requisitos cortos, partidos por «y»/«o»", () => {
    const keys = injectionTerms(offer({ tools: ["Docker"], softSkills: ["Liderazgo"], requirements: ["Excel y SQL", "Experiencia liderando equipos multiculturales distribuidos en varios países"] })).map((t) => t.term)
    expect(keys).toEqual(expect.arrayContaining(["Docker", "Liderazgo", "Excel", "SQL"]))
    expect(keys.join(" ")).not.toMatch(/multiculturales/)
  })
})

describe("evidencia del CV", () => {
  it("cada fragmento sabe de qué sección viene", () => {
    const u = buildUnits(cv)
    expect(u.find((x) => x.text.startsWith("Diseñé 12 tableros"))?.section).toBe("Experiencia")
    expect(u.find((x) => x.text === "Power BI")?.section).toBe("Habilidades")
    expect(u.find((x) => x.text.includes("Inglés B2"))?.section).toBe("Idiomas")
  })
})

describe("matching léxico", () => {
  it("cubierto, otro nombre (sinónimo/idioma) y compuesto por unión de claves", async () => {
    const r = await runMatch(cv, offer({ tools: ["Power BI", "JS", "Excel"], softSkills: ["Communication", "Leadership"], requirements: ["Strong SQL and advanced Excel"] }))
    const by = Object.fromEntries(r.terms.map((m) => [m.term.text, m]))
    expect(by["Power BI"]).toMatchObject({ status: "cubierto", how: "lexico" })
    expect(by["JS"]).toMatchObject({ status: "otro-nombre" }) // JavaScript
    expect(by["Communication"]).toMatchObject({ status: "otro-nombre" }) // comunicación
    expect(by["Leadership"]).toMatchObject({ status: "otro-nombre" }) // liderazgo
    expect(by["Strong SQL and advanced Excel"]).toMatchObject({ status: "cubierto" })
    expect(r.method).toBe("lexico")
  })
  it("sin embeddings avisa y deja lo no encontrado como brecha", async () => {
    const r = await runMatch(cv, offer({ tools: ["Kubernetes"] }), { embed: null })
    expect(r.terms[0]).toMatchObject({ status: "ausente", evidence: [] })
    expect(r.warnings.join(" ")).toMatch(/olo se comparó por palabras/)
  })
  it("si los embeddings fallan no se rompe: resultado léxico + aviso", async () => {
    const r = await runMatch(cv, offer({ tools: ["Kubernetes"] }), { embed: async () => { throw new Error("Ollama caído") } })
    expect(r.method).toBe("lexico")
    expect(r.warnings.join(" ")).toMatch(/Ollama caído/)
  })
})

describe("matching semántico + juicio del modelo", () => {
  it("«mismo» → cubierto con otro nombre; «relacionado» → reformulable; «ninguno» → brecha", async () => {
    const judge = vi.fn<JudgeFn>(async (t) => (/dashboards/i.test(t.text) ? "mismo" : /train/i.test(t.text) ? "relacionado" : "ninguno"))
    const r = await runMatch(cv, offer({ responsibilities: ["Build sales dashboards", "Train business users", "Review team workflows"] }), { embed: toyEmbed, judge, embedModel: "toy" })
    const by = Object.fromEntries(r.terms.map((m) => [m.term.text, m]))
    expect(by["Build sales dashboards"].status).toBe("otro-nombre")
    expect(by["Train business users"].status).toBe("reformulable")
    expect(r.method).toBe("semantico")
    expect(r.model).toBe("toy")
    expect(r.groups.fit.map((m) => m.term.text)).toContain("Build sales dashboards")
  })
  it("sin candidatos (nada parecido en el CV) es brecha SIN evidencia y sin llamar al modelo", async () => {
    const judge = judgeAlways("mismo")
    const r = await runMatch(cv, offer({ tools: ["Kubernetes"] }), { embed: toyEmbed, judge })
    expect(r.terms[0]).toMatchObject({ status: "ausente", how: "ninguno", evidence: [] })
    expect(r.terms[0].explanation).toMatch(/No se agregará/)
    expect(judge).not.toHaveBeenCalled()
  })
  it("una herramienta o idioma NUNCA se promueve por parecido semántico: es brecha («no es lo mismo»), aunque el vector sea casi igual", async () => {
    const judge = judgeAlways("mismo")
    // «Tableau» y «Power BI» comparten tema en el embedding de juguete (similitud ≈ 1): aun así no cuenta como cubierto
    const r = await runMatch(cv, offer({ tools: ["Tableau"], languagesRequired: [{ language: "Alemán" }] }), { embed: toyEmbed, judge })
    const tableau = r.terms.find((m) => m.term.text === "Tableau")!
    expect(tableau.status).toBe("ausente")
    expect(tableau.explanation).toMatch(/lo más cercano[\s\S]*no es lo mismo[\s\S]*No se agregará/)
    expect(r.groups.reformulable).toEqual([])
    expect(judge).not.toHaveBeenCalled() // ni siquiera se le consulta al modelo
  })
  it("si el juez falla: solo se acepta lo muy parecido (≥ 0,72); lo demás es brecha", async () => {
    const byText = (sim: number): EmbedFn => async (texts) => texts.map((t) => (/Build sales dashboards/.test(t) ? [1, 0] : /tableros/i.test(t) ? [sim, Math.sqrt(1 - sim * sim)] : [0, 1]))
    const o = offer({ responsibilities: ["Build sales dashboards"] })
    expect((await runMatch(cv, o, { embed: byText(0.78), judge: judgeAlways(null) })).terms[0].status).toBe("otro-nombre")
    expect((await runMatch(cv, o, { embed: byText(0.6), judge: judgeAlways(null) })).terms[0].status).toBe("ausente")
  })
  it("muy parecido (≥ 0,85) se acepta sin consultar al modelo", async () => {
    const judge = judgeAlways("ninguno")
    const same: EmbedFn = async (texts) => texts.map((t) => (/dashboards|tableros/i.test(t) ? [1, 0] : [0, 1]))
    const r = await runMatch(cv, offer({ responsibilities: ["Build sales dashboards"] }), { embed: same, judge })
    expect(r.terms[0].status).toBe("otro-nombre")
    expect(judge).not.toHaveBeenCalled()
    expect(THRESHOLDS.sameAuto).toBeGreaterThan(THRESHOLDS.short)
  })
  it("consulta al modelo como máximo THRESHOLDS.maxJudged veces", async () => {
    const many = Array.from({ length: 30 }, (_, i) => `Build dashboards number ${i}`)
    const judge = judgeAlways("ninguno")
    await runMatch(cv, offer({ responsibilities: many }), { embed: async (t) => t.map((x) => (/dashboards|tableros|power bi/i.test(x) ? [1, 0.2] : [0.1, 1])), judge })
    expect((judge as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(THRESHOLDS.maxJudged)
  })
  it("TODA la evidencia es un fragmento real del CV", async () => {
    const r = await runMatch(cv, offer({ tools: ["Power BI", "Docker"], responsibilities: ["Build sales dashboards", "Train business users"], softSkills: ["Leadership"] }), { embed: toyEmbed, judge: judgeAlways("relacionado") })
    const real = new Set(buildUnits(cv).map((u) => u.text))
    for (const m of r.terms) for (const e of m.evidence) expect(real.has(e.text), e.text).toBe(true)
  })
})

describe("cobertura ponderada", () => {
  it("cubierto y otro nombre valen 1, reformulable 0,5, brecha 0; lo obligatorio pesa más", async () => {
    // requisito (3) cubierto + deseable (2) brecha + función (1) reformulable → (3 + 0 + 0,5) / 6 = 58 %
    const r = await runMatch(cv, offer({ requirements: ["SQL"], niceToHave: ["Kubernetes"], responsibilities: ["Train business users"] }), { embed: toyEmbed, judge: judgeAlways("relacionado") })
    expect(r.coverage).toBe(58)
    expect(r.groups.fit.map((m) => m.term.text)).toEqual(["SQL"])
  })
  it("sin términos no hay porcentaje que inventar", async () => {
    expect((await runMatch(cv, offer({}))).coverage).toBe(0)
  })
  it("cobertura léxica síncrona (para el historial) coincide con el motor sin embeddings", async () => {
    const o = offer({ requirements: ["SQL", "Kubernetes"], tools: ["Power BI"] })
    expect(lexicalCoverage(cv, o)).toBe((await runMatch(cv, o, { embed: null })).coverage)
  })
  it("es determinista", async () => {
    const o = offer({ requirements: ["SQL"], responsibilities: ["Train business users"] })
    const a = await runMatch(cv, o, { embed: toyEmbed, judge: judgeAlways("relacionado") })
    const b = await runMatch(cv, o, { embed: toyEmbed, judge: judgeAlways("relacionado") })
    expect(JSON.stringify({ ...a, timings: 0 })).toBe(JSON.stringify({ ...b, timings: 0 }))
  })
})

describe("similitud del coseno", () => {
  it("1 para vectores iguales, 0 para ortogonales", () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1)
    expect(cosine([1, 0], [0, 1])).toBe(0)
    expect(cosine([0, 0], [1, 1])).toBe(0)
  })
})
