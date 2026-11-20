import { NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { WORK_MODES } from "@/lib/jobs/draft"
import { embedProfile, embedQuery } from "@/lib/jobs/embed"
import { affinityFor } from "@/lib/events/server"
import { personalize } from "@/lib/events/personalize"
import { MATCH_MIN } from "@/lib/jobs/match"
import { rankByFit } from "@/lib/jobs/rank"
import { isRegion } from "@/lib/jobs/region"
import { withDbTimeout } from "@/lib/db/timeout"
import { getJobCards, searchJobs } from "@/lib/jobs/search"
import { cvSchema } from "@/lib/schemas/cv"

const bodySchema = z.object({
  region: z.string().refine(isRegion, "Región desconocida"),
  q: z.string().trim().max(120).optional(),
  /** búsqueda «mientras escribe»: solo texto (milisegundos); el significado (vector en Ollama) se suma cuando la persona hace una pausa */
  fast: z.boolean().default(false),
  mode: z.enum(WORK_MODES).optional(),
  /** `tecnologia` = solo cargos de tecnología; `todas` = sin filtro */
  area: z.enum(["tecnologia", "todas"]).default("todas"),
  sort: z.enum(["relevancia", "recientes", "encaje"]).default("relevancia"),
  /** solo las que hacen match (encaje ≥ MATCH_MIN); necesita el CV */
  onlyMatches: z.boolean().default(false),
  /** identificador aleatorio de quien aceptó «Para mí»: permite reordenar SUAVEMENTE según lo que ha abierto, guardado o descartado */
  anonId: z.string().uuid().optional(),
  /** solo las guardadas: ids de las ofertas (ignora región, área y texto) */
  savedIds: z.array(z.string().uuid()).max(100).optional(),
  /** El CV de quien busca (opcional): solo sirve para calcular el encaje; no se guarda en ningún lado. */
  cv: z.unknown().optional(),
})

const PAGE = 30
/** Cuántas candidatas se puntúan cuando hay que ordenar o filtrar por encaje (≈ 8 ms cada una la primera vez; luego, de caché). */
const POOL = 80

/**
 * Buscador público de ofertas activas. Filtra por región, área (tecnología) y modalidad, busca por texto (sin tildes) y por significado
 * (bge-m3 local) y, si recibe el CV, calcula el encaje de cada oferta con las reglas del motor de coincidencia (sin IA, sin red).
 * Para ordenar por encaje o mostrar solo los match se puntúa un conjunto más grande (POOL) y luego se recorta a la página.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Búsqueda inválida." }, { status: 400 })
  const { region, q, mode, area, sort, onlyMatches, fast } = parsed.data
  const cv = parsed.data.cv ? cvSchema.safeParse(parsed.data.cv) : null
  const profile = cv?.success ? cv.data : null
  try {
    if (parsed.data.savedIds) {
      const saved = rankByFit(await getJobCards(getDb(), parsed.data.savedIds), profile, "relevancia")
      return NextResponse.json({ jobs: saved, semantic: false, hasCv: !!profile, matches: null, matchMin: MATCH_MIN, scored: null, total: saved.length })
    }
    const embedding = q && !fast ? await embedQuery(q, AbortSignal.timeout(8000)).catch(() => null) : null
    const wide = !!profile && (sort === "encaje" || onlyMatches)
    // Sin texto de búsqueda, las candidatas son las más cercanas al CV (vectores); con texto, las del texto y el significado.
    const profileEmbedding = wide && !q && profile ? await embedProfile(profile, AbortSignal.timeout(8000)).catch(() => null) : null
    const { jobs, semantic, total } = await withDbTimeout(searchJobs(getDb(), { region, q, mode, area, limit: wide ? POOL : PAGE, embedding: embedding ?? undefined, profileEmbedding: profileEmbedding ?? undefined }))
    let ranked = rankByFit(jobs, profile, sort)
    // «Para mí»: con consentimiento personal y suficientes señales, la lista por relevancia se reordena suavemente según su gusto.
    let personalized = false
    if (sort === "relevancia" && parsed.data.anonId) {
      const rows = await affinityFor(getDb(), parsed.data.anonId).catch(() => [])
      const re = personalize(ranked, rows)
      personalized = re !== ranked
      ranked = re
    }
    const matches = ranked.filter((j) => j.fit?.match).length
    if (profile && onlyMatches) ranked = ranked.filter((j) => j.fit?.match)
    // Con «solo match» el total es el de ofertas que hacen match entre las candidatas; si no, el de todas las que cumplen los filtros.
    return NextResponse.json({ jobs: ranked.slice(0, PAGE), semantic, hasCv: !!profile, matches: profile ? matches : null, matchMin: MATCH_MIN, scored: wide ? jobs.length : null, personalized, total: profile && onlyMatches ? matches : total })
  } catch (e) {
    console.error("[search]", e)
    return NextResponse.json({ error: "No se pudo buscar ofertas ahora. Inténtalo de nuevo." }, { status: 502 })
  }
}
