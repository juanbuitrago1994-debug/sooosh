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
