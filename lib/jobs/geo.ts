import { fold } from "@/lib/keywords/normalize"

/**
 * Geografía de las ofertas, SIN IA: un diccionario de países (nombres y ciudades principales, es/en) para deducir el país y las
 * regiones de búsqueda. Es una ayuda, no una verdad: la persona que carga la oferta revisa y corrige país y regiones.
 */
export type CountryCode = string
type Country = { code: CountryCode; name: string; latam: boolean; names: string[]; cities: string[] }

const c = (code: string, name: string, latam: boolean, names: string[], cities: string[] = []): Country => ({ code, name, latam, names, cities })

export const COUNTRIES: Country[] = [
  c("CO", "Colombia", true, ["colombia"], ["bogota", "medellin", "cali", "barranquilla", "cartagena", "bucaramanga", "pereira", "manizales", "cucuta", "santa marta", "ibague", "envigado", "chia", "soacha"]),
  c("MX", "México", true, ["mexico", "mexicana", "mexicano"], ["cdmx", "ciudad de mexico", "guadalajara", "monterrey", "puebla", "queretaro", "tijuana", "merida", "leon", "toluca", "cancun"]),
  c("AR", "Argentina", true, ["argentina"], ["buenos aires", "caba", "cordoba", "rosario", "mendoza", "la plata", "tucuman"]),
  c("CL", "Chile", true, ["chile"], ["santiago", "valparaiso", "concepcion", "vina del mar"]),
  c("PE", "Perú", true, ["peru"], ["lima", "arequipa", "trujillo", "cusco"]),
  c("UY", "Uruguay", true, ["uruguay"], ["montevideo"]),
  c("EC", "Ecuador", true, ["ecuador"], ["quito", "guayaquil", "cuenca"]),
  c("BO", "Bolivia", true, ["bolivia"], ["la paz", "santa cruz de la sierra", "cochabamba"]),
  c("PY", "Paraguay", true, ["paraguay"], ["asuncion", "ciudad del este"]),
  c("VE", "Venezuela", true, ["venezuela"], ["caracas", "maracaibo", "valencia"]),
  c("CR", "Costa Rica", true, ["costa rica"], ["san jose", "heredia", "alajuela"]),
  c("PA", "Panamá", true, ["panama"], ["ciudad de panama"]),
  c("DO", "República Dominicana", true, ["republica dominicana", "dominican republic"], ["santo domingo", "santiago de los caballeros"]),
  c("GT", "Guatemala", true, ["guatemala"], ["ciudad de guatemala"]),
  c("SV", "El Salvador", true, ["el salvador"], ["san salvador"]),
  c("HN", "Honduras", true, ["honduras"], ["tegucigalpa", "san pedro sula"]),
  c("NI", "Nicaragua", true, ["nicaragua"], ["managua"]),
  c("PR", "Puerto Rico", true, ["puerto rico"], ["san juan"]),
  c("BR", "Brasil", true, ["brasil", "brazil"], ["sao paulo", "rio de janeiro", "belo horizonte", "curitiba", "porto alegre"]),
  c("US", "Estados Unidos", false, ["estados unidos", "united states", "usa", "u.s.a", "ee uu", "ee.uu", "eeuu", "u.s."], ["new york", "san francisco", "los angeles", "miami", "austin", "seattle", "chicago", "boston", "houston", "dallas"]),
  c("ES", "España", false, ["espana", "spain"], ["madrid", "barcelona", "valencia", "sevilla", "bilbao", "malaga", "zaragoza"]),
  c("CA", "Canadá", false, ["canada"], ["toronto", "vancouver", "montreal", "ottawa", "calgary"]),
  c("PT", "Portugal", false, ["portugal"], ["lisboa", "lisbon", "porto"]),
  c("GB", "Reino Unido", false, ["reino unido", "united kingdom", "uk", "inglaterra", "england"], ["london", "londres", "manchester"]),
]

export const COUNTRY_NAME = new Map(COUNTRIES.map((x) => [x.code, x.name]))
export const LATAM_CODES = new Set(COUNTRIES.filter((x) => x.latam).map((x) => x.code))
const LATAM_WORDS = /\b(latam|latinoamerica|latin america|america latina|latinoamericano|latin-america)\b/

/** Regiones que se ofrecen como filtro: LATAM + un país. */
export const REGION_OPTIONS: { code: string; name: string }[] = [{ code: "LATAM", name: "Latinoamérica" }, ...COUNTRIES.map((x) => ({ code: x.code, name: x.name }))]

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const word = (w: string) => new RegExp(`(?<![a-z0-9])${esc(w)}(?![a-z0-9])`, "g")
// «Valencia», «Santiago» o «San José» existen en varios países: solo valen si el país también aparece en el texto.
const AMBIGUOUS = new Set(["valencia", "santiago", "san jose", "leon", "cordoba", "la paz", "lima", "porto", "san juan", "cali"])

export type Geo = { country?: CountryCode; countries: CountryCode[]; latam: boolean }

/** Deduce país(es) y si se menciona LATAM. El país más mencionado (con el encabezado pesando el doble) gana. */
export function detectGeo(text: string): Geo {
  const head = fold(text.slice(0, 900))
  const all = fold(text)
  const score = new Map<CountryCode, number>()
  const add = (code: CountryCode, n: number) => score.set(code, (score.get(code) ?? 0) + n)
  const named = new Set<CountryCode>()
  for (const ct of COUNTRIES) {
    for (const n of ct.names) {
      const re = word(n)
      const inHead = (head.match(re) ?? []).length
      const inAll = (all.match(re) ?? []).length
      if (inAll) named.add(ct.code)
      add(ct.code, inAll + inHead * 2)
    }
  }
  for (const ct of COUNTRIES) {
    for (const city of ct.cities) {
      if (AMBIGUOUS.has(city) && !named.has(ct.code)) continue
      const re = word(city)
      const inHead = (head.match(re) ?? []).length
      const inAll = (all.match(re) ?? []).length
      add(ct.code, inAll + inHead * 2)
    }
  }
  const ranked = [...score.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const countries = ranked.slice(0, 4).map(([code]) => code)
  return { country: countries[0], countries, latam: LATAM_WORDS.test(all) }
}

/** Regiones de búsqueda de una oferta: sus países y, si algún país es de Latinoamérica o el texto dice LATAM, también «LATAM». */
export function regionsFor(geo: { countries: CountryCode[]; latam: boolean }): string[] {
  const regions = new Set<string>(geo.countries)
  if (geo.latam || geo.countries.some((x) => LATAM_CODES.has(x))) regions.add("LATAM")
  return [...regions]
}

/** Código de país a partir del nombre libre de un JSON-LD («Colombia», «CO», «Mexico»). */
export function countryFromName(name: string): CountryCode | undefined {
  const n = fold(name).trim()
  const byCode = COUNTRIES.find((x) => x.code.toLowerCase() === n)
  if (byCode) return byCode.code
  return COUNTRIES.find((x) => x.names.includes(n) || fold(x.name) === n)?.code
}
