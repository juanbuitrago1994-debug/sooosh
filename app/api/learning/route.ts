import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { listRules, getStats, resetAll } from "@/lib/learning/store"
import { SUMMARIZE_EVERY } from "@/lib/learning/summarize"

const fail = (e: unknown) => {
  console.error("[learning]", e)
  return NextResponse.json({ error: "No se pudo acceder a la memoria de preferencias en este equipo." }, { status: 500 })
}

/** Lo que el sistema ha aprendido: reglas visibles + contadores. */
export async function GET() {
  try {
    const db = await getDb()
    return NextResponse.json({ rules: await listRules(db), stats: await getStats(db), every: SUMMARIZE_EVERY })
  } catch (e) {
    return fail(e)
  }
}

/** Reinicia TODO lo aprendido (decisiones, reglas y contadores). */
export async function DELETE() {
  try {
    await resetAll(await getDb())
    return NextResponse.json({ ok: true })
  } catch (e) {
    return fail(e)
  }
}
