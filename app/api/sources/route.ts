import { NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { requireAdmin } from "@/lib/jobs/admin"
import { addCompany, ATS_LIST, listCompanies, TOKEN_RE, type Ats } from "@/lib/sources/companies"

/** Directorio de empresas cuyo tablero de empleo se sincroniza. Solo administrador. */
export async function GET(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied
  try {
    return NextResponse.json({ companies: await listCompanies(getDb()) })
  } catch (e) {
    console.error("[sources GET]", e)
    return NextResponse.json({ error: "No se pudo leer el directorio de empresas." }, { status: 502 })
  }
}

const addSchema = z.object({ ats: z.enum(ATS_LIST as [string, ...string[]]), token: z.string().trim().regex(TOKEN_RE, "Nombre de tablero inválido"), name: z.string().trim().max(80).optional(), note: z.string().trim().max(200).optional() })

export async function POST(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const p = addSchema.safeParse(await request.json().catch(() => null))
  if (!p.success) return NextResponse.json({ error: "Revisa el sistema (Greenhouse, Lever o Ashby) y el nombre del tablero (letras, números, guion)." }, { status: 400 })
  try {
    return NextResponse.json(await addCompany(getDb(), { ...p.data, ats: p.data.ats as Ats }))
  } catch (e) {
    console.error("[sources POST]", e)
    return NextResponse.json({ error: "No se pudo agregar la empresa." }, { status: 502 })
  }
}
