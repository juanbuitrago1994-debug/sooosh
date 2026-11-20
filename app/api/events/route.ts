import { NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { eraseUser, ingestEvents } from "@/lib/events/server"

const postSchema = z.object({ anonId: z.string().uuid(), events: z.array(z.object({ kind: z.unknown(), payload: z.unknown() })).min(1).max(50) })

/**
 * Registra eventos de uso. Solo se guardan si el servidor tiene el consentimiento vigente de ese identificador (403 si no); cada evento
 * se limpia con la lista cerrada de campos de su tipo. Nunca recibe ni guarda el CV, el nombre ni el correo.
 */
export async function POST(request: Request) {
  const p = postSchema.safeParse(await request.json().catch(() => null))
  if (!p.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  try {
    const r = await ingestEvents(getDb(), p.data.anonId, p.data.events as { kind?: unknown; payload?: unknown }[])
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "demasiados" ? 429 : 403 })
    return NextResponse.json(r)
  } catch (e) {
    console.error("[events]", e)
    return NextResponse.json({ error: "No se pudo registrar." }, { status: 502 })
  }
}

/** «Borrar mis datos»: elimina todo lo asociado a ese identificador. */
export async function DELETE(request: Request) {
  const p = z.object({ anonId: z.string().uuid() }).safeParse(await request.json().catch(() => null))
  if (!p.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, ...(await eraseUser(getDb(), p.data.anonId)) })
  } catch (e) {
    console.error("[events DELETE]", e)
    return NextResponse.json({ error: "No se pudieron borrar tus datos. Inténtalo de nuevo." }, { status: 502 })
  }
}
