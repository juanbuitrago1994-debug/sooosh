import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { withDbTimeout } from "@/lib/db/timeout"
import { countPlatformJobs } from "@/lib/jobs/search"

/** Total de ofertas activas de toda la plataforma (público; se puede cachear 60 s). */
export async function GET() {
  try {
    return NextResponse.json({ total: await withDbTimeout(countPlatformJobs(getDb())) }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } })
  } catch (e) {
    console.error("[jobs count]", e)
    return NextResponse.json({ error: "No se pudo contar las ofertas." }, { status: 502 })
  }
}
