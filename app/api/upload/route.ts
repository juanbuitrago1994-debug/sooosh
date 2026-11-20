import { randomUUID } from "node:crypto"
import { mkdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import {
  getExtension,
  STORED_ID_RE,
  validateFile,
  type UploadedFile,
} from "@/lib/uploads"

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads")

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 })
  }

  const error = validateFile(file)
  if (error) {
    return NextResponse.json({ error }, { status: error.startsWith("Pesa") ? 413 : 415 })
  }

  const ext = getExtension(file.name)
  const id = `${randomUUID()}.${ext}`

  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
    await writeFile(path.join(UPLOAD_DIR, id), Buffer.from(await file.arrayBuffer()))
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el archivo." }, { status: 500 })
  }

  const body: UploadedFile = { id, name: file.name, size: file.size, type: ext.toUpperCase() }
  return NextResponse.json(body, { status: 201 })
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? ""
  if (!STORED_ID_RE.test(id)) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 })
  }
  try {
    await unlink(path.join(UPLOAD_DIR, id))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      return NextResponse.json({ error: "No se pudo eliminar el archivo." }, { status: 500 })
    }
  }
  return new NextResponse(null, { status: 204 })
}
