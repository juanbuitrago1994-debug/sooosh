import { cacheLife } from "next/cache"
import { getDb } from "@/lib/db"
import type { JobCard } from "@/lib/jobs/search"
import { findMatchingJobs } from "./engine"
import type { AlertFilters } from "./filters"

/**
 * Las ofertas que cumplen unas condiciones, guardadas en memoria unos minutos y COMPARTIDAS entre personas (son ofertas públicas: no llevan nada de
 * nadie). Las ofertas cambian cada ~3 h con la sincronización, así que unos minutos de retraso no se notan, y abrir la lista de una alerta deja de costar
 * dos consultas a la base (~0,5 s) cada vez.
 */
export async function cachedMatchingJobs(filters: AlertFilters, limit = 100): Promise<JobCard[]> {
  "use cache"
  cacheLife("minutes")
  return findMatchingJobs(getDb(), filters, { limit })
}
