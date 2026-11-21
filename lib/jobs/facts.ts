import { formatSalary, type Salary } from "./salary"
import type { JobCard } from "./search"

/**
 * Los datos de una oferta que SÍ tenemos, listos para mostrar. Si un dato no existe, no hay entrada: la interfaz nunca muestra
 * una etiqueta vacía ni «No indica». Cada fuente trae cosas distintas, así que la tarjeta se adapta a lo disponible.
 */
export type Fact = { key: "exp" | "salario" | "modalidad" | "contrato" | "nivel" | "publicada"; label: string; value: string }

const MODE = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" } as const
const LEVEL: Record<string, string> = { practicante: "Practicante", junior: "Junior", "semi-senior": "Semi-senior", senior: "Senior", lead: "Líder", directivo: "Directivo" }

export function yearsLabel(y?: { min?: number; max?: number }): string | null {
  if (!y || (y.min === undefined && y.max === undefined)) return null
  if (y.min !== undefined && y.max !== undefined && y.max > y.min) return `${y.min}–${y.max} años`
  if (y.min !== undefined) return y.min === 0 ? "Sin experiencia" : `${y.min}+ años`
  return `Hasta ${y.max} años`
}

/** «29 oct 2026»: la fecha en hora de Colombia (igual en el servidor y en el navegador, para que no cambie al cargar la página). */
export function dayLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }).formatToParts(d)
  const get = (t: string) => parts.find((x) => x.type === t)?.value.replace(/\./g, "") ?? ""
  return `${get("day")} ${get("month")} ${get("year")}`
}

/** Para una oferta seleccionada por Sooosh: cuándo se publicó (si la fuente lo dice) y cuándo se agregó. */
export function curatedDates(job: { postedAt?: string | null; createdAt: string }): string {
  const added = dayLabel(job.createdAt)
  const posted = dayLabel(job.postedAt)
  return [posted && `Publicada el ${posted}`, added && `Agregada el ${added}`].filter(Boolean).join(" · ")
}

/** «hace 3 días»: solo con la fecha que publicó la fuente (nunca la de carga en Sooosh). */
export function ago(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (days < 0) return null
  if (days === 0) return "hoy"
  if (days === 1) return "ayer"
  if (days < 30) return `hace ${days} días`
  const months = Math.floor(days / 30)
  return months < 12 ? `hace ${months} ${months === 1 ? "mes" : "meses"}` : null
}

export function buildFacts(job: Pick<JobCard, "offer" | "workMode" | "remoteScope" | "employmentType" | "seniority" | "postedAt"> & { salary?: Salary | null }, now = new Date()): Fact[] {
  const out: Fact[] = []
  const exp = yearsLabel(job.offer.yearsExperience)
  if (exp) out.push({ key: "exp", label: "Experiencia", value: exp })
  if (job.salary && (job.salary.min || job.salary.max)) out.push({ key: "salario", label: "Salario", value: formatSalary(job.salary) })
  if (job.workMode) out.push({ key: "modalidad", label: "Modalidad", value: MODE[job.workMode] })
  if (job.employmentType) out.push({ key: "contrato", label: "Contrato", value: job.employmentType })
  if (job.seniority && LEVEL[job.seniority]) out.push({ key: "nivel", label: "Nivel", value: LEVEL[job.seniority] })
  const when = ago(job.postedAt, now)
  if (when) out.push({ key: "publicada", label: "Publicada", value: when })
  return out
}

const SOURCE_NAMES: Record<string, string> = { linkedin: "LinkedIn", indeed: "Indeed", getonboard: "Get on Board", greenhouse: "Greenhouse", lever: "Lever" }

/** Quién ofrece el puesto: la empresa, o —si la oferta no la nombra— dónde se publicó («Publicado en LinkedIn»). Una oferta cargada a mano sin fuente conocida no muestra nada. */
export function companyLine(job: { company?: string | null; sourceName?: string | null }): string | undefined {
  if (job.company) return job.company
  const s = job.sourceName
  if (!s || s === "manual") return undefined
  return `Publicado en ${SOURCE_NAMES[s] ?? s.charAt(0).toUpperCase() + s.slice(1)}`
}
