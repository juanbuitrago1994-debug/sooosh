import { z } from "zod"
import type { AIProvider } from "@/lib/ai"
import { atsProvider } from "./provider"
import { totalYears } from "@/lib/cv/dates"
import { cvCorpus, verifyNoInvention } from "@/lib/rewrite/verify"
import type { CV } from "@/lib/schemas/cv"
import type { AtsLang } from "./headings"

/**
 * Resumen profesional con IA local (solo si el CV original no trae uno). El modelo recibe hechos cerrados del CV y escribe 2–4 frases; un
 * verificador por reglas descarta el texto con cifras, fechas, nombres, siglas o herramientas que el CV no tenga. Si Ollama no está, falla
 * o el texto no pasa, NO hay resumen (la sección se omite y se avisa): nunca se inventa. Los años de experiencia se calculan de las fechas
 * de los puestos, y solo ese número se acepta como dato nuevo.
 */
const schema = z.object({ summary: z.string().trim().min(40).max(700) })

export type SummaryResult = { summary: string | null; reason?: "sin-datos" | "ia-no-disponible" | "no-paso-verificacion" | "forma"; violations?: string[] }

export function summaryFacts(cv: CV, now = new Date()) {
  const years = totalYears(cv.experience.map((e) => ({ start: e.startDate, end: e.endDate })), now)
  return {
    headline: cv.header.headline?.trim() || undefined,
    yearsOfExperience: years != null && years >= 1 ? Math.floor(years) : undefined,
    roles: cv.experience.slice(0, 4).map((e) => ({ role: e.role, company: e.company })),
    skills: cv.skills.flatMap((g) => g.items).slice(0, 14),
    languages: cv.languages.map((l) => l.name),
  }
}

const SYSTEM: Record<AtsLang, string> = {
  es: "Eres redactor de CV. Escribes el resumen profesional de un CV compatible con sistemas ATS: 2 a 4 frases (máximo 60 palabras en total) en español, en tercera persona implícita (sin «yo», «mi» ni «me»), sin exclamaciones ni adjetivos vacíos, que mencione el cargo, los años de experiencia (solo si se te da el dato) y 3 o 4 habilidades o herramientas de la lista. Usa ÚNICAMENTE los datos dados: no inventes cifras, empresas, herramientas ni logros. Responde en JSON {\"summary\": \"...\"}.",
  en: "You are a CV writer. Write the professional summary of an ATS-friendly CV: 2 to 4 sentences (60 words maximum in total) in English, implied third person (no \"I\", \"my\" or \"me\"), no exclamation marks or empty adjectives, mentioning the job title, years of experience (only if given) and 3 or 4 skills or tools from the list. Use ONLY the data given: do not invent figures, companies, tools or achievements. Reply in JSON {\"summary\": \"...\"}.",
}

export const MAX_CHARS = 400
const FIRST_PERSON = /^(yo|mi|mis|me|i|my)\b|\b(yo|mis|my)\b/i
const sentenceCount = (s: string) => (s.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? []).filter((x) => x.trim()).length

/** Sube la orientación a una oferta: se le pide al modelo priorizar, entre los datos dados, los que respaldan el cargo objetivo (sin nombrarlo ni inventar nada). */
/** Los rechazos reales venían de traducir o renombrar habilidades («Pruebas de software» → «Testing»): se pide copiarlas tal cual. */
const COPY: Record<AtsLang, string> = {
  es: " Copia los nombres de habilidades y herramientas EXACTAMENTE como aparecen en los datos: no los traduzcas ni los reemplaces por sinónimos.",
  en: " Copy skill and tool names EXACTLY as they appear in the data: do not translate them or swap them for synonyms.",
}

const FOCUS: Record<AtsLang, string> = {
  es: " El resumen debe estar orientado al cargo objetivo (targetRole): prioriza, entre los datos dados, los que lo respaldan (las habilidades vienen ordenadas por relevancia). No menciones el cargo objetivo ni la empresa; no afirmes nada que los datos no digan.",
  en: " Orient the summary to the target role (targetRole): prioritize, among the given data, what supports it (skills are sorted by relevance). Do not name the target role or the company; do not claim anything the data does not say.",
}

export async function generateSummary(cv: CV, lang: AtsLang, opts: { provider?: AIProvider; now?: Date; signal?: AbortSignal; /** cargo de la oferta a la que se orienta el resumen */ focus?: string } = {}): Promise<SummaryResult> {
  const facts = { ...summaryFacts(cv, opts.now), ...(opts.focus ? { targetRole: opts.focus } : {}) }
  if (!facts.headline && !facts.roles.length) return { summary: null, reason: "sin-datos" }
  let provider = opts.provider
  try {
    provider ??= atsProvider(0.2)
    const system = SYSTEM[lang] + COPY[lang] + (opts.focus ? FOCUS[lang] : "")
    // El único dato nuevo permitido son los años de experiencia calculados.
    const guard = `${cvCorpus({ ...cv, sectionOrder: undefined })}\n${facts.yearsOfExperience ?? ""}`
    let result: SummaryResult = { summary: null, reason: "forma" }
    // Hasta 2 intentos: si el primero se rechaza por palabras que el CV no tiene, el segundo recibe esas palabras como «prohibidas».
    let avoid: string[] = []
    for (let attempt = 0; attempt < 2; attempt++) {
      const user = JSON.stringify(avoid.length ? { ...facts, doNotUseTheseWords: avoid } : facts)
      const res = await provider.generateStructured({ system, user, schema, signal: opts.signal, options: { numPredict: 300 } })
      const text = res.data.summary.replace(/\s+/g, " ").trim()
      const n = sentenceCount(text)
      // ≈ 4 líneas impresas a 10,5 pt (ATS-S3: GOO 2–4 líneas, NOV 2–3).
      if (n < 2 || n > 4 || text.length > MAX_CHARS || /!/.test(text) || FIRST_PERSON.test(text)) {
        result = { summary: null, reason: "forma" }
        continue
      }
      const v = verifyNoInvention(guard, text)
      if (v.ok) return { summary: text }
      avoid = v.violations.map((x) => x.value)
      result = { summary: null, reason: "no-paso-verificacion", violations: avoid }
    }
    return result
  } catch {
    return { summary: null, reason: "ia-no-disponible" }
  }
}
