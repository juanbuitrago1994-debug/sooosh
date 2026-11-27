import { NextResponse } from "next/server"
import { cityOf, offeredCountry, parseCoords } from "@/lib/geo/country"

/**
 * País y ciudad de unas coordenadas (decisión de Juan, 27-nov-2026: permiso del navegador + servicio externo). Las coordenadas se redondean a ~1 km, se envían SOLO a Nominatim
 * (OpenStreetMap, gratuito) desde el servidor —sin cabeceras de la persona— y NO se guardan ni se registran. Devuelve `{ country, city }` (país ISO en mayúsculas o `null`; ciudad o `null`)
 * si el país no está entre los que ofrece la app.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const c = parseCoords(url.searchParams.get("lat"), url.searchParams.get("lon"))
  if (!c) return NextResponse.json({ error: "Coordenadas no válidas." }, { status: 400 })
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=${c.lat}&lon=${c.lon}`, {
      headers: { "User-Agent": "Sooosh/1.0 (detección de país)", "Accept-Language": "es" },
      signal: AbortSignal.timeout(6000),
    })
    if (!r.ok) throw new Error(`nominatim ${r.status}`)
    const reply = await r.json()
    return NextResponse.json({ country: offeredCountry(reply), city: cityOf(reply) })
  } catch {
    return NextResponse.json({ error: "No se pudo identificar el país." }, { status: 502 })
  }
}
