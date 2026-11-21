import { NextResponse } from "next/server"
import { z } from "zod"
import { FOCUSES, LENGTHS, TONES, suggestBodies } from "@/lib/apply/body-ai"

/**
 * Body: `{ title, company?, requirements, covered, facts, settings, avoid? }` → `{ proposals: [{ middle, source }] }`. Recibe solo hechos
 * cerrados del CV (titular, habilidades, cargos, idiomas) y de la oferta, nunca el CV completo. El modelo es Ollama local y es opcional:
 * sin él (o si el texto no pasa la verificación) devuelve propuestas de plantilla.
 */
const short = z.string().trim().min(1).max(200)
const body = z.object({
  title: short,
  company: z.string().trim().max(200).nullish(),
  requirements: z.array(z.string().trim().max(300)).max(10).default([]),
  covered: z.array(short).max(20).default([]),
  facts: z.object({
    headline: z.string().trim().max(200).optional(),
    skills: z.array(short).max(30).default([]),
    roles: z.array(z.object({ role: short, company: short })).max(5).default([]),
    languages: z.array(short).max(6).default([]),
  }),
  settings: z.object({ length: z.enum(LENGTHS), tone: z.enum(TONES), focus: z.enum(FOCUSES) }),
  avoid: z.array(z.string().max(1800)).max(12).optional(),
  /** 0, 1 o 2: pide solo esa propuesta (el navegador las pide por separado para mostrarlas al llegar) */
  angle: z.number().int().min(0).max(2).optional(),
})

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  const { settings, avoid, angle, ...input } = parsed.data
  return NextResponse.json({ proposals: await suggestBodies(input, settings, avoid ?? [], request.signal, angle) })
}
