import { z } from "zod"

/**
 * Rúbrica de análisis profundo (Fase K, paso K1). Fuente de verdad de QUÉ se evalúa del CV frente a una oferta.
 * Documento hermano: docs/RUBRICA.md. Cada criterio dice cómo se comprueba: "regla" (determinista, sin IA),
 * "juez" (modelo local con salida JSON estricta) o "mixto". Ningún criterio puede apoyarse en algo que no esté en el CV.
 */
export const DIMENSION_IDS = [
  "titular-resumen",
  "habilidades-tecnicas",
  "habilidades-transversales",
  "herramientas",
  "experiencia",
  "logros",
  "educacion-certificaciones",
  "seniority-anos",
  "estructura-ats",
] as const
export type DimensionId = (typeof DIMENSION_IDS)[number]

export type Check = "regla" | "juez" | "mixto"
export type Criterion = { id: string; label: string; check: Check; question: string }
export type Dimension = { id: DimensionId; label: string; weight: number; criteria: Criterion[] }

export const DIMENSIONS: Dimension[] = [
  {
    id: "titular-resumen",
    label: "Titular y resumen",
    weight: 10,
    criteria: [
      { id: "titular-alinea", label: "El titular nombra el rol buscado", check: "mixto", question: "¿El titular coincide o se acerca al título de la oferta, sin inventar un cargo que la persona no ha tenido?" },
      { id: "resumen-formula", label: "El resumen sigue una fórmula clara", check: "juez", question: "¿Dice quién es (rol y años reales), en qué es fuerte y qué valor aporta, en 2 a 4 frases?" },
      { id: "resumen-claves", label: "El resumen incluye las palabras clave principales que el CV puede respaldar", check: "mixto", question: "¿Aparecen en el resumen los términos de mayor peso de la oferta que el CV sí demuestra?" },
      { id: "resumen-relleno", label: "Sin frases genéricas", check: "juez", question: "¿Evita clichés («persona proactiva y dinámica») sin evidencia?" },
    ],
  },
  {
    id: "habilidades-tecnicas",
    label: "Habilidades técnicas (hard skills)",
    weight: 15,
    criteria: [
      { id: "tec-cobertura", label: "Cobertura de requisitos técnicos obligatorios", check: "mixto", question: "¿Cuántos requisitos técnicos obligatorios están cubiertos, con otro nombre o ausentes?" },
      { id: "tec-deseables", label: "Cobertura de deseables", check: "mixto", question: "¿Qué deseables técnicos cubre el CV?" },
      { id: "tec-contexto", label: "Cada habilidad aparece en contexto", check: "regla", question: "¿La habilidad aparece también dentro de un logro o responsabilidad, no solo en una lista?" },
      { id: "tec-ubicacion", label: "Lo más importante se ve primero", check: "regla", question: "¿Las habilidades de mayor peso en la oferta aparecen en el titular, el resumen, las primeras viñetas o los 3 primeros elementos de cada grupo de habilidades?" },
    ],
  },
  {
    id: "habilidades-transversales",
    label: "Habilidades transversales (soft skills)",
    weight: 5,
    criteria: [
      { id: "soft-demostradas", label: "Se demuestran con hechos, no se declaran", check: "juez", question: "¿Hay evidencia (liderar, coordinar, negociar) para las habilidades transversales que pide la oferta?" },
    ],
  },
  {
    id: "herramientas",
    label: "Herramientas y tecnologías",
    weight: 12,
    criteria: [
      { id: "herr-cobertura", label: "Herramientas pedidas presentes", check: "regla", question: "¿Cada herramienta nombrada en la oferta aparece por nombre o sinónimo en el CV? (nunca por parecido semántico)" },
      { id: "herr-version", label: "Nivel o uso indicado", check: "mixto", question: "¿Se indica para qué se usó la herramienta o con qué profundidad?" },
      { id: "herr-agrupadas", label: "Agrupadas con criterio", check: "regla", question: "¿Las herramientas están agrupadas por categoría y no mezcladas con habilidades blandas?" },
    ],
  },
  {
    id: "experiencia",
    label: "Experiencia profesional",
    weight: 20,
    criteria: [
      { id: "exp-relevancia", label: "Relevancia de los puestos para la oferta", check: "juez", question: "¿Qué puestos son más afines a las responsabilidades de la oferta?" },
      { id: "exp-recencia", label: "Recencia de la experiencia relevante", check: "regla", question: "¿La experiencia más afín es reciente? (fechas del CV)" },
      { id: "exp-orden", label: "Orden y énfasis", check: "mixto", question: "¿Lo más relevante está arriba y tiene más viñetas que lo irrelevante?" },
      { id: "exp-huecos", label: "Huecos y fechas", check: "regla", question: "¿Hay fechas faltantes o huecos grandes sin explicar?" },
    ],
  },
  {
    id: "logros",
    label: "Logros e impacto",
    weight: 15,
    criteria: [
      { id: "logro-cifras", label: "Viñetas con resultado medible", check: "regla", question: "¿Qué proporción de viñetas tiene una cifra o resultado verificable en el propio CV?" },
      { id: "logro-formula", label: "Estructura acción-contexto-resultado", check: "juez", question: "¿La viñeta dice qué hizo, cómo y con qué efecto (fórmula tipo X-Y-Z)?" },
      { id: "logro-verbos", label: "Verbos de acción, no de tarea", check: "regla", question: "¿Empieza con verbo de acción y evita «responsable de»?" },
      { id: "logro-longitud", label: "Longitud razonable", check: "regla", question: "¿Las viñetas son breves (una o dos líneas)?" },
    ],
  },
  {
    id: "educacion-certificaciones",
    label: "Educación y certificaciones",
    weight: 8,
    criteria: [
      { id: "edu-requisito", label: "Cumple el nivel educativo pedido", check: "mixto", question: "¿El título o nivel que pide la oferta está en el CV?" },
      { id: "edu-certs", label: "Certificaciones relevantes visibles", check: "mixto", question: "¿Las certificaciones que pide o valora la oferta están en el CV y bien ubicadas?" },
    ],
  },
  {
    id: "seniority-anos",
    label: "Seniority y años de experiencia",
    weight: 8,
    criteria: [
      { id: "sen-anos", label: "Años frente a lo pedido", check: "regla", question: "¿Los años de experiencia relevante (sumados desde las fechas del CV) alcanzan el mínimo de la oferta?" },
      { id: "sen-nivel", label: "Nivel del puesto", check: "mixto", question: "¿El nivel demostrado (alcance, liderazgo) corresponde al nivel de la oferta?" },
    ],
  },
  {
    id: "estructura-ats",
    label: "Estructura, formato y lectura por ATS",
    weight: 7,
    criteria: [
      { id: "est-secciones", label: "Secciones estándar y reconocibles", check: "regla", question: "¿Están Resumen, Experiencia, Educación y Habilidades con títulos convencionales?" },
      { id: "est-orden", label: "Orden cronológico inverso", check: "regla", question: "¿La experiencia va de lo más reciente a lo más antiguo?" },
      { id: "est-contacto", label: "Datos de contacto completos", check: "regla", question: "¿Hay nombre, correo y teléfono o enlace profesional?" },
      { id: "est-extension", label: "Extensión adecuada", check: "regla", question: "¿La longitud es razonable para los años de experiencia?" },
      { id: "est-lectura", label: "Se lee bien al extraerlo como texto", check: "regla", question: "¿El texto extraído conserva el orden y no mezcla columnas?" },
    ],
  },
]

export const TOTAL_WEIGHT = DIMENSIONS.reduce((a, d) => a + d.weight, 0)

export const LEVELS = ["fuerte", "aceptable", "debil", "ausente"] as const
export type Level = (typeof LEVELS)[number]
export const levelOf = (score: number): Level => (score >= 80 ? "fuerte" : score >= 55 ? "aceptable" : score > 0 ? "debil" : "ausente")

const verdict = z.enum(["cumple", "parcial", "no-cumple", "no-aplica"])

/** Hallazgo por criterio. `evidence` es una cita TEXTUAL del CV; sin cita solo puede ser "no-cumple" o "no-aplica" (brecha). */
export const findingSchema = z
  .object({
    criterion: z.string().min(1),
    verdict,
    /** «cita»: el veredicto se apoya en un fragmento literal del CV. «medicion»: es un dato calculado de todo el documento (p. ej. «2 páginas estimadas») y puede ir sin cita. */
    basis: z.enum(["cita", "medicion"]).default("cita"),
    /** Fragmento exacto del CV que respalda el veredicto. */
    evidence: z.string().trim().max(400).nullable(),
    /** Requisito o frase de la oferta con la que se compara. */
    offerRef: z.string().trim().max(300).nullable(),
    /** Una frase, en español, que explica el veredicto. */
    note: z.string().trim().min(1).max(300),
  })
  .refine((f) => f.evidence !== null || f.basis === "medicion" || f.verdict === "no-cumple" || f.verdict === "no-aplica", { message: "Un criterio cumplido o parcial exige evidencia textual del CV (o ser una medición del documento)." })

export const dimensionResultSchema = z.object({
  id: z.enum(DIMENSION_IDS),
  /** 0–100 dentro de la dimensión. */
  score: z.number().min(0).max(100),
  /** false si la oferta no pide nada de esta dimensión (no cuenta en el resumen global). */
  applicable: z.boolean().default(true),
  findings: z.array(findingSchema),
})

/** La ficha NO es un porcentaje único: es una lista de dimensiones con hallazgos; el global es solo un resumen derivado. */
export const scorecardSchema = z.object({
  dimensions: z.array(dimensionResultSchema).length(DIMENSION_IDS.length),
})
export type Finding = z.infer<typeof findingSchema>
export type DimensionResult = z.infer<typeof dimensionResultSchema>
export type Scorecard = z.infer<typeof scorecardSchema>

/** Resumen ponderado (0–100) derivado de la ficha. */
export function overallScore(card: Scorecard): number {
  const w = new Map(DIMENSIONS.map((d) => [d.id, d.weight]))
  const dims = card.dimensions.filter((d) => d.applicable)
  const total = dims.reduce((a, d) => a + (w.get(d.id) ?? 0), 0)
  if (total === 0) return 0
  return Math.round(dims.reduce((a, d) => a + d.score * (w.get(d.id) ?? 0), 0) / total)
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()

/** Devuelve los hallazgos cuya evidencia NO aparece literalmente en el texto del CV (anti-invención). */
export function unverifiedEvidence(card: Scorecard, cvText: string): Finding[] {
  const hay = norm(cvText)
  return card.dimensions.flatMap((d) => d.findings.filter((f) => f.evidence !== null && !hay.includes(norm(f.evidence))))
}

export const criterionIds = (): string[] => DIMENSIONS.flatMap((d) => d.criteria.map((c) => c.id))
