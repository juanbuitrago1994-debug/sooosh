import { skillsIn } from "@/lib/analysis/offer-profile"
import { detectLanguage } from "@/lib/cv/diagnosis"
import { detectApply } from "@/lib/jobs/apply"
import { classifyRole } from "@/lib/jobs/classify"
import { detectEmploymentType, detectRemoteScope, detectWorkMode, type JobDraft, type WorkMode } from "@/lib/jobs/draft"
import { countryFromName, detectGeo, regionsFor, SERVED_CODES } from "@/lib/jobs/geo"
import { detectSalary } from "@/lib/jobs/salary"
import { normalizeSourceUrl } from "@/lib/jobs/url"
import { fold } from "@/lib/keywords/normalize"
import { offerSchema } from "@/lib/schemas/offer"
import { splitSections, yearsFrom } from "./sections"
import type { ExternalJob } from "./types"

const SENIORITY: [RegExp, string][] = [
  [/\b(intern|pasante|practicante|trainee|becario)\b/i, "practicante"],
  [/\b(junior|jr\.?|entry[- ]level|trainee)\b/i, "junior"],
  [/\b(semi[- ]?senior|ssr\.?|mid[- ]level|intermedio)\b/i, "semi-senior"],
  [/\b(staff|principal|lead|l[ií]der|head of|team lead|tech lead)\b/i, "lead"],
  [/\b(director|vp|vice ?president|gerente general|c[- ]?level|cto|cfo|ceo|coo)\b/i, "directivo"],
  [/\b(senior|sr\.?|sr\b)\b/i, "senior"],
]

/**
 * Clave para reconocer la MISMA oferta publicada en dos fuentes (título, empresa y país sin tildes, mayúsculas ni signos).
 * «+» y «#» se escriben como palabras ANTES de quitar los signos: si no, «C++», «C#» y «C» (tres puestos distintos) darían la misma clave y la
 * segunda oferta se omitiría por «duplicada» (`ingest` descarta lo que otra fuente ya tiene con esa clave). Incidente 28-nov-2026; la idea sale de
 * `tools/job_key.py` de ai-job-search-dev/ai-job-search (MIT), que hace lo mismo con «plus» y «sharp». Un `.` o `/` sigue siendo solo separador:
 * «Node.js» y «Node» se distinguen por el «js», y «UX/UI» y «UX UI» son lo mismo.
 */
const spellSymbols = (s: string) => s.replace(/\+/g, "plus").replace(/#/g, "sharp")

export const dedupeKey = (title: string, company: string | undefined, country: string | undefined) =>
  [title, company ?? "", country ?? ""].map((s) => fold(spellSymbols(s)).replace(/[^a-z0-9]+/g, " ").trim()).join("|")

/**
 * Oferta de una fuente → tarjeta, SIN IA. Devuelve null si la oferta no es para Latinoamérica ni remota abierta a la región
 * (el buscador es de Latinoamérica: una oferta de Madrid o de Texas de un tablero global no entra).
 */
export function externalToDraft(e: ExternalJob): { draft: JobDraft; dedupe: string; text: string } | null {
  // `description` ya es texto plano con las listas como «• elemento» (los adaptadores convierten su HTML con `htmlToLines`).
  const plainLines = e.description.split("\n").map((l) => l.trim()).filter(Boolean)
  const text = plainLines.map((l) => l.replace(/^• /, "- ")).join("\n")
  const sections = e.structured?.requirements || e.structured?.responsibilities || e.structured?.niceToHave ? { requirements: [], responsibilities: [], niceToHave: [], ...e.structured } : splitSections(plainLines)

  // ── geografía
  // Los países que la fuente declara (campo de países y de ubicación) mandan sobre lo que mencione el cuerpo del texto
  // («con presencia en México y Perú» no abre una oferta de Bogotá a esos países).
  const named = (e.countries ?? []).map((c) => countryFromName(c)).filter((c): c is string => !!c)
  const fromLocation = e.locationText ? detectGeo(e.locationText).countries : []
  // Si la fuente declara el país, ese manda: «Marchamalo, Guadalajara, ES» es España, no México (la ciudad de México también se llama Guadalajara).
  const structured = named.length ? [...new Set(named)] : [...new Set(fromLocation)]
  const geo = detectGeo([e.locationText, e.countries?.join(" "), text.slice(0, 1200)].filter(Boolean).join("\n"))
  const countries = structured.length ? structured : geo.countries
  const workMode: WorkMode | undefined = e.workMode ?? detectWorkMode(`${e.locationText ?? ""}\n${text}`)
  const isRemote = workMode === "remoto" || (e.remote === true && !workMode)
  const latamRemote = isRemote && (e.assumeRemoteLatam === true || geo.latam)
  const servedCountries = countries.filter((c) => SERVED_CODES.has(c))
  if (servedCountries.length === 0 && !latamRemote) return null
  // Una oferta presencial o híbrida vale en las ciudades que la fuente lista; una remota, en esos países y en LATAM si está abierta a la región.
  const openCountries = servedCountries.slice(0, 4)
  const regions = regionsFor({ countries: openCountries, latam: latamRemote })
  const country = openCountries.length === 1 ? openCountries[0] : undefined

  // ── contenido
  const years = yearsFrom(sections.requirements ?? [])
  const taxonomy = skillsIn(text).filter((s) => s.category === "tool" || s.category === "tech").map((s) => s.label)
  const skills = [...new Set([...(e.structured?.skills ?? []), ...taxonomy])].slice(0, 20)
  const lang = e.language ?? (text.length > 80 ? (detectLanguage(text).lang as "es" | "en" | "otro") : "otro")
  const seniority = e.seniority ?? SENIORITY.find(([re]) => re.test(e.title))?.[1]
  const offer = offerSchema.parse({
    title: e.title.slice(0, 200),
    company: e.company?.slice(0, 200),
    language: lang === "es" || lang === "en" ? lang : "otro",
    seniority,
    yearsExperience: years,
    requirements: sections.requirements ?? [],
    niceToHave: sections.niceToHave ?? [],
    responsibilities: sections.responsibilities ?? [],
    tools: skills.slice(0, 12),
  })

  const url = (() => {
    try {
      return normalizeSourceUrl(e.url).url
    } catch {
      return e.url
    }
  })()
  const draft: JobDraft = {
    sourceUrl: url,
    sourceName: e.sourceName,
    title: offer.title,
    company: offer.company,
    locationText: e.locationText ?? (e.countries?.filter((c) => c !== "Remote").join(", ") || undefined),
    country,
    regions,
    workMode,
    remoteScope: isRemote ? detectRemoteScope(text) : undefined,
    employmentType: e.employmentType ?? detectEmploymentType(text),
    seniority: offer.seniority,
    language: offer.language,
    offer,
    skills,
    roleFamily: classifyRole({ title: offer.title, department: e.department, skills }).family,
    apply: detectApply({ sourceUrl: url, applyUrl: e.applyUrl }),
    salary: e.salary ?? detectSalary(text) ?? undefined,
    postedAt: e.postedAt,
    validThrough: e.validThrough,
  }
  return { draft, dedupe: dedupeKey(offer.title, offer.company, country), text }
}
