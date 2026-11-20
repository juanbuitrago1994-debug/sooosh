import { createHash } from "node:crypto"
import { computeFit } from "@/lib/analysis/fit"
import type { CV } from "@/lib/schemas/cv"
import { hasEnoughForFit } from "./enough"
import { isMatch } from "./match"
import type { JobCard } from "./search"

export type JobFit = {
  /** 0–100, de las reglas del motor de coincidencia (sin IA) */
  score: number
  /** `true` si llega al mínimo de match (ver `MATCH_MIN`) */
  match: boolean
  /** habilidades o requisitos de la oferta que el CV cubre */
  covered: number
  /** los más importantes que el CV no muestra (para decir «te falta…») */
  missing: string[]
}
export type RankedJob = JobCard & { fit?: JobFit }
export type SortMode = "relevancia" | "recientes" | "encaje"

const sha = (s: string) => createHash("sha1").update(s).digest("base64url").slice(0, 16)
/** Caché del encaje por (CV, oferta): el mismo CV contra la misma oferta da siempre lo mismo, y calcularlo cuesta ~8 ms. */
const CACHE = new Map<string, JobFit>()
const CACHE_MAX = 50_000

function fitOf(cv: CV, cvKey: string, j: JobCard): JobFit | undefined {
  if (!hasEnoughForFit(j.offer)) return undefined
  const key = `${cvKey}|${j.id}|${sha(JSON.stringify(j.offer))}`
  const hit = CACHE.get(key)
  if (hit) return hit
  try {
    const f = computeFit(cv, j.offer)
    const score = Math.round(f.overall)
    const fit: JobFit = {
      score,
      match: isMatch(score),
      covered: f.coverage.filter((c) => c.status === "cubierto").length,
      // Primero lo que es una habilidad reconocible (herramienta, técnica…), luego el resto; dentro de cada grupo, por peso.
      missing: [...f.gaps].sort((a, b) => Number(!!b.canonical) - Number(!!a.canonical)).slice(0, 3).map((g) => g.label),
    }
    if (CACHE.size >= CACHE_MAX) CACHE.clear()
    CACHE.set(key, fit)
    return fit
  } catch {
    return undefined // una oferta rara no debe tumbar la búsqueda
  }
}

/**
 * Calcula el encaje de cada oferta con el CV y ordena. «relevancia» respeta el orden que ya trae la búsqueda; «recientes» usa la fecha;
 * «encaje» ordena por puntaje. Sin CV no hay encaje y «encaje» cae a la relevancia. Una oferta con menos de 2 requisitos o tareas no
 * tiene encaje (un porcentaje de relleno engañaría) y por eso nunca cuenta como match.
 */
export function rankByFit(jobs: JobCard[], cv: CV | null, sort: SortMode): RankedJob[] {
  const cvKey = cv ? sha(JSON.stringify(cv)) : ""
  const withFit: RankedJob[] = jobs.map((j) => {
    const fit = cv ? fitOf(cv, cvKey, j) : undefined
    return fit ? { ...j, fit } : j
  })
  if (sort === "encaje" && cv) return [...withFit].sort((a, b) => (b.fit?.score ?? -1) - (a.fit?.score ?? -1))
  if (sort === "recientes") return [...withFit].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return withFit
}
