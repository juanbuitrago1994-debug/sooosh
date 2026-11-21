import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { requireAdmin } from "@/lib/jobs/admin"
import { embedJob } from "@/lib/jobs/embed"
import { addCompany, parseAtsUrl } from "@/lib/sources/companies"
import { countJobs, jobDraftSchema, listJobs, upsertJob, type JobListFilter } from "@/lib/jobs/store"

/** Lista de tarjetas (todas, también ocultas y cerradas). Solo administrador. */
export async function GET(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied
  try {
    const p = new URL(request.url).searchParams
    const only = p.get("only")
    const filter: JobListFilter = { q: p.get("q")?.slice(0, 80) || undefined, only: only === "incompletas" || only === "ocultas" || only === "manuales" ? only : undefined }
    const [list, total] = await Promise.all([listJobs(getDb(), filter), countJobs(getDb(), filter)])
    return NextResponse.json({ jobs: list, total })
  } catch (e) {
    console.error("[jobs GET]", e)
    return NextResponse.json({ error: "No se pudo leer la base de datos de ofertas." }, { status: 502 })
  }
}

/** Guarda (o actualiza, si ya existe el enlace) una tarjeta revisada. Solo administrador. */
export async function POST(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const parsed = jobDraftSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "La tarjeta tiene datos inválidos: revisa el título, la oferta y los campos." }, { status: 400 })
  try {
    const saved = await upsertJob(getDb(), parsed.data)
    // Vector para la búsqueda por significado. Si Ollama no está, la tarjeta se guarda igual y se calcula después (/api/jobs/embed).
    const embedded = await embedJob(getDb(), saved.id).catch(() => false)
    // Si la oferta vive en el tablero de una empresa (Greenhouse, Lever, Ashby), la empresa entra al directorio de fuentes.
    const ats = parseAtsUrl(parsed.data.sourceUrl)
    const company = ats ? { ...ats, ...(await addCompany(getDb(), { ...ats, name: parsed.data.company }).catch(() => ({ created: false, id: "" }))) } : null
    return NextResponse.json({ ...saved, embedded, company: company && company.id ? { ats: company.ats, token: company.token, created: company.created } : null })
  } catch (e) {
    console.error("[jobs POST]", e)
    return NextResponse.json({ error: "No se pudo guardar la tarjeta en la base de datos." }, { status: 502 })
  }
}
