import { z } from "zod"

/** Países ofrecidos (ISO 3166-1). Colombia primero (decisión de producto); el resto va por orden alfabético en español. */
export const COUNTRY_CODES = [
  "CO", "AR", "BO", "BR", "CA", "CL", "CR", "CU", "DO", "EC", "SV", "ES", "US", "GT", "HN", "MX", "NI", "PA", "PY", "PE", "PR", "UY", "VE",
  "DE", "AU", "AT", "BE", "BG", "CN", "KR", "DK", "AE", "SK", "SI", "EE", "PH", "FI", "FR", "GR", "NL", "HU", "IN", "ID", "IE", "IL", "IT",
  "JP", "LV", "LT", "LU", "MA", "NO", "NZ", "PL", "PT", "GB", "CZ", "RO", "RU", "SG", "ZA", "SE", "CH", "TR", "UA", "EG", "NG", "KE", "SA",
] as const

export const MAX_ROLES = 10

const role = z.string().trim().min(2, "Cada cargo necesita al menos 2 letras.").max(60, "Cada cargo admite hasta 60 caracteres.")

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre.").max(80, "El nombre admite hasta 80 caracteres."),
  country: z.enum(COUNTRY_CODES, { message: "Elige tu país de residencia." }),
  roleInterests: z.array(role).min(1, "Añade al menos un cargo que te interese.").max(MAX_ROLES, `Máximo ${MAX_ROLES} cargos.`),
})

export type ProfileInput = z.infer<typeof profileSchema>

/** Sin repetidos (sin distinguir mayúsculas) y conservando el orden. */
export function dedupeRoles(roles: string[]): string[] {
  const seen = new Set<string>()
  return roles.map((r) => r.trim().replace(/\s+/g, " ")).filter((r) => r && !seen.has(r.toLowerCase()) && !!seen.add(r.toLowerCase()))
}

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(code) ?? code
  } catch {
    return code
  }
}
