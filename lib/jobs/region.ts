import { REGION_OPTIONS } from "./geo"

/** «TODAS» no filtra por región; el resto son códigos de `REGION_OPTIONS` (LATAM o un país). */
export const ALL_REGIONS = "TODAS"
export const isRegion = (v: string) => v === ALL_REGIONS || REGION_OPTIONS.some((r) => r.code === v)

/** Zonas horarias (IANA) que identifican un país con certeza. Con ellas no hace falta pedir permiso de ubicación. */
const TIMEZONES: [RegExp, string][] = [
  [/^America\/Bogota$/, "CO"],
  [/^America\/(Mexico_City|Monterrey|Merida|Cancun|Chihuahua|Hermosillo|Tijuana|Mazatlan)$/, "MX"],
  [/^America\/Argentina\//, "AR"],
  [/^America\/(Santiago|Punta_Arenas)$/, "CL"],
  [/^America\/Lima$/, "PE"],
  [/^America\/Montevideo$/, "UY"],
  [/^America\/Guayaquil$/, "EC"],
  [/^America\/La_Paz$/, "BO"],
  [/^America\/Asuncion$/, "PY"],
  [/^America\/Caracas$/, "VE"],
  [/^America\/Costa_Rica$/, "CR"],
  [/^America\/Panama$/, "PA"],
  [/^America\/Santo_Domingo$/, "DO"],
  [/^America\/Guatemala$/, "GT"],
  [/^America\/El_Salvador$/, "SV"],
  [/^America\/Tegucigalpa$/, "HN"],
  [/^America\/Managua$/, "NI"],
  [/^America\/Puerto_Rico$/, "PR"],
  [/^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Manaus|Belem)$/, "BR"],
  [/^Europe\/Madrid$|^Atlantic\/Canary$/, "ES"],
  [/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Detroit|Anchorage)$|^Pacific\/Honolulu$/, "US"],
]

/**
 * Región con la que se abre el buscador, sin pedir ubicación: primero la zona horaria (la más fiable), luego la región del idioma
 * del navegador (es-CO → CO) y, si nada coincide, Latinoamérica para el español y «todas» para el resto.
 */
export function defaultRegion(locale: string | undefined, timeZone: string | undefined): string {
  const tz = TIMEZONES.find(([re]) => re.test(timeZone ?? ""))?.[1]
  if (tz) return tz
  const parts = (locale ?? "").split("-")
  const country = parts[1]?.toUpperCase()
  if (country && REGION_OPTIONS.some((r) => r.code === country)) return country
  return parts[0]?.toLowerCase() === "es" ? "LATAM" : ALL_REGIONS
}
