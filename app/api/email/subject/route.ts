import { NextResponse } from "next/server"
import { z } from "zod"
import { suggestSubject } from "@/lib/apply/subject-ai"

/**
 * Body: `{ title, company?, name?, avoid? }` → `{ subject, source: "ia" | "plantilla" }`. Solo recibe el cargo, la empresa y el nombre
 * (no el CV). El modelo es Ollama local y es opcional: sin él devuelve la siguiente variante de plantilla.
 */
const body = z.object({
  title: z.string().trim().min(1).max(160),
  company: z.string().trim().max(120).nullish(),
  name: z.string().trim().max(120).optional(),
  avoid: z.array(z.string().max(200)).max(12).optional(),
})

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  const { avoid, ...input } = parsed.data
  return NextResponse.json(await suggestSubject(input, avoid ?? [], request.signal))
}
