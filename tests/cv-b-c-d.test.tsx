import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/ai", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai")>()),
  // El modelo "no sabe": toda llamada devuelve vacío y manda el respaldo determinista.
  getProvider: () => ({ name: "mock", generateStructured: () => Promise.resolve({ data: {}, meta: {} }) }),
}))

import { splitExperienceBlocks } from "@/lib/cv/blocks"
import { extractContact } from "@/lib/cv/contact"
import { RANGE_RE, parseDate } from "@/lib/cv/dates"
import { buildOverview, shortProfile } from "@/lib/cv/overview"
import { runCvPipeline } from "@/lib/cv/pipeline"
import { applySegmentation, numberLines } from "@/lib/cv/segment"
import { ProfileSummary } from "@/components/cv/profile-summary"
import { heuristicIdentity } from "@/lib/cv/pipeline"
import { cleanOcrText } from "@/lib/extract/ocr-clean"

const fx = (n: string) => readFileSync(path.join(__dirname, "fixtures", n), "utf8")
const now = new Date("2026-11-19")

describe("fechas con día y OCR", () => {
  it("reconoce «11ago 2025 - 06 nov 2026» y «1 Ago 2025 - Sep 2026»", () => {
    expect(RANGE_RE.exec("Nubela 11ago 2025 - 06 nov 2026 Tecnología")?.[0]).toBe("11ago 2025 - 06 nov 2026")
    expect(RANGE_RE.exec("Rappel 1 Ago 2025 - Sep 2026")?.[0]).toBe("1 Ago 2025 - Sep 2026")
    expect(parseDate("11ago 2025")).toEqual({ y: 2025, m: 8 })
  })
})

describe("puestos sin viñetas y anidados", () => {
  it("cada línea con rango abre un puesto, también sin viñetas y con el signo + del OCR", () => {
    const blocks = splitExperienceBlocks(fx("cv-diseno-ocr.txt").split("Experiencia\n")[1].split("Educación")[0])
    expect(blocks).toHaveLength(7 - 1) // Nubela, Banco Sur, Rappel, Movix, Alumnex, Aseguradora (freelance sin fechas no abre)
    expect(blocks[1].bullets).toHaveLength(2)
    expect(blocks[1].bullets[1]).toBe("Rediseño de secciones de cuentas: jerarquía de información y estados vacíos, de carga y de error.")
  })
  it("el rango en su propia línea o junto a la ubicación se une al puesto de arriba", () => {
    const b = splitExperienceBlocks("Analista — Acme\n2018 - 2020\n- Hice cosas\nGerente — Beta\nLima, Perú | Ene 2021 - Actual\n- Más cosas")
    expect(b.map((x) => x.head.length)).toEqual([2, 2])
  })
})

describe("pipeline sobre un CV de diseño leído por OCR", () => {
  it("recupera nombre, puestos, empresas y años (10,9 por fechas) sin inventar", async () => {
    const r = await runCvPipeline(fx("cv-diseno-ocr.txt"), { now })
    expect(r.cv.header).toMatchObject({ fullName: "Ana Paredes", headline: "Product designer", location: "Quito, Ecuador", email: "ana.paredes@example.com", phone: "+593 99 123 4567" })
    expect(r.cv.experience.map((e) => e.company)).toEqual(expect.arrayContaining(["Banco Sur", "Rappel", "Movix", "Alumnex", "Aseguradora Andina"]))
    expect(r.cv.experience).toHaveLength(6)
    expect(r.diagnosis.seniority.years).toBeGreaterThan(9)
    expect(r.diagnosis.sections.map((s) => s.kind)).toEqual(expect.arrayContaining(["summary", "experience", "education"]))
  })
})

describe("resumen corto (overview)", () => {
  it("nombra empresas, habilidades de la taxonomía presentes en el texto y secciones; nada más", async () => {
    const text = fx("cv-diseno-ocr.txt")
    const r = await runCvPipeline(text, { now })
    const o = buildOverview(r.cv, r.diagnosis, text)
    expect(o.name).toBe("Ana Paredes")
    expect(o.companies).toEqual(expect.arrayContaining(["Rappel", "Movix", "Alumnex"]))
    expect(o.skills).toEqual(expect.arrayContaining(["Figma", "Jira"]))
    expect(o.sectionTitles).toEqual(expect.arrayContaining(["Experiencia"]))
    expect(o.profile).toMatch(/^Diseñadora de producto/)
  })
  it("el perfil se acorta a dos frases", () => {
    expect(shortProfile("Una. Dos. Tres. Cuatro.")).toBe("Una. Dos.")
    expect(shortProfile(undefined)).toBeUndefined()
  })
})

describe("contacto al final del CV", () => {
  it("toma el teléfono etiquetado y el correo aunque estén lejos del encabezado y haya ruido", () => {
    const text = "Ruido 20005958 0\nJuana Pérez\n" + "x\n".repeat(50) + "Email juana@example.com\nTeléfono +57 300 123 4567\nGitHub: github.com/juana-p"
    const c = extractContact(text.split("\n").slice(0, 8).join("\n"), text)
    expect(c.email).toBe("juana@example.com")
    expect(c.phone).toBe("+57 300 123 4567")
    expect(c.links.map((l) => l.label)).toContain("GitHub")
  })
  it("«Excel 2016 2018» no se toma por teléfono etiquetado", () => {
    expect(extractContact("Excel 2016 2018").phone).toBeUndefined()
  })
})

describe("segmentación por número de línea", () => {
  const lines = ["Nombre", "", "Soy x.", "Gerente — Beta", "2020 - 2022", "- hice", "Estudios", "Universidad Z"]
  it("convierte números de línea en secciones con el texto original", () => {
    const r = applySegmentation(lines, { sections: [{ kind: "summary", line: 2 }, { kind: "experience", line: 3 }, { kind: "education", line: 6 }] })!
    expect(r.header).toBe("Nombre")
    expect(r.sections.map((s) => [s.kind, s.title])).toEqual([["summary", "Resumen"], ["experience", "Experiencia"], ["education", "Estudios"]])
    expect(r.sections[1].text).toBe("Gerente — Beta\n2020 - 2022\n- hice")
  })
  it("rechaza respuestas inválidas: línea inexistente o sin experiencia", () => {
    expect(applySegmentation(lines, { sections: [{ kind: "experience", line: 99 }] })).toBeNull()
    expect(applySegmentation(lines, { sections: [{ kind: "education", line: 6 }] })).toBeNull()
  })
  it("numera solo líneas con contenido conservando el número original", () => {
    expect(numberLines(lines).split("\n")[0]).toBe("0: Nombre")
    expect(numberLines(lines)).not.toMatch(/^1:/m)
  })
})

describe("OCR: ñ leída como «fi»", () => {
  it("corrige solo raíces seguras", () => {
    expect(cleanOcrText("disefiadora de producto, 3 afios, compafiia")).toBe("diseñadora de producto, 3 años, compañia")
    expect(cleanOcrText("fiable, financiero y oficina")).toBe("fiable, financiero y oficina")
  })
})

describe("Word en párrafos y datos sueltos", () => {
  it("sin viñetas en el CV, las frases completas tras la cabecera son logros", () => {
    const b = splitExperienceBlocks("Auditora — Baker\nEnero 2020 - Actualidad\nLideré auditorías de estados financieros para 12 clientes.\nCapacité a 4 auditores junior del equipo.")
    expect(b[0].bullets).toHaveLength(2)
  })
  it("una ubicación bajo el nombre no es el titular", () => {
    expect(heuristicIdentity("Camila Ortega\nMedellín, Colombia\nContadora")).toMatchObject({ fullName: "Camila Ortega", headline: undefined, location: "Medellín, Colombia" })
  })
  it("quita el dígito suelto de un ícono al final del teléfono", () => {
    expect(extractContact("x", "Teléfono +57 300123 4567 7").phone).toBe("+57 300123 4567")
  })
})

describe("ProfileSummary", () => {
  it("muestra solo lo esencial: sin fortalezas ni «para mejorar»", async () => {
    const text = fx("cv-diseno-ocr.txt")
    const r = await runCvPipeline(text, { now })
    const html = renderToStaticMarkup(<ProfileSummary cv={r.cv} diagnosis={{ ...r.diagnosis, question: null }} sourceText={text} onAnswer={() => {}} onCorrect={() => {}} />)
    for (const t of ["Ana Paredes", "Empresas donde trabajaste", "Habilidades principales", "Secciones de tu CV", "Tu perfil", "Corregir"]) expect(html).toContain(t)
    for (const t of ["Lo más sólido", "Para mejorar", "diagnóstico completo", "viñetas con cifras"]) expect(html).not.toContain(t)
    expect(html).not.toContain("pregunta-cv")
  })
})
