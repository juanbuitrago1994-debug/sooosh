import { NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { requireAdmin } from "@/lib/jobs/admin"
import { removeCompany, setCompanyActive } from "@/lib/sources/companies"

const idSchema = z.string().uuid()

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const id = idSchema.safeParse((await ctx.params).id)
  const body = z.object({ active: z.boolean() }).safeParse(await request.json().catch(() => null))
  if (!id.success || !body.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  try {
    return (await setCompanyActive(getDb(), id.data, body.data.active)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Esa empresa ya no está." }, { status: 404 })
  } catch (e) {
    console.error("[sources PATCH]", e)
    return NextResponse.json({ error: "No se pudo actualizar." }, { status: 502 })
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const id = idSchema.safeParse((await ctx.params).id)
  if (!id.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  try {
    return (await removeCompany(getDb(), id.data)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Esa empresa ya no está." }, { status: 404 })
  } catch (e) {
    console.error("[sources DELETE]", e)
    return NextResponse.json({ error: "No se pudo eliminar." }, { status: 502 })
  }
}
