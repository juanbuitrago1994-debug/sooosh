import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { addRule, deleteRule, listRules, updateRule } from "@/lib/learning/store"

const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 })
const fail = (e: unknown) => {
  console.error("[learning/rules]", e)
  return NextResponse.json({ error: "No se pudo guardar la regla." }, { status: 500 })
}

/** Reglas de preferencias: visibles, editables, desactivables y borrables. Editar una regla aprendida la vuelve manual. */
export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as { text?: unknown } | null
  if (typeof b?.text !== "string" || b.text.trim().length < 5) return bad("Escribe una regla de al menos 5 caracteres.")
  try {
    const db = await getDb()
    await addRule(db, b.text, "manual")
    return NextResponse.json({ rules: await listRules(db) })
  } catch (e) {
    return fail(e)
  }
}

export async function PATCH(request: Request) {
  const b = (await request.json().catch(() => null)) as { id?: unknown; text?: unknown; enabled?: unknown } | null
  if (typeof b?.id !== "number") return bad("Falta la regla.")
  if (b.text !== undefined && (typeof b.text !== "string" || b.text.trim().length < 5)) return bad("La regla debe tener al menos 5 caracteres.")
  try {
    const db = await getDb()
    await updateRule(db, b.id, { text: b.text as string | undefined, enabled: typeof b.enabled === "boolean" ? b.enabled : undefined })
    return NextResponse.json({ rules: await listRules(db) })
  } catch (e) {
    return fail(e)
  }
}

export async function DELETE(request: Request) {
  const b = (await request.json().catch(() => null)) as { id?: unknown } | null
  if (typeof b?.id !== "number") return bad("Falta la regla.")
  try {
    const db = await getDb()
    await deleteRule(db, b.id)
    return NextResponse.json({ rules: await listRules(db) })
  } catch (e) {
    return fail(e)
  }
}
