import { describe, expect, it } from "vitest"
import { applyDecisions, groupItems, rewriteGroups, type RewriteItem } from "@/lib/rewrite/groups"
import { wordDiff } from "@/lib/rewrite/diff"
import { lengthViolation, verifyNoInvention } from "@/lib/rewrite/verify"
import { cvSchema } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"

const cv = cvSchema.parse({
  header: { fullName: "Ana Zapata", headline: "Analista de datos", location: "Lima" },
  summary: "Analista de datos con 4 años de experiencia en reportes de ventas.",
  experience: [
    {
      company: "Initech",
      role: "Analista de Datos",
      startDate: "Marzo 2021",
      endDate: "2024",
      bullets: [
        "Reduje en 30% el tiempo de los reportes semanales con Excel y SQL.",
        "Armé tableros de ventas en Power BI para el equipo comercial.",
        "Coordiné a 3 personas en la migración de informes.",
      ],
    },
  ],
  education: [{ institution: "Universidad Nacional", degree: "Estadística" }],
  skills: [{ items: ["Excel", "SQL", "Power BI"] }],
  projects: [{ name: "Panel de Ventas", technologies: ["Python"], bullets: ["Automaticé la carga de datos con Python."] }],
})
const offer: Offer = {
  title: "Analista",
  language: "es",
  requirements: ["Excel y SQL", "Kubernetes", "Docker"],
  niceToHave: ["Tableau"],
  responsibilities: [],
}
const kinds = (text: string, o?: Offer) => verifyNoInvention(cv, text, { offer: o }).violations.map((v) => `${v.kind}:${v.value}`)

describe("verifyNoInvention — lo inventado debe fallar", () => {
  it("cifra nueva", () => {
    expect(kinds("Reduje en 45% el tiempo de los reportes con Excel.")).toEqual(["number:45"])
  })
  it("año o fecha nueva (número y mes)", () => {
    expect(kinds("Trabajé en Initech desde 2019.")).toEqual(["number:2019"])
    expect(kinds("Trabajé en Initech desde Septiembre.")).toEqual(["date:Septiembre"])
  })
  it("cantidad escrita con letras o 'duplicar'", () => {
    expect(kinds("Coordiné a cinco personas.")).toEqual(["number:cinco"])
    expect(kinds("Dupliqué la velocidad de los reportes con Excel.")).toEqual(["number:Dupliqué"])
    expect(kinds("Reportes con Excel: duplicamos la velocidad.")).toEqual(["number:duplicamos"])
  })
  it("tecnología nueva (mayúscula en medio de la frase)", () => {
    expect(kinds("Armé tableros con Tableau y Excel.")).toEqual(["name:Tableau"])
    expect(kinds("Automaticé reportes con Python y Airflow.")).toEqual(["name:Airflow"])
  })
  it("siglas y tecnologías con signos", () => {
    expect(kinds("Desplegué reportes en AWS con Excel.")).toEqual(["name:AWS"])
    expect(kinds("Reportes con Node.js y Excel.")).toEqual(["name:Node.js"])
    expect(kinds("Reportes en C++ con Excel.")).toEqual(["name:C++"])
  })
  it("empresa nueva", () => {
    expect(kinds("Armé tableros de ventas para Globex.")).toEqual(["name:Globex"])
  })
  it("palabra clave de la oferta que el CV no tiene, aunque vaya en minúsculas", () => {
    expect(kinds("Armé tableros de ventas y administré kubernetes.", offer)).toEqual(["offer-term:Kubernetes"])
    expect(kinds("Reportes con Excel y docker.", offer)).toEqual(["offer-term:Docker"])
  })
  it("texto vacío", () => {
    expect(verifyNoInvention(cv, "  ").ok).toBe(false)
  })
})

describe("verifyNoInvention — lo legítimo debe pasar", () => {
  it("reordenar y usar verbos de acción con las mismas cifras", () => {
    expect(verifyNoInvention(cv, "Con Excel y SQL reduje en 30% el tiempo de los reportes semanales.", { offer }).ok).toBe(true)
  })
  it("reutilizar nombres y tecnologías que ya están en el CV", () => {
    expect(verifyNoInvention(cv, "Armé tableros en Power BI para el equipo comercial de Initech.", { offer }).ok).toBe(true)
  })
  it("formato de cifras distinto (30 % / 30%) y años del CV", () => {
    expect(verifyNoInvention(cv, "Reduje 30% los reportes. Desde Marzo 2021 hasta 2024.").ok).toBe(true)
  })
  it("sinónimos de lo que el CV ya dice (informes ↔ reportes)", () => {
    expect(verifyNoInvention(cv, "Coordiné a 3 personas en la migración de reportes.", { offer }).ok).toBe(true)
  })
  it("la primera palabra de una frase en mayúscula no es un nombre propio", () => {
    expect(verifyNoInvention(cv, "Automaticé la carga de datos. Mejoré los reportes con Python.").ok).toBe(true)
  })
  it("acepta el CV como texto plano", () => {
    expect(verifyNoInvention("Usé Docker 3 años", "Con Docker durante 3 años").ok).toBe(true)
    expect(verifyNoInvention("Usé Docker 3 años", "Con Kubernetes durante 3 años").ok).toBe(false)
  })
  it("devuelve mensajes en español", () => {
    const [v] = verifyNoInvention(cv, "Reduje 45%").violations
    expect(v.message).toMatch(/no aparece en tu CV/)
  })
})

describe("lengthViolation", () => {
  it("detecta propuestas que suman frases nuevas", () => {
    expect(lengthViolation("Armé tableros.", "Armé tableros " + "y más cosas ".repeat(10))).not.toBeNull()
    expect(lengthViolation("Armé tableros de ventas.", "Construí tableros de ventas.")).toBeNull()
  })
})

describe("wordDiff", () => {
  it("marca lo quitado y lo añadido", () => {
    const d = wordDiff("Armé tableros de ventas", "Construí tableros de ventas mensuales")
    expect(d).toEqual([
      { text: "Armé", type: "del" },
      { text: "Construí", type: "add" },
      { text: "tableros de ventas", type: "same" },
      { text: "mensuales", type: "add" },
    ])
  })
  it("textos iguales → todo igual", () => {
    expect(wordDiff("a b", "a b")).toEqual([{ text: "a b", type: "same" }])
  })
})

describe("grupos y decisiones", () => {
  it("agrupa resumen, puestos y proyectos con viñetas", () => {
    expect(rewriteGroups(cv)).toEqual(["summary", "exp.0", "proj.0"])
    expect(groupItems(cv, "exp.0").map((i) => i.id)).toEqual(["exp.0.0", "exp.0.1", "exp.0.2"])
  })

  const items: RewriteItem[] = [
    { id: "summary", label: "Resumen", original: cv.summary!, proposed: "Nuevo resumen.", status: "changed" },
    { id: "exp.0.0", label: "v1", original: cv.experience[0].bullets[0], proposed: "Viñeta nueva 1.", status: "changed" },
    { id: "exp.0.1", label: "v2", original: cv.experience[0].bullets[1], proposed: "Viñeta nueva 2.", status: "changed" },
    { id: "exp.0.2", label: "v3", original: cv.experience[0].bullets[2], proposed: cv.experience[0].bullets[2], status: "kept" },
    { id: "proj.0.0", label: "p1", original: cv.projects[0].bullets[0], proposed: "Proyecto nuevo.", status: "changed" },
  ]

  it("sin decisiones el CV queda idéntico al original", () => {
    expect(applyDecisions(cv, items, {})).toEqual(cv)
  })
  it("solo se aplican los cambios aceptados; pendientes y rechazados no", () => {
    const out = applyDecisions(cv, items, {
      summary: { status: "accepted" },
      "exp.0.0": { status: "rejected" },
      "exp.0.1": { status: "pending" },
      "proj.0.0": { status: "accepted", edited: "  Proyecto editado.  " },
    })
    expect(out.summary).toBe("Nuevo resumen.")
    expect(out.experience[0].bullets).toEqual(cv.experience[0].bullets)
    expect(out.projects[0].bullets[0]).toBe("Proyecto editado.")
  })
  it("lo descartado por el verificador nunca se aplica, aunque venga 'aceptado'", () => {
    const out = applyDecisions(cv, [{ ...items[3], proposed: "Inventado 99%" }], { "exp.0.2": { status: "accepted" } })
    expect(out.experience[0].bullets[2]).toBe(cv.experience[0].bullets[2])
  })
  it("no modifica el CV original", () => {
    const before = structuredClone(cv)
    applyDecisions(cv, items, { summary: { status: "accepted" } })
    expect(cv).toEqual(before)
  })
})
