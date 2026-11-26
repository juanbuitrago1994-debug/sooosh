import { z } from "zod"
import { WORK_MODES } from "@/lib/jobs/draft"
import { FAMILIES } from "@/lib/jobs/classify"
import { REGION_OPTIONS } from "@/lib/jobs/geo"
import { SENIORITY } from "@/lib/schemas/offer"
import { fold } from "@/lib/keywords/normalize"

/** Opciones que la persona puede elegir al crear una alerta (todas salen de lo que ya sabe el buscador). */
export const EMPLOYMENT_TYPES = ["Tiempo completo", "Medio tiempo", "Indefinido", "Temporal", "Contrato", "Prácticas"] as const
export const ALERT_SENIORITY = SENIORITY.filter((s) => s !== "no-especificado")
export const WORK_MODE_LABEL: Record<(typeof WORK_MODES)[number], string> = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" }
export const SENIORITY_LABEL: Record<string, string> = { practicante: "Practicante", junior: "Junior", "semi-senior": "Semi-senior", senior: "Senior", lead: "Lead", directivo: "Directivo" }
export const FREQUENCIES = [
  { value: "cada_pasada", label: "Cada pasada (≈ 3 h)", hint: "Te avisamos en cuanto aparezcan ofertas nuevas." },
  { value: "diaria", label: "Una vez al día", hint: "Un solo aviso al día con todo lo nuevo." },
  { value: "semanal", label: "Una vez a la semana", hint: "Un solo aviso por semana con todo lo nuevo." },
] as const
export type Frequency = (typeof FREQUENCIES)[number]["value"]

export const MAX_ALERTS = 10
export const MAX_KEYWORDS = 10

const regionCodes = REGION_OPTIONS.map((r) => r.code) as [string, ...string[]]
const familyKeys = Object.keys(FAMILIES) as [keyof typeof FAMILIES, ...(keyof typeof FAMILIES)[]]

export const filtersSchema = z.object({
  regions: z.array(z.enum(regionCodes)).max(12).default([]),
  workModes: z.array(z.enum(WORK_MODES)).default([]),
  employmentTypes: z.array(z.enum(EMPLOYMENT_TYPES)).default([]),
  seniority: z.array(z.enum(ALERT_SENIORITY as [string, ...string[]])).default([]),
  families: z.array(z.enum(familyKeys)).default([]),
  keywords: z.array(z.string().trim().min(2).max(60)).max(MAX_KEYWORDS).default([]),
})
export type AlertFilters = z.infer<typeof filtersSchema>

export const isEmptyFilters = (f: z.infer<typeof filtersSchema>) => !f.regions.length && !f.workModes.length && !f.employmentTypes.length && !f.seniority.length && !f.families.length && !f.keywords.length

export const alertInputSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre a la alerta.").max(60),
  filters: filtersSchema.refine((f) => !isEmptyFilters(f), { message: "Elige al menos una condición." }),
  frequency: z.enum(["cada_pasada", "diaria", "semanal"]),
})
export type AlertInput = z.infer<typeof alertInputSchema>

const STOP = new Set(["de", "del", "la", "el", "en", "y", "para", "con", "the", "of", "and", "a", "un", "una"])
const stem = (w: string) => w.slice(0, 5)

/** Palabras de cargo que se dicen distinto en español e inglés (la mayoría de ofertas están en inglés). Sin tildes ni mayúsculas. */
const PAIRS: [string, string][] = [
  ["ingeniero", "engineer"], ["desarrollador", "developer"], ["programador", "developer"], ["disenador", "designer"], ["analista", "analyst"], ["datos", "data"],
  ["producto", "product"], ["gerente", "manager"], ["jefe", "manager"], ["lider", "lead"], ["cientifico", "scientist"], ["arquitecto", "architect"],
  ["ventas", "sales"], ["mercadeo", "marketing"], ["contador", "accountant"], ["soporte", "support"], ["calidad", "quality"], ["seguridad", "security"],
  ["nube", "cloud"], ["practicante", "intern"], ["coordinador", "coordinator"], ["asistente", "assistant"], ["reclutador", "recruiter"], ["consultor", "consultant"],
]
const SYN = new Map<string, string[]>()
for (const [es, en] of PAIRS) {
  SYN.set(es, [...(SYN.get(es) ?? []), en])
  SYN.set(en, [...(SYN.get(en) ?? []), es])
}

const tokens = (s: string) => fold(s).split(/[^a-z0-9+#.]+/).filter(Boolean)
const hasWord = (haystack: string[], w: string) => haystack.some((h) => (w.length >= 5 ? h.startsWith(stem(w)) : h === w))

/**
 * ¿El título del cargo corresponde a esta palabra clave? Cada palabra importante de la clave (sin tildes ni mayúsculas, sin «de», «la»…) debe aparecer
 * en el título, o su equivalente en el otro idioma («ingeniero» ↔ «engineer», «datos» ↔ «data»), comparando los primeros 5 caracteres para tolerar plural,
 * género y «diseñador/diseño». Es una heurística con un diccionario corto, no traducción: lo que no esté en él no cruza de idioma.
 */
export function keywordMatches(text: string, keyword: string): boolean {
  const words = tokens(keyword).filter((w) => w.length >= 2 && !STOP.has(w))
  if (!words.length) return false
  const haystack = tokens(text)
  // La palabra tal cual tolera variantes (prefijo de 5); su equivalente en el otro idioma debe ser exacta (o su plural): «developer» no es «development», «analyst» no es «analytics».
  return words.every((w) => hasWord(haystack, w) || (SYN.get(w) ?? []).some((c) => haystack.some((h) => h === c || h === `${c}s` || h === `${c}es`)))
}

/** Solo el TÍTULO: las habilidades de una oferta mencionan de todo («análisis de datos» en un puesto de ingeniería) y llenarían la alerta de falsos positivos (medido con ofertas reales el 26-nov-2026). */
export const jobMatchesKeywords = (job: { title: string }, keywords: string[]): boolean => !keywords.length || keywords.some((k) => keywordMatches(job.title, k))

/** Resumen corto y legible de lo que busca la alerta («Colombia · Remoto · Indefinido · Datos e IA»). */
export function describeFilters(f: AlertFilters): string[] {
  const out: string[] = []
  f.regions.forEach((r) => out.push(REGION_OPTIONS.find((o) => o.code === r)?.name ?? r))
  f.workModes.forEach((m) => out.push(WORK_MODE_LABEL[m]))
  f.employmentTypes.forEach((t) => out.push(t))
  f.seniority.forEach((s) => out.push(SENIORITY_LABEL[s] ?? s))
  f.families.forEach((x) => out.push(FAMILIES[x]))
  f.keywords.forEach((k) => out.push(`«${k}»`))
  return out
}
