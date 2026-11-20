import { NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { recordConsent } from "@/lib/events/server"

const schema = z.object({ anonId: z.string().uuid(), personal: z.boolean(), aggregate: z.boolean() })

/** Registra la decisión de consentimiento de un navegador (identificador aleatorio). Sin esto, `/api/events` rechaza todo. */
export async function POST(request: Request) {
  const p = schema.safeParse(await request.json().catch(() => null))
  if (!p.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  try {
    await recordConsent(getDb(), p.data)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[consent]", e)
    return NextResponse.json({ error: "No se pudo guardar tu elección." }, { status: 502 })
  }
}
