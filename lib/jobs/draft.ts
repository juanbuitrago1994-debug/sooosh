import { skillsIn } from "@/lib/analysis/offer-profile"
import { fold } from "@/lib/keywords/normalize"
import type { JobLd } from "@/lib/offer/html"
import type { Offer } from "@/lib/schemas/offer"
import { refineIdentity, type TitleSource } from "@/lib/offer/identity"
import { detectApply, type Apply } from "./apply"
import { classifyRole, type Family } from "./classify"
import { countryFromName, detectGeo, regionsFor } from "./geo"
import { CURRENCIES, detectSalary, type Salary } from "./salary"
import { ALL_REGIONS } from "./region"
import { normalizeSourceUrl } from "./url"

/**
 * Borrador de tarjeta de oferta: lo que se extrae de un enlace o de un texto pegado, listo para que Juan lo revise y lo guarde.
 * Todo es determinista y sale del propio texto de la oferta (o de sus datos estructurados): nada se inventa. Lo que no se puede
 * deducir queda vacío para que se complete a mano.
 */
export const WORK_MODES = ["remoto", "hibrido", "presencial"] as const
export type WorkMode = (typeof WORK_MODES)[number]

export type JobDraft = {
  sourceUrl: string
  sourceName: string
  title: string
  /** de dónde salió el cargo: texto (escrito en la oferta), inferido (hay que confirmarlo) o falta (se escribe a mano) */
  titleSource?: TitleSource
  company?: string
  locationText?: string
  country?: string
  regions: string[]
  workMode?: WorkMode
  remoteScope?: string
  employmentType?: string
  seniority?: string
  language: "es" | "en" | "otro"
  offer: Offer
  skills: string[]
  apply: Apply
  salary?: Salary
  /** familia de cargo; si falta, se deduce del título al guardar */
  roleFamily?: Family
  postedAt?: string
  validThrough?: string
}

/** Palabras sueltas que las reglas confunden con herramientas («Trabajo», «Systems»): no son habilidades. */
const GENERIC_SKILLS = new Set(["trabajo", "systems", "system", "equipo", "equipos", "experiencia", "proyecto", "proyectos", "empresa", "cliente", "clientes", "usuario", "usuarios", "proceso", "procesos", "herramientas", "conocimientos", "habilidades", "team", "work", "solid", "strong"])

export function detectWorkMode(text: string, ld?: JobLd): WorkMode | undefined {
  const t = fold(text)
  const hybrid = /\b(hibrid[oa]|hybrid)\b/.test(t)
  const remote = /\b(100\s*%?\s*remot[oa]|remot[oa]|remote|teletrabajo|trabajo a distancia|work from home|desde casa|home office|anywhere)\b/.test(t)
  const onsite = /\b(presencial|on-?site|en oficina|in-?office|en sitio)\b/.test(t)
  if (hybrid) return "hibrido"
  if (ld?.remote) return "remoto"
  if (remote && !onsite) return "remoto"
  if (onsite && !remote) return "presencial"
  if (remote && onsite) return t.search(/\b(remot[oa]|remote)\b/) < t.search(/\b(presencial|on-?site)\b/) ? "remoto" : "presencial"
  return undefined
}

const LD_TYPES: Record<string, string> = { FULL_TIME: "Tiempo completo", PART_TIME: "Medio tiempo", CONTRACTOR: "Contrato", TEMPORARY: "Temporal", INTERN: "Prácticas", VOLUNTEER: "Voluntariado" }

export function detectEmploymentType(text: string, ld?: JobLd): string | undefined {
  const fromLd = ld?.employmentType
    ?.split(",")
    .map((x) => LD_TYPES[x.trim().toUpperCase()])
    .filter(Boolean)[0]
  if (fromLd) return fromLd
  const t = fold(text)
  if (/\b(tiempo completo|full[- ]?time|jornada completa)\b/.test(t)) return "Tiempo completo"
  if (/\b(medio tiempo|part[- ]?time|tiempo parcial|media jornada)\b/.test(t)) return "Medio tiempo"
  if (/\b(practicas|pasantia|internship|intern)\b/.test(t)) return "Prácticas"
  if (/\b(freelance|por proyecto|contractor|prestacion de servicios|independiente)\b/.test(t)) return "Contrato"
  if (/\b(temporal|fixed[- ]term|termino fijo|obra o labor)\b/.test(t)) return "Temporal"
  if (/\b(termino indefinido|contrato indefinido|indefinido)\b/.test(t)) return "Indefinido"
  return undefined
}

/** Línea etiquetada («Ubicación: Bogotá, Colombia»): se copia tal cual. */
function labeledLocation(text: string): string | undefined {
  const m = text.match(/^\s*(?:ubicaci[oó]n|lugar(?: de trabajo)?|location|ciudad|sede)\s*[:\-–]\s*(.{3,90})$/im)
  return m?.[1].trim()
}

/** Restricción de un puesto remoto («solo residentes en Colombia», «GMT-5»…): la frase literal del texto. */
export function detectRemoteScope(text: string): string | undefined {
  const patterns = [
    /[^.\n]{0,60}\b(?:solo|únicamente|unicamente|exclusivo para|disponible solo para)\b[^.\n]{0,40}\b(?:residentes|candidatos|personas|profesionales)\b[^.\n]{0,70}/i,
    /[^.\n]{0,50}\b(?:must (?:be located|reside|be based) in|only (?:open to )?candidates (?:from|in|located in)|residents? of)\b[^.\n]{0,70}/i,
    /[^.\n]{0,40}\b(?:GMT|UTC)\s?[+-−]?\s?\d{1,2}\b[^.\n]{0,40}/,
    /[^.\n]{0,40}\b(?:zona horaria|time ?zone|husos? horarios?)\b[^.\n]{0,60}/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) return m[0].replace(/\s+/g, " ").trim().slice(0, 200)
  }
  return undefined
}

function isoDate(v?: string): string | undefined {
  if (!v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

export function buildDraft(input: { offer: Offer; text: string; url?: string; link?: string; ld?: JobLd; applyUrl?: string; fallbackHash: string }): JobDraft {
  const { offer, text, ld } = input
  const linkRaw = input.url ?? input.link
  let sourceUrl = `texto:${input.fallbackHash}`
  let sourceName = "manual"
  if (linkRaw) {
    try {
      const n = normalizeSourceUrl(linkRaw)
      sourceUrl = n.url
      sourceName = n.source
    } catch {
      /* enlace inválido: la oferta se guarda con la huella del texto */
    }
  }
  const head = text.slice(0, 1500)
  const geo = detectGeo(ld?.location ? `${ld.location}\n${head}\n${text}` : text)
  const ldCountry = ld?.location ? countryFromName(ld.location.split(",").at(-1) ?? "") : undefined
  const country = ldCountry ?? geo.country
  const workMode = detectWorkMode(text, ld)
  // Un puesto híbrido o presencial solo se puede ocupar en su ciudad: «con presencia en México y Perú» no abre la oferta a esos países.
  // Solo un puesto remoto (o sin modalidad clara) puede estar abierto a varios países.
  const countries =
    country && (workMode === "hibrido" || workMode === "presencial")
      ? [country]
      : [...new Set([ldCountry, ...(ld?.applicantCountries ?? []).map(countryFromName), ...geo.countries].filter((x): x is string => !!x))].slice(0, 4)
  const ldCurrency = ld?.salary?.currency as Salary["currency"] | undefined
  const ldSalary: Salary | undefined = ld?.salary && ldCurrency && (CURRENCIES as readonly string[]).includes(ldCurrency) ? { min: ld.salary.min, max: ld.salary.max, currency: ldCurrency, period: ld.salary.period } : undefined
  const skills = [...new Set([...(offer.tools ?? []), ...skillsIn(text).filter((s) => s.category === "tool" || s.category === "tech").map((s) => s.label)])].filter((s) => !GENERIC_SKILLS.has(fold(s))).slice(0, 20)
  const id = refineIdentity(offer, text)
  const regions = regionsFor({ countries, latam: geo.latam })
  return {
    sourceUrl,
    sourceName,
    title: id.title,
    titleSource: id.titleSource,
    company: id.company,
    locationText: ld?.location ?? labeledLocation(text),
    country,
    // Sin país ni región conocidos, una tarjeta cargada a mano no se pierde: queda abierta a todas las regiones (se puede cambiar al revisarla).
    regions: regions.length ? regions : [ALL_REGIONS],
    workMode,
    remoteScope: workMode === "remoto" ? detectRemoteScope(text) : undefined,
    employmentType: detectEmploymentType(text, ld),
    seniority: offer.seniority && offer.seniority !== "no-especificado" ? offer.seniority : undefined,
    language: offer.language,
    offer,
    skills,
    roleFamily: classifyRole({ title: id.title, skills }).family,
    apply: detectApply({ sourceUrl, text, applyUrl: input.applyUrl }),
    salary: ldSalary ?? detectSalary(text) ?? undefined,
    postedAt: isoDate(ld?.datePosted),
    validThrough: isoDate(ld?.validThrough),
  }
}
