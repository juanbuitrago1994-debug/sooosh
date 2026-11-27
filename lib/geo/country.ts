import { COUNTRY_CODES } from "@/lib/auth/profile-schema"

/** Coordenadas válidas, redondeadas a 2 decimales (≈ 1 km): para saber el país no hace falta más, y así se comparte lo mínimo con el servicio externo. */
export function parseCoords(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  const a = Number(lat)
  const b = Number(lon)
  if (lat === null || lon === null || lat === "" || lon === "" || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null
  return { lat: Math.round(a * 100) / 100, lon: Math.round(b * 100) / 100 }
}

/** Ciudad de la respuesta de Nominatim (ciudad, pueblo, municipio…), o `null`. */
export function cityOf(reply: unknown): string | null {
  const a = (reply as { address?: Record<string, unknown> } | null)?.address
  if (!a) return null
  for (const k of ["city", "town", "village", "municipality", "county", "state"]) {
    const v = a[k]
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 80)
  }
  return null
}

/** Código de país (en mayúsculas) de la respuesta de Nominatim, solo si está entre los países que ofrece la app. */
export function offeredCountry(reply: unknown): string | null {
  const code = (reply as { address?: { country_code?: unknown } } | null)?.address?.country_code
  if (typeof code !== "string") return null
  const up = code.toUpperCase()
  return (COUNTRY_CODES as readonly string[]).includes(up) ? up : null
}
