import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { cvSchema } from "@/lib/schemas/cv"

const FILE = path.join(process.cwd(), "data", "profile.json")

/** Guarda el CV editado por el usuario en data/profile.json, conservando el texto original. */
export async function PUT(request: Request) {
  const parsed = cvSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "El CV no es válido.", issues: parsed.error.issues }, { status: 400 })
  }
  let previous: Record<string, unknown> = {}
  try {
    previous = JSON.parse(await readFile(FILE, "utf8"))
  } catch {}
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, JSON.stringify({ ...previous, cv: parsed.data, editedAt: new Date().toISOString() }, null, 2))
  return NextResponse.json({ ok: true })
}

