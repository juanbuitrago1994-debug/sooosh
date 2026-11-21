import { z } from "zod"
import { getProvider } from "@/lib/ai"
import { fold } from "@/lib/keywords/normalize"
import { type BodySettings, type CvFacts } from "@/lib/apply/body-settings"

/**
 * Propuestas del CUERPO del correo con IA local (Ollama). El modelo escribe SOLO el párrafo central (sin saludo, despedida, firma ni enlaces: eso
 * lo arma `buildBody` con datos del CV) a partir de hechos cerrados del CV y de la oferta. Un verificador por reglas descarta el texto que
 * traiga cifras, años, siglas o nombres propios que no estén en esos hechos; si el modelo falla o no pasa la verificación, hay propuestas de
 * plantilla (sin IA). Nunca se inventan datos del CV.
 */
export const LENGTH_WORDS: Record<BodySettings["length"], [number, number]> = { corto: [30, 60], medio: [70, 120], largo: [130, 190] }
const TONE_HINT: Record<BodySettings["tone"], string> = {
  cercano: "cercano y cordial, con calidez y empatía hacia el equipo, sin exceso de confianza",
  profesional: "formal y sobrio, siempre de tú, sin frases hechas",
  directo: "directo y al grano, sin rodeos ni adornos",
}
const FOCUS_HINT: Record<Exclude<BodySettings["focus"], "variado">, string> = {
  experiencia: "destaca la experiencia laboral reciente del CV",
  habilidades: "destaca las habilidades y herramientas que la oferta pide y que el CV tiene",
  motivacion: "destaca el interés por el cargo y cómo el perfil del CV puede aportar al equipo",
}

export { LENGTHS, TONES, FOCUSES, DEFAULT_SETTINGS, cvFacts } from "@/lib/apply/body-settings"
export type { BodySettings, CvFacts } from "@/lib/apply/body-settings"
export type BodyInput = { title: string; company?: string | null; requirements: string[]; covered: string[]; facts: CvFacts }
export type BodyProposal = { middle: string; source: "ia" | "plantilla" }

export const corpusOf = (i: BodyInput) =>
  fold([i.title, i.company ?? "", ...i.requirements, ...i.covered, i.facts.headline ?? "", ...i.facts.skills, ...i.facts.roles.flatMap((r) => [r.role, r.company]), ...i.facts.languages].join(" "))

const CAPITAL_OK = new Set(["hola", "gracias", "saludos", "espero", "quedo", "cuento", "me", "mi", "mis", "en", "con", "soy", "estoy", "tengo"])

/** Palabras con riesgo de ser inventadas (cifras, siglas, nombres propios) que NO están en los hechos. Vacío = el texto es seguro. */
export function ungroundedTerms(text: string, corpus: string): string[] {
  const out: string[] = []
  const known = (t: string) => corpus.includes(fold(t))
  for (const n of text.match(/\d[\d.,]*/g) ?? []) if (!known(n)) out.push(n)
  // Siglas y nombres propios (a mitad de frase, o siglas en cualquier parte).
  for (const m of text.matchAll(/[A-ZÁÉÍÓÚÑ][\p{L}\d+#-]*/gu)) {
    const word = m[0]
    const before = text.slice(0, m.index)
    const startOfSentence = before.trim() === "" || /[.!?¡¿:]\s+$|\n\s*$/.test(before)
    const isAcronym = word.length > 1 && word === word.toUpperCase()
    if (startOfSentence && !isAcronym) continue
    if (CAPITAL_OK.has(fold(word)) || known(word)) continue
    out.push(word)
  }
  if (/\baños? de experiencia\b/i.test(text) && !corpus.includes("anos")) out.push("años de experiencia")
  if (/@|https?:|www\./i.test(text)) out.push("enlace o correo")
  if (/[^\p{Script=Latin}\p{N}\p{P}\p{S}\s]/u.test(text)) out.push("texto en otro alfabeto")
  if (/\b(vuestr[oa]s?|vosotros|os)\b/i.test(text)) out.push("vosotros")
  return [...new Set(out)]
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

export function isGroundedMiddle(text: string, input: BodyInput, length: BodySettings["length"]): boolean {
  const t = text.trim()
  const [min, max] = LENGTH_WORDS[length]
  const n = wordCount(t)
  if (n < Math.floor(min * 0.4) || n > Math.ceil(max * 1.5)) return false
  if (/^(hola|estimad|buen)/i.test(t) || /(saludos|atentamente|cordialmente|gracias)[\s.,!]*$/i.test(t)) return false
  return ungroundedTerms(t, corpusOf(input)).length === 0
}

/** Propuestas de plantilla (sin IA): solo con datos que existan en el CV; las que no tengan dato se omiten. */
export function templateMiddles(input: BodyInput): string[] {
  const out: string[] = []
  const first = input.facts.roles[0]
  if (first) out.push(`En mi experiencia más reciente me desempeñé como ${first.role} en ${first.company}, y creo que esa trayectoria se alinea con lo que buscan.`)
  const matches = [...new Set(input.covered.map((c) => c.trim()).filter(Boolean))].slice(0, 3)
  if (matches.length >= 2) out.push(["Algunos puntos de mi perfil que encajan con lo que buscan:", ...matches.map((m) => `• ${m}`)].join("\n"))
  if (input.facts.headline) out.push(`Me interesa esta vacante porque mi perfil como ${input.facts.headline} puede aportar al equipo${input.company ? ` de ${input.company}` : ""}.`)
  return out
}

const schema = z.object({ text: z.string().min(1).max(1800) })

/** Frases por longitud: los modelos locales siguen mejor «N frases» que «N palabras». */
const SENTENCES: Record<BodySettings["length"], string> = { corto: "2 frases", medio: "3 o 4 frases", largo: "5 o 6 frases" }
const OPENINGS = ["Empieza hablando de tu experiencia.", "Empieza hablando de lo que te interesa del cargo.", "Empieza hablando de tus habilidades más útiles para el cargo."]

/** Ángulos de las 3 propuestas: con «variado», uno distinto cada una; con un enfoque elegido, el mismo con otra redacción. */
export function focusesFor(focus: BodySettings["focus"]): (Exclude<BodySettings["focus"], "variado">)[] {
  return focus === "variado" ? ["experiencia", "habilidades", "motivacion"] : [focus, focus, focus]
}

export function bodyPrompt(input: BodyInput, s: BodySettings, avoid: string[], focus: Exclude<BodySettings["focus"], "variado">, n = 0) {
  const system = `Escribes SOLO el párrafo central de un correo de postulación en español (sin saludo, sin despedida, sin firma, sin asunto, sin enlaces), en primera persona de quien se postula.
Español neutro de Latinoamérica: nada de «vosotros» ni «vuestro» (di «su equipo» o «el equipo»); evita formas con género como «entusiasmado» o «dispuesto» (usa «con entusiasmo», «con disposición»).
Reescribe con tus propias palabras: no copies literalmente las frases de la oferta. Cuida la gramática («el área», no «la área»).
Usa EXCLUSIVAMENTE los hechos que te dan del CV y de la oferta. No inventes cifras, años de experiencia, empresas, títulos, certificaciones ni herramientas. Si un dato no está, no lo menciones.
Tono: ${TONE_HINT[s.tone]}. Extensión: ${SENTENCES[s.length]}. Enfoque: ${FOCUS_HINT[focus]}. ${s.focus === "variado" ? "" : OPENINGS[n % OPENINGS.length]}
Responde únicamente con el JSON {"text":"..."}.`
  const user = [
    `Cargo: ${input.title}`,
    input.company ? `Empresa: ${input.company}` : null,
    input.requirements.length ? `La oferta pide:\n${input.requirements.slice(0, 6).map((r) => `- ${r}`).join("\n")}` : null,
    input.covered.length ? `Lo que el CV cubre de la oferta: ${input.covered.slice(0, 8).join(", ")}` : null,
    input.facts.headline ? `Titular del CV: ${input.facts.headline}` : null,
    input.facts.roles.length ? `Experiencia (más reciente primero):\n${input.facts.roles.map((r) => `- ${r.role} en ${r.company}`).join("\n")}` : null,
    input.facts.skills.length ? `Habilidades del CV: ${input.facts.skills.join(", ")}` : null,
    input.facts.languages.length ? `Idiomas: ${input.facts.languages.join(", ")}` : null,
    avoid.length ? `Ya mostradas (no las repitas):\n${avoid.slice(-6).map((a) => `- ${a.slice(0, 160)}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n")
  return { system, user }
}

/** Arreglos seguros de errores frecuentes del modelo: «la área» y formas con género («estoy entusiasmado con…»). */
export function neutralize(text: string): string {
  return text
    .replace(/\bla (á|a)rea\b/gi, (m) => `el ${m.slice(3)}`)
    .replace(/\bEstoy (?:muy |realmente |sumamente )?(?:entusiasmad|emocionad|motivad)[oa] (?:con|por|de) /g, "Me entusiasma ")
    .replace(/\bestoy (?:muy |realmente |sumamente )?(?:entusiasmad|emocionad|motivad)[oa] (?:con|por|de) /g, "me entusiasma ")
    .replace(/\bEstoy (?:muy |totalmente )?dispuest[oa] a /g, "Tengo disposición para ")
    .replace(/\bestoy (?:muy |totalmente )?dispuest[oa] a /g, "tengo disposición para ")
}

const norm = (s: string) => fold(s).replace(/\W+/g, " ").trim()

/**
 * Propuestas nuevas. Sin `angle`: las 3 (una llamada por ángulo, en paralelo). Con `angle` (0, 1 o 2): solo esa, para que el navegador pida
 * las tres por separado y vaya mostrando cada una cuando llega (el modelo local las atiende de a una). Solo se quedan las que pasan la
 * verificación; si el modelo falla, se usa una plantilla que no se haya mostrado.
 */
export async function suggestBodies(input: BodyInput, settings: BodySettings, avoid: string[] = [], signal?: AbortSignal, angle?: number): Promise<BodyProposal[]> {
  const seen = new Set(avoid.map(norm))
  const out: BodyProposal[] = []
  const provider = (() => {
    try {
      return getProvider({ temperature: 0.9 })
    } catch {
      return null
    }
  })()
  const angles = focusesFor(settings.focus).map((focus, n) => ({ focus, n })).filter(({ n }) => angle === undefined || n === angle)
  if (provider) {
    const results = await Promise.allSettled(
      angles.map(({ focus, n }) => {
        const { system, user } = bodyPrompt(input, settings, avoid, focus, n)
        return provider.generateStructured({ system, user, schema, signal, options: { numPredict: 420 } })
      }),
    )
    for (const r of results) {
      if (r.status !== "fulfilled") continue
      const middle = neutralize(r.value.data.text.trim())
      if (!seen.has(norm(middle)) && isGroundedMiddle(middle, input, settings.length)) {
        seen.add(norm(middle))
        out.push({ middle, source: "ia" })
      }
    }
  }
  const want = angle === undefined ? 2 : 1
  if (out.length < want) {
    const templates = templateMiddles(input)
    // Con `angle`, cada ángulo prefiere «su» plantilla para que las 3 peticiones no devuelvan la misma.
    const ordered = angle === undefined ? templates : [...templates.slice(angle), ...templates.slice(0, angle)]
    for (const middle of ordered) {
      if (out.length >= (angle === undefined ? 3 : 1)) break
      if (!seen.has(norm(middle))) {
        seen.add(norm(middle))
        out.push({ middle, source: "plantilla" })
      }
    }
  }
  return out.slice(0, 3)
}
