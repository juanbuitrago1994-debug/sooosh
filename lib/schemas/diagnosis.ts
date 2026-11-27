import { z } from "zod"
import { SENIORITY } from "./offer"

const level = z.enum(["alta", "media", "baja"])

/** Diagnóstico automático de un CV: lo que el usuario ve en lugar de un formulario. */
export const diagnosisSchema = z.object({
  language: z.enum(["es", "en", "otro"]),
  /** Secciones detectadas, en el orden en que aparecen en el CV. */
  sections: z.array(z.object({ kind: z.enum(["summary", "experience", "education", "skills", "languages", "projects", "certifications", "volunteering", "awards", "publications", "other"]), title: z.string(), order: z.number().int() })),
  style: z.object({
    tone: z.enum(["formal", "neutro", "cercano"]),
    person: z.enum(["primera", "impersonal", "tercera", "mixta"]),
    tenses: z.enum(["pasado", "presente", "infinitivo", "mixto"]),
    bullets: z.enum(["viñetas", "párrafos", "mixto", "sin-viñetas"]),
    metrics: z.object({ bulletsTotal: z.number().int(), bulletsWithMetrics: z.number().int(), ratio: z.number() }),
    avgBulletWords: z.number(),
  }),
  seniority: z.object({ label: z.enum(SENIORITY), years: z.number().nullable(), basis: z.string() }),
  /** Fortalezas con la cita textual del CV que las respalda (sin cita, no se muestran). */
  strengths: z.array(z.object({ text: z.string(), evidence: z.string() })),
  problems: z.array(z.object({ kind: z.enum(["generico", "sin-cuantificar", "relleno", "estructura"]), text: z.string(), evidence: z.string().optional() })),
  atsRisks: z.array(z.string()),
  confidence: z.object({ name: level, contact: level, experience: level, education: level, language: level }),
  /** Como máximo UNA pregunta dirigida, solo si la confianza de un dato clave es baja. */
  question: z.object({ id: z.enum(["fullName", "experience", "language"]), text: z.string(), kind: z.enum(["text", "choice"]), options: z.array(z.string()).optional() }).nullable(),
})

export type Diagnosis = z.infer<typeof diagnosisSchema>
