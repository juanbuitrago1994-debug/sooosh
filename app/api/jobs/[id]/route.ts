import { NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { requireAdmin } from "@/lib/jobs/admin"
import { deleteJob, JOB_STATUSES, setJobStatus } from "@/lib/jobs/store"

const idSchema = z.string().uuid()

/** Cambia el estado de una tarjeta (activa, cerrada u oculta). Solo administrador. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const id = idSchema.safeParse((await ctx.params).id)
  const body = z.object({ status: z.enum(JOB_STATUSES) }).safeParse(await request.json().catch(() => null))
  if (!id.success || !body.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  try {
    return (await setJobStatus(getDb(), id.data, body.data.status)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Esa tarjeta ya no existe." }, { status: 404 })
  } catch (e) {
    console.error("[jobs PATCH]", e)
    return NextResponse.json({ error: "No se pudo actualizar la tarjeta." }, { status: 502 })
  }
}

/** Elimina una tarjeta. Solo administrador. */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const id = idSchema.safeParse((await ctx.params).id)
  if (!id.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  try {
    return (await deleteJob(getDb(), id.data)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Esa tarjeta ya no existe." }, { status: 404 })
  } catch (e) {
    console.error("[jobs DELETE]", e)
    return NextResponse.json({ error: "No se pudo eliminar la tarjeta." }, { status: 502 })
  }
}
