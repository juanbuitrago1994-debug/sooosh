import { NextResponse } from "next/server"
import { z } from "zod"
import { computeFit } from "@/lib/analysis/fit"
import { getDb } from "@/lib/db"
import { hasEnoughForFit } from "@/lib/jobs/enough"
import { getJobCard } from "@/lib/jobs/search"
import { cvSchema } from "@/lib/schemas/cv"

/**
 * Encaje de UNA oferta pública con el CV que se envía (no se guarda): puntaje y qué muestra o no el CV. Reglas del motor de
 * coincidencia, sin IA.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await ctx.params).id)
  const body = z.object({ cv: cvSchema }).safeParse(await request.json().catch(() => null))
  if (!id.success || !body.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  try {
    const job = await getJobCard(getDb(), id.data)
    if (!job) return NextResponse.json({ error: "Esa oferta ya no está disponible." }, { status: 404 })
    if (!hasEnoughForFit(job.offer)) return NextResponse.json({ score: null })
    const fit = computeFit(body.data.cv, job.offer)
    return NextResponse.json({
      score: Math.round(fit.overall),
      covered: fit.coverage.filter((c) => c.status === "cubierto").map((c) => c.term.label),
      related: fit.coverage.filter((c) => c.status === "relacionado").map((c) => c.term.label),
      missing: [...fit.gaps].sort((a, b) => Number(!!b.canonical) - Number(!!a.canonical)).slice(0, 8).map((g) => g.label),
    })
  } catch (e) {
    console.error("[jobs/fit]", e)
    return NextResponse.json({ error: "No se pudo calcular el encaje." }, { status: 502 })
  }
}
