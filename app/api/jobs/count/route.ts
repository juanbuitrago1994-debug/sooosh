import { NextResponse } from "next/server"
import { withDb } from "@/lib/db/resilient"
import { countPlatformJobs } from "@/lib/jobs/search"

/** Total de ofertas activas de toda la plataforma (público; se puede cachear 60 s). */
export async function GET() {
  try {
    return NextResponse.json({ total: await withDb((db) => countPlatformJobs(db)) }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } })
  } catch (e) {
    console.error("[jobs count]", e)
    return NextResponse.json({ error: "No se pudo contar las ofertas." }, { status: 502 })
  }
}
