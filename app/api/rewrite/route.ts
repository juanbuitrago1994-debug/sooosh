import { NextResponse } from "next/server"
import { AIError } from "@/lib/ai"
import { rewriteGroup, type Preferences } from "@/lib/ai/rewrite-cv"
import { getDb } from "@/lib/db"
import { loadPreferences } from "@/lib/learning/preferences"
import { rewriteGroups } from "@/lib/rewrite/groups"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

const AI_STATUS = { not_configured: 500, unreachable: 503, model_missing: 503, timeout: 504, invalid_output: 502 } as const

/**
 * Reescribe UN grupo del CV (resumen, o las viñetas de un puesto/proyecto) para la oferta.
 * El cliente llama grupo por grupo para mostrar el avance y poder cancelar.
 * Cada texto devuelto ya pasó el verificador anti-invención o se devuelve con el original.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { cv?: unknown; offer?: unknown; group?: unknown; guard?: unknown; style?: unknown; language?: unknown } | null
  const cv = cvSchema.safeParse(body?.cv)
  const offer = offerSchema.safeParse(body?.offer)
  const group = typeof body?.group === "string" ? body.group : ""
  // Fuente de verdad (texto original + correcciones del usuario): si falta, se usa el CV recibido.
  const guard = typeof body?.guard === "string" && body.guard.length <= 300_000 ? body.guard : undefined
  if (!cv.success || !offer.success) {
    return NextResponse.json({ error: "Faltan el CV o la oferta, o no son válidos." }, { status: 400 })
  }
  if (!rewriteGroups(cv.data).includes(group)) {
    return NextResponse.json({ error: "Ese apartado del CV no existe o no tiene texto para reescribir." }, { status: 400 })
  }
  const style = typeof body?.style === "string" ? body.style.slice(0, 300) : undefined
  const language = body?.language === "en" || body?.language === "es" ? body.language : undefined
  // Memoria de preferencias (reglas + pocos ejemplos). Si la base (Supabase) falla, se reescribe sin ella.
  let preferences: Preferences | undefined
  try {
    preferences = await loadPreferences(await getDb(), group === "summary" ? "Resumen" : group.startsWith("proj") ? "Proyectos" : "Experiencia")
  } catch (e) {
    console.error("[rewrite] sin preferencias:", (e as Error).message)
  }
  try {
    const items = await rewriteGroup(cv.data, offer.data, group, request.signal, guard, { preferences, style, language })
    return NextResponse.json({ items })
  } catch (e) {
    if (e instanceof AIError) return NextResponse.json({ error: e.message, code: e.code }, { status: AI_STATUS[e.code] })
    console.error("[rewrite]", e)
    return NextResponse.json({ error: "Error inesperado al reescribir el CV." }, { status: 500 })
  }
}
