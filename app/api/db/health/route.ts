import { NextResponse } from "next/server"
import { dbHealth } from "@/lib/db/resilient"

/** Estado de la conexión con la base y cuántas veces se recreó desde que arrancó el servidor (sin datos personales). */
export async function GET() {
  return NextResponse.json(await dbHealth(), { headers: { "Cache-Control": "no-store" } })
}
