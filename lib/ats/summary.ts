import { z } from "zod"
import { getProvider, type AIProvider } from "@/lib/ai"
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
  es: "Eres redactor de CV. Escribes el resumen profesional de un CV compatible con sistemas ATS: 2 a 4 frases en español, en tercera persona implícita (sin «yo», «mi» ni «me»), sin exclamaciones ni adjetivos vacíos, que mencione el cargo, los años de experiencia (solo si se te da el dato) y 3 o 4 habilidades o herramientas de la lista. Usa ÚNICAMENTE los datos dados: no inventes cifras, empresas, herramientas ni logros. Responde en JSON {\"summary\": \"...\"}.",
  en: "You are a CV writer. Write the professional summary of an ATS-friendly CV: 2 to 4 sentences in English, implied third person (no \"I\", \"my\" or \"me\"), no exclamation marks or empty adjectives, mentioning the job title, years of experience (only if given) and 3 or 4 skills or tools from the list. Use ONLY the data given: do not invent figures, companies, tools or achievements. Reply in JSON {\"summary\": \"...\"}.",
}

const FIRST_PERSON = /^(yo|mi|mis|me|i|my)\b|\b(yo|mis|my)\b/i
const sentenceCount = (s: string) => (s.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? []).filter((x) => x.trim()).length

export async function generateSummary(cv: CV, lang: AtsLang, opts: { provider?: AIProvider; now?: Date; signal?: AbortSignal } = {}): Promise<SummaryResult> {
  const facts = summaryFacts(cv, opts.now)
  if (!facts.headline && !facts.roles.length) return { summary: null, reason: "sin-datos" }
  let provider = opts.provider
  try {
    provider ??= getProvider({ temperature: 0.2 })
    const res = await provider.generateStructured({ system: SYSTEM[lang], user: JSON.stringify(facts), schema, signal: opts.signal, options: { numPredict: 300 } })
    const text = res.data.summary.replace(/\s+/g, " ").trim()
    const n = sentenceCount(text)
    if (n < 2 || n > 4 || /!/.test(text) || FIRST_PERSON.test(text)) return { summary: null, reason: "forma" }
    // El único dato nuevo permitido son los años de experiencia calculados.
    const guard = `${cvCorpus({ ...cv, sectionOrder: undefined })}\n${facts.yearsOfExperience ?? ""}`
    const v = verifyNoInvention(guard, text)
    if (!v.ok) return { summary: null, reason: "no-paso-verificacion", violations: v.violations.map((x) => x.value) }
    return { summary: text }
  } catch {
    return { summary: null, reason: "ia-no-disponible" }
  }
}
