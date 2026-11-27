import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { LOGIC_VERSION } from "@/lib/cache/results"
import { parseAwards, parseCertifications, parsePublications, parseVolunteering } from "@/lib/cv/extras"
import { parseEduHead, splitEducation } from "@/lib/cv/heads"
import { splitHeadline } from "@/lib/cv/headline"
import { parseLanguages, parseSkills } from "@/lib/cv/lists"
import { educationAndCertificationText, heuristicIdentity } from "@/lib/cv/pipeline"
import { splitSections } from "@/lib/cv/sections"

/**
 * GUARDA DEL CACHÉ (incidente del 27-nov-2026, docs/INCIDENTES.md): el resultado de leer un CV se guarda con una huella que incluye `LOGIC_VERSION`.
 * Si se cambia la lógica determinista de lectura y NO se sube esa versión, el caché sigue entregando lecturas viejas y el arreglo «no funciona»
 * (pasó con el titular). Esta prueba calcula una huella de lo que produce la lógica sobre textos fijos: si cambia, falla y obliga a hacer
 * las dos cosas a la vez: subir `LOGIC_VERSION` (lib/cache/results.ts) y actualizar GOLDEN aquí.
 */
const HEADERS = [
  "Juan Buitrago\n\nSemi Senior Product Designer | Estrategia de Producto | Design Systems | UX Research | Figma\n\nBogotá, Colombia | +57 319 220 0959 | juan@mail.com",
  "Camila Ortega\nMedellín, Colombia\nContadora",
  "Mario Quintero 6\nData Analyst • SQL • Power BI\nmario@mail.com",
  "Ana Pérez\nDiseñadora con nueve años de experiencia creando productos digitales para banca y salud en toda la región.\nana@mail.com",
]
const CV_TEXT = [
  "Ana Pérez", "ana@mail.com", "PERFIL PROFESIONAL", "Diseñadora de producto.", "EXPERIENCIA LABORAL", "Product Designer — Acme", "2020 - 2023", "• Rediseñé el flujo de pago",
  "FORMACIÓN ACADÉMICA", "Diseño — Universidad Nacional 2014 - 2019", "HABILIDADES", "Herramientas: Figma, Sketch", "IDIOMAS", "Inglés (C1)",
  "CERTIFICACIONES", "• Google UX Design - Coursera (2023)", "VOLUNTARIADO", "Mentora — Fundación Código", "2022 - 2023", "• Acompañé a 10 estudiantes", "PREMIOS", "Premio a la innovación — Cámara de Comercio (2022)", "PUBLICACIONES", "Diseño de sistemas — Medium (2024)",
].join("\n")

// Caso REAL (incidente del 27-nov-2026): encabezado combinado, título + universidad en líneas aparte, fechas con mes, rangos y «En curso».
const COMBINED = [
  "HABILIDADES", "Diseño: Figma, Sketch", "EDUCACIÓN Y CERTIFICACIONES", "Formación profesional en Ingeniería de Sistemas / Diseño Interactivo", "Universidad Jorge Tadeo Lozano | 2018 – 2021",
  "Nielsen Norman Group (NN/g) UX Certification | Nielsen Norman Group | Jun 2026 – Ago 2026", "Claude 101 y AI Fluency | Anthropic Academy | En curso", "IxDF Course Certificate – UX Design | Interaction Design Foundation (IxDF) | Feb 2026",
  "Webflow 101 Certification Exam | Webflow | 2024", "Programación Básica | Platzi | 2021", "VOLUNTARIADO", "UI Mentor | ADPList | Ago 2023 – Actualidad", "Mentoría one to one con diseñadores de Latinoamérica y Colombia, y contenido educativo sobre diseño.",
].join("\n\n")

function fingerprint(): string {
  const combined = splitSections(COMBINED).sections
  const split = educationAndCertificationText(combined)
  const out = {
    ids: HEADERS.map((h) => {
      const id = heuristicIdentity(h)
      return { ...id, split: splitHeadline(id.headline) }
    }),
    sections: splitSections(CV_TEXT).sections.map((s) => [s.kind, s.title, s.text]),
    skills: parseSkills("Herramientas: Figma, Sketch\nMétodos: Research, Testing"),
    languages: parseLanguages("Inglés (C1)\nEspañol nativo"),
    certs: parseCertifications("• Google UX Design - Coursera (2023)\n• Curso de Figma"),
    volunteering: parseVolunteering("Mentora — Fundación Código\n2022 - 2023\n• Acompañé a 10 estudiantes"),
    awards: parseAwards("Premio a la innovación — Cámara de Comercio (2022)"),
    combined: {
      kinds: combined.map((x) => x.kind),
      education: splitEducation(split.education).map((b) => parseEduHead(b.head)),
      certs: parseCertifications(split.certifications),
      volunteering: parseVolunteering(combined.filter((x) => x.kind === "volunteering").map((x) => x.text).join("\n")),
    },
    publications: parsePublications("Diseño de sistemas — Medium (2024)"),
  }
  return createHash("sha256").update(JSON.stringify(out)).digest("hex").slice(0, 16)
}

const GOLDEN = { version: 9, hash: "cd064d8a01dda405" }

describe("guarda de LOGIC_VERSION", () => {
  it("la lógica de lectura y la versión del caché cambian juntas", () => {
    const hash = fingerprint()
    const msg = `La lógica determinista de lectura del CV cambió (huella ${hash}). Sube LOGIC_VERSION en lib/cache/results.ts y actualiza GOLDEN en este archivo (version y hash). Sin eso el caché devuelve lecturas viejas.`
    expect({ version: LOGIC_VERSION, hash }, msg).toEqual(GOLDEN)
  })
})
