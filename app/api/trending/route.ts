import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { trendingSearches } from "@/lib/events/server"
import { isRegion } from "@/lib/jobs/region"

/** Búsquedas populares de una región (solo las hechas por 5 o más personas distintas que aceptaron «Para todos»). Puede venir vacío. */
export async function GET(request: Request) {
  const region = new URL(request.url).searchParams.get("region") ?? ""
  if (!isRegion(region) || region === "TODAS") return NextResponse.json({ searches: [] })
  try {
    return NextResponse.json({ searches: await trendingSearches(getDb(), region) })
  } catch (e) {
    console.error("[trending]", e)
    return NextResponse.json({ searches: [] })
  }
}
