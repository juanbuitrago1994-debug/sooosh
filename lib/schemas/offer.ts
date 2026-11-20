import { z } from "zod"

const item = z.string().trim().min(1).max(300)

export const OFFER_MIN_CHARS = 200
export const OFFER_MAX_CHARS = 12_000

export const SENIORITY = ["practicante", "junior", "semi-senior", "senior", "lead", "directivo", "no-especificado"] as const
export type Seniority = (typeof SENIORITY)[number]

export const offerSchema = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).optional(),
  /** Idioma en que está escrita la oferta. */
  language: z.enum(["es", "en", "otro"]),
  /** Nivel del puesto, solo si la oferta lo dice. */
  seniority: z.enum(SENIORITY).optional(),
  /** Años de experiencia pedidos, solo si aparecen cifras explícitas. */
  yearsExperience: z.object({ min: z.number().int().min(0).max(50).optional(), max: z.number().int().min(0).max(50).optional() }).optional(),
  /** Requisitos obligatorios, tal como los dice la oferta. */
  requirements: z.array(item).default([]),
  /** Deseables / "se valora" / "nice to have". */
  niceToHave: z.array(item).default([]),
  responsibilities: z.array(item).default([]),
  /** Herramientas y tecnologías nombradas (SQL, Excel, Power BI…). */
  tools: z.array(item).optional(),
  /** Habilidades blandas nombradas (comunicación, liderazgo…). */
  softSkills: z.array(item).optional(),
  /** Idiomas que exige la oferta (no confundir con el idioma en que está escrita). */
  languagesRequired: z.array(z.object({ language: z.string().trim().min(1).max(60), level: z.string().trim().max(60).optional() })).optional(),
})

export type Offer = z.infer<typeof offerSchema>
