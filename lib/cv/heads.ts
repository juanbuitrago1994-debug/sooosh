import { fold } from "@/lib/keywords/normalize"
import { RANGE_RE } from "./dates"

/**
 * Interpretación DETERMINISTA de las cabeceras de puestos y estudios ("Cargo — Empresa", "Empresa | Cargo (fechas)"…).
 * El modelo solo se usa cuando aquí no queda claro (ver `confident`). Cada token generado por el modelo local cuesta
 * ~0,12 s, así que lo que se resuelve sin IA es tiempo ahorrado.
 */
const ROLE_WORDS = /\b(analista|ingenier[oa]|desarrollador[a]?|programador[a]?|gerente|director[a]?|practicante|pasante|coordinador[a]?|jefe|jefa|consultor[a]?|dise[nñ]ador[a]?|arquitect[oa]|especialista|asistente|auxiliar|supervisor[a]?|l[ií]der|cient[ií]fic[oa]|administrador[a]?|contador[a]?|vendedor[a]?|ejecutiv[oa]|t[eé]cnic[oa]|operari[oa]|docente|profesor[a]?|abogad[oa]|m[eé]dic[oa]|enfermer[oa]|developer|engineer|manager|analyst|designer|consultant|intern|lead|architect|specialist|assistant|director|officer|scientist|administrator|accountant|teacher|trainee|freelance)\b/i
const ORG_WORDS = /\b(universidad|university|instituto|institute|college|escuela|school|facultad|academia|academy|pontificia|politecnic[oa]|tecnol[oó]gic[oa]|sena|bootcamp|coursera|udemy|platzi)\b/i
const SEP = /\s+[—–|@·•]\s+|\s+-\s+|\s+(?:en|at)\s+|\s*,\s+/i
// En estudios, "en" forma parte del título ("Diplomado en Ciencia de Datos"): no se usa como separador.
const SEP_EDU = /\s+[—–|@·•]\s+|\s+-\s+|\s*,\s+/
const LOCATION = /^[\p{L} .'’-]+,\s*[\p{L} .'’-]+$|\b(remoto|remote|h[ií]brido|hybrid|presencial)\b/iu

const tidy = (s: string) => s.replace(RANGE_RE, " ").replace(/\b(?:19|20)\d{2}\b/g, " ").replace(/[()[\]]/g, " ").replace(/\s+/g, " ").replace(/^[\s|·•—–-]+|[\s|·•—–,-]+$/g, "").trim()

export type JobHead = { role?: string; company?: string; location?: string; confident: boolean }

function splitPair(line: string, kind: "job" | "edu"): [string, string] | null {
  const parts = line.split(kind === "edu" ? SEP_EDU : SEP).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const [a, b] = parts
  if (kind === "job") {
    const aRole = ROLE_WORDS.test(a)
    const bRole = ROLE_WORDS.test(b)
    if (bRole && !aRole) return [b, a] // "Empresa - Cargo" → [cargo, empresa]
    return [a, b] // por defecto "Cargo — Empresa"
  }
  const aOrg = ORG_WORDS.test(a)
  const bOrg = ORG_WORDS.test(b)
  if (aOrg && !bOrg) return [a, b] // [institución, título]
  if (bOrg && !aOrg) return [b, a]
  return [a, b]
}

export function parseJobHead(head: string[]): JobHead {
  const lines = head.map(tidy).filter(Boolean)
  if (lines.length === 0) return { confident: false }
  let role: string | undefined
  let company: string | undefined
  let location: string | undefined
  const rest = lines.slice(1)

  const pair = splitPair(lines[0], "job")
  if (pair) {
    ;[role, company] = pair
  } else if (!ROLE_WORDS.test(lines[0]) && !/[.:;]$/.test(lines[0]) && lines[0].split(/\s+/).length <= 5) {
    // Una sola línea corta sin palabra de cargo («Itti», «Zurich Seguros»): es la empresa (p. ej. una empresa con dos cuentas debajo).
    company = lines[0]
  } else {
    role = lines[0]
  }
  // Resto de líneas/segmentos: ubicación o empresa
  for (const l of rest) {
    for (const seg of l.split(/\s*[|·•]\s*/).map((s) => s.trim()).filter(Boolean)) {
      if (LOCATION.test(seg)) location = location ?? seg
      else if (!company && !ROLE_WORDS.test(seg)) company = seg
    }
  }
  // Si lo que quedó como "cargo" es en realidad la empresa (no tiene palabra de cargo y la otra línea sí), se intercambian.
  if (role && company && !ROLE_WORDS.test(role) && ROLE_WORDS.test(company)) [role, company] = [company, role]
  return { role, company, location, confident: !!role && !!company }
}

export type EduHead = { institution?: string; degree?: string; startDate?: string; endDate?: string; confident: boolean }

export function parseEduHead(head: string[]): EduHead {
  const raw = head.join(" · ")
  const m = RANGE_RE.exec(raw)
  const years = raw.match(/\b(?:19|20)\d{2}\b/g) ?? []
  const startDate = m ? m[1].trim() : undefined
  const endDate = m ? m[2].trim() : years.length === 1 ? years[0] : undefined
  const lines = head.map(tidy).filter(Boolean)
  if (lines.length === 0) return { confident: false }
  let institution: string | undefined
  let degree: string | undefined
  const pair = splitPair(lines[0], "edu")
  if (pair) [institution, degree] = pair
  else if (ORG_WORDS.test(lines[0])) {
    institution = lines[0]
    degree = lines[1]
  } else {
    degree = lines[0]
    institution = lines[1] && ORG_WORDS.test(lines[1]) ? lines[1] : lines[1]
  }
  const confident = !!institution && (ORG_WORDS.test(institution) || !!degree)
  return { institution, degree, startDate, endDate, confident }
}

export const looksLikeRole = (s: string) => ROLE_WORDS.test(fold(s)) || ROLE_WORDS.test(s)

/** Divide la sección de formación en entradas: cada línea con institución o año abre una; lo demás son detalles. */
export function splitEducation(text: string): { head: string[]; bullets: string[] }[] {
  const out: { head: string[]; bullets: string[] }[] = []
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    if (/^\s*(?:[-–—•·*▪◦►➢✓●○■□>]|\d{1,2}[.)])\s+/.test(raw)) {
      const text = line.replace(/^\s*(?:[-–—•·*▪◦►➢✓●○■□>]|\d{1,2}[.)])\s+/, "")
      // Un PDF conserva las viñetas que el Word no tiene: «• Certificación | Entidad, 2022» es un estudio propio (título | entidad + año), no un detalle del anterior.
      if (out.length > 0 && /\s\|\s/.test(text) && /\b(?:19|20)\d{2}\b/.test(text)) out.push({ head: [text], bullets: [] })
      else out[out.length - 1]?.bullets.push(text)
      continue
    }
    const opens = ORG_WORDS.test(line) || /\b(?:19|20)\d{2}\b/.test(line) || out.length === 0
    if (opens) out.push({ head: [line], bullets: [] })
    else out[out.length - 1].head.push(line)
  }
  return out
}
