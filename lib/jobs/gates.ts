import { fold } from "@/lib/keywords/normalize"
import { ALL_REGIONS } from "./region"
import { LATAM_CODES, REGION_OPTIONS } from "./geo"

/**
 * «Antes de postular»: dos avisos que se calculan con reglas, sin IA, al abrir una oferta. NO ocultan la oferta ni cambian el puntaje de encaje: solo dicen lo que la
 * persona querría saber antes de gastar tiempo. Idea de las puertas de idioma y elegibilidad de ai-job-search-dev/ai-job-search (MIT), pero ahí un idioma que no declaras
 * es un descarte duro; aquí es un aviso, porque un CV que no lista un idioma no prueba que no se hable (y no se inventa nada: solo se pide revisarlo).
 */

const ALIASES: Record<string, string[]> = {
  es: ["espanol", "castellano", "spanish"],
  en: ["ingles", "english"],
  pt: ["portugues", "portuguese"],
  fr: ["frances", "french"],
  de: ["aleman", "german", "deutsch"],
  it: ["italiano", "italian"],
  zh: ["chino", "mandarin", "mandarino", "chinese"],
  ja: ["japones", "japanese"],
  ko: ["coreano", "korean"],
  ru: ["ruso", "russian"],
  ar: ["arabe", "arabic"],
}
const LANG_OF = new Map(Object.entries(ALIASES).flatMap(([code, names]) => [[code, code] as const, ...names.map((n) => [n, code] as const)]))
/** Nombre de idioma (con o sin tilde, en español o inglés) → código; null si no se reconoce. */
export function languageCode(name: string): string | null {
  const w = fold(name).replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean)
  for (const x of w) if (LANG_OF.has(x)) return LANG_OF.get(x)!
  return null
}

const CEFR: Record<string, number> = { a1: 1, a2: 2, b1: 3, b2: 4, c1: 5, c2: 6 }
const WORDS: [RegExp, number][] = [
  [/\b(nativ[oa]|native|biling[uü]e|bilingual|materna|mother tongue)\b/, 6],
  [/\b(avanzad[oa]|advanced|fluid[oa]|fluent|profesional|professional|full)\b/, 5],
  [/\b(intermedi[oa]|intermediate|conversacional|conversational)\b/, 3],
  [/\b(basic[oa]|basic|elemental|elementary|principiante|beginner)\b/, 2],
]
/** Nivel de un idioma como número (1–6, escala del Marco Común Europeo), o null si no se puede saber. */
export function levelRank(level: string | undefined): number | null {
  if (!level) return null
  const f = fold(level)
  const cefr = f.match(/\b([abc][12])\b/)?.[1]
  if (cefr) return CEFR[cefr]
  return WORDS.find(([r]) => r.test(f))?.[1] ?? null
}

export type LanguageIssue = { language: string; kind: "falta" | "nivel"; required?: string; has?: string }

/**
 * Idiomas que la oferta exige y el CV no muestra (`falta`) o muestra con menos nivel (`nivel`). Se ignora el idioma en que está escrita la oferta (quien la lee lo
 * entiende, aunque no lo liste) y los idiomas que no se reconocen. Solo hay `nivel` si ambos niveles se pueden comparar.
 */
export function languageIssues(cvLanguages: { name: string; level?: string }[], required: { language: string; level?: string }[], offerLanguage?: string | null): LanguageIssue[] {
  const mine = new Map<string, number | null>()
  for (const l of cvLanguages) {
    const code = languageCode(l.name)
    if (!code) continue
    mine.set(code, Math.max(mine.get(code) ?? 0, levelRank(l.level) ?? levelRank(l.name) ?? 0) || null)
  }
  const out: LanguageIssue[] = []
  const seen = new Set<string>()
  for (const r of required) {
    const code = languageCode(r.language)
    if (!code || seen.has(code) || code === offerLanguage) continue
    seen.add(code)
    if (!mine.has(code)) {
      out.push({ language: r.language, kind: "falta", required: r.level })
      continue
    }
    const need = levelRank(r.level)
    const have = mine.get(code) ?? null
    if (need != null && have != null && have < need) out.push({ language: r.language, kind: "nivel", required: r.level, has: cvLanguages.find((l) => languageCode(l.name) === code)?.level })
  }
  return out
}

export function languageMessage(i: LanguageIssue): string {
  if (i.kind === "falta") return `Pide ${i.language}${i.required ? ` (${i.required})` : ""} y tu CV no lo muestra. Si lo hablas, agrégalo en tu CV; si no, esta oferta puede no encajar.`
  return `Pide ${i.language} ${i.required} y tu CV lo muestra como ${i.has}.`
}

export type Eligibility = { ok: true } | { ok: false; message: string }

const regionName = (code: string) => REGION_OPTIONS.find((r) => r.code === code)?.name ?? code

/**
 * ¿Puede postular alguien que vive en `userCountry`? `regions` son las zonas donde la oferta acepta gente (LATAM, países, o «TODAS» si es abierta). Una oferta sin
 * regiones conocidas no se juzga. Es un aviso, no un veto: muchas empresas contratan fuera de lo que dice el anuncio.
 */
export function eligibility(userCountry: string | undefined, job: { regions: string[]; country: string | null }): Eligibility {
  if (!userCountry || job.regions.length === 0) return { ok: true }
  const r = job.regions
  if (r.includes(ALL_REGIONS) || r.includes(userCountry) || (r.includes("LATAM") && LATAM_CODES.has(userCountry))) return { ok: true }
  const where = r.map(regionName).slice(0, 3).join(", ")
  return { ok: false, message: `Es para ${where}${r.length > 3 ? " y otros" : ""}; tu país en Sooosh es ${regionName(userCountry)}. Confirma en el anuncio si aceptan postulantes de allí.` }
}
