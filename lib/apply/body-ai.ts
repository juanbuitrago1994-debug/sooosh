import { z } from "zod"
import { getProvider } from "@/lib/ai"
import { fold } from "@/lib/keywords/normalize"
import { type BodySettings, type CvFacts, type Lang } from "@/lib/apply/body-settings"

/**
 * Propuestas del CUERPO del correo con IA local (Ollama). El modelo escribe SOLO el párrafo central (sin saludo, despedida, firma ni enlaces: eso
 * lo arma `buildBody` con datos del CV) a partir de hechos cerrados del CV y de la oferta. Un verificador por reglas descarta el texto que
 * traiga cifras, años, siglas o nombres propios que no estén en esos hechos; si el modelo falla o no pasa la verificación, hay propuestas de
 * plantilla (sin IA). Nunca se inventan datos del CV.
 */
export const LENGTH_WORDS: Record<BodySettings["length"], [number, number]> = { minimo: [12, 35], corto: [30, 60], medio: [70, 120], largo: [130, 190] }

type Hints<K extends string> = Record<Lang, Record<K, string>>
const REGISTER_HINT: Hints<BodySettings["register"]> = {
  es: {
    sobrio: "muy formal y sobrio, sin adornos, exclamaciones ni coloquialismos",
    profesional: "profesional y claro, formal sin ser rígido",
    cercano: "cercano y amable, natural, sin sonar informal en exceso",
    casual: "relajado y conversacional, con naturalidad (sin jerga ni emojis)",
  },
  en: {
    sobrio: "very formal and restrained, no embellishment, exclamations or colloquialisms",
    profesional: "professional and clear, formal without being stiff",
    cercano: "friendly and approachable, natural, never overly informal",
    casual: "relaxed and conversational, natural (no slang, no emojis)",
  },
}
const WARMTH_HINT: Hints<BodySettings["warmth"]> = {
  es: { neutra: "sin expresar emociones; informativo", calida: "con calidez y amabilidad genuina hacia el equipo", entusiasta: "con entusiasmo visible por la oportunidad (sin exagerar ni usar varias exclamaciones)" },
  en: { neutra: "without expressing emotion; informative", calida: "with genuine warmth and kindness toward the team", entusiasta: "with visible enthusiasm for the opportunity (without overdoing it or using several exclamation marks)" },
}
const STYLE_HINT: Hints<BodySettings["style"]> = {
  es: { sencillo: "palabras simples y frases cortas", tecnico: "usa el vocabulario técnico de la oferta (las herramientas y términos que pide)", narrativo: "cuenta brevemente un recorrido, con un hilo conductor" },
  en: { sencillo: "simple words and short sentences", tecnico: "use the technical vocabulary from the job post (the tools and terms it asks for)", narrativo: "briefly tell a short career story with a through-line" },
}
const FOCUS_HINT: Hints<Exclude<BodySettings["focus"], "variado">> = {
  es: {
    experiencia: "destaca la experiencia laboral reciente del CV",
    habilidades: "destaca las habilidades y herramientas que la oferta pide y que el CV tiene",
    motivacion: "destaca el interés por el cargo y cómo el perfil del CV puede aportar al equipo",
  },
  en: {
    experiencia: "highlight the most recent work experience in the CV",
    habilidades: "highlight the skills and tools the job post asks for that the CV has",
    motivacion: "highlight the interest in the role and how the CV's profile can contribute to the team",
  },
}

export { LENGTHS, REGISTERS, WARMTHS, STYLES, LANGS, FOCUSES, GREETINGS, CTAS, DEFAULT_SETTINGS, cvFacts } from "@/lib/apply/body-settings"
export type { BodySettings, CvFacts } from "@/lib/apply/body-settings"
export type BodyInput = { title: string; company?: string | null; requirements: string[]; covered: string[]; facts: CvFacts; /** idioma del correo ya resuelto (por defecto, español) */ lang?: Lang }
export type BodyProposal = { middle: string; source: "ia" | "plantilla" }

export const corpusOf = (i: BodyInput) =>
  fold([i.title, i.company ?? "", ...i.requirements, ...i.covered, i.facts.headline ?? "", ...i.facts.skills, ...i.facts.roles.flatMap((r) => [r.role, r.company]), ...i.facts.languages].join(" "))

const CAPITAL_OK = new Set(["hola", "gracias", "saludos", "espero", "quedo", "cuento", "me", "mi", "mis", "en", "con", "soy", "estoy", "tengo", "i", "my", "hello", "thanks"])

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
  if (/\byears? of (?:\w+ )?experience\b/i.test(text) && !corpus.includes("years")) out.push("years of experience")
  if (/@|https?:|www\./i.test(text)) out.push("enlace o correo")
  if (/[^\p{Script=Latin}\p{N}\p{P}\p{S}\s]/u.test(text)) out.push("texto en otro alfabeto")
  if (/\b(vuestr[oa]s?|vosotros)\b/i.test(text)) out.push("vosotros")
  return [...new Set(out)]
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

export function isGroundedMiddle(text: string, input: BodyInput, length: BodySettings["length"]): boolean {
  const t = text.trim()
  const [min, max] = LENGTH_WORDS[length]
  const n = wordCount(t)
  if (n < Math.floor(min * 0.4) || n > Math.ceil(max * 1.5)) return false
  if (/^(hola|estimad|buen|hello|dear|hi\b)/i.test(t) || /(saludos|atentamente|cordialmente|gracias|thanks|thank you|regards|sincerely)[\s.,!]*$/i.test(t)) return false
  return ungroundedTerms(t, corpusOf(input)).length === 0
}

/** Propuestas de plantilla (sin IA): solo con datos que existan en el CV; las que no tengan dato se omiten. */
export function templateMiddles(input: BodyInput): string[] {
  const en = input.lang === "en"
  const out: string[] = []
  const first = input.facts.roles[0]
  if (first) out.push(en ? `In my most recent role I worked as ${first.role} at ${first.company}, and I believe that background fits what you are looking for.` : `En mi experiencia más reciente me desempeñé como ${first.role} en ${first.company}, y creo que esa trayectoria se alinea con lo que buscan.`)
  const matches = [...new Set(input.covered.map((c) => c.trim()).filter(Boolean))].slice(0, 3)
  if (matches.length >= 2) out.push([en ? "A few points where my profile matches what you are looking for:" : "Algunos puntos de mi perfil que encajan con lo que buscan:", ...matches.map((m) => `• ${m}`)].join("\n"))
  if (input.facts.headline) {
    out.push(
      en
        ? `I am interested in this role because my profile as ${input.facts.headline} can contribute to the team${input.company ? ` at ${input.company}` : ""}.`
        : `Me interesa esta vacante porque mi perfil como ${input.facts.headline} puede aportar al equipo${input.company ? ` de ${input.company}` : ""}.`,
    )
  }
  return out
}

const schema = z.object({ text: z.string().min(1).max(1800) })

/** Frases por longitud: los modelos locales siguen mejor «N frases» que «N palabras». */
const SENTENCES: Record<Lang, Record<BodySettings["length"], string>> = {
  es: { minimo: "1 sola frase de 15 a 25 palabras", corto: "2 frases", medio: "3 o 4 frases", largo: "5 o 6 frases" },
  en: { minimo: "a single sentence of 15 to 25 words", corto: "2 sentences", medio: "3 or 4 sentences", largo: "5 or 6 sentences" },
}
const OPENINGS: Record<Lang, string[]> = {
  es: ["Empieza hablando de tu experiencia.", "Empieza hablando de lo que te interesa del cargo.", "Empieza hablando de tus habilidades más útiles para el cargo."],
  en: ["Start by talking about your experience.", "Start by talking about what interests you in the role.", "Start by talking about your most useful skills for the role."],
}

/** Ángulos de las 3 propuestas: con «variado», uno distinto cada una; con un enfoque elegido, el mismo con otra redacción. */
export function focusesFor(focus: BodySettings["focus"]): (Exclude<BodySettings["focus"], "variado">)[] {
  return focus === "variado" ? ["experiencia", "habilidades", "motivacion"] : [focus, focus, focus]
}

export function bodyPrompt(input: BodyInput, s: BodySettings, avoid: string[], focus: Exclude<BodySettings["focus"], "variado">, n = 0) {
  const lang: Lang = input.lang ?? "es"
  const opening = s.focus === "variado" ? "" : OPENINGS[lang][n % 3]
  const system =
    lang === "en"
      ? `You write ONLY the central paragraph of a job application email in English (no greeting, no sign-off, no signature, no subject line, no links), in the first person of the applicant.
Rewrite in your own words: do not copy sentences from the job post literally. Avoid gendered wording where English allows.
Use EXCLUSIVELY the facts given from the CV and the job post. Do not invent figures, years of experience, companies, degrees, certifications or tools. If a fact is not given, do not mention it.
Register: ${REGISTER_HINT.en[s.register]}. Warmth: ${WARMTH_HINT.en[s.warmth]}. Language: ${STYLE_HINT.en[s.style]}. Length: ${SENTENCES.en[s.length]}. Focus: ${FOCUS_HINT.en[focus]}. ${opening}
Reply only with the JSON {"text":"..."}.`
      : `Escribes SOLO el párrafo central de un correo de postulación en español (sin saludo, sin despedida, sin firma, sin asunto, sin enlaces), en primera persona de quien se postula.
Español neutro de Latinoamérica, siempre de tú hacia el equipo: nada de «vosotros» ni «vuestro» (di «su equipo» o «el equipo»); evita formas con género como «entusiasmado» o «dispuesto» (usa «con entusiasmo», «con disposición»).
Reescribe con tus propias palabras: no copies literalmente las frases de la oferta. Cuida la gramática («el área», no «la área»).
Usa EXCLUSIVAMENTE los hechos que te dan del CV y de la oferta. No inventes cifras, años de experiencia, empresas, títulos, certificaciones ni herramientas. Si un dato no está, no lo menciones.
Registro: ${REGISTER_HINT.es[s.register]}. Calidez: ${WARMTH_HINT.es[s.warmth]}. Lenguaje: ${STYLE_HINT.es[s.style]}. Extensión: ${SENTENCES.es[s.length]}. Enfoque: ${FOCUS_HINT.es[focus]}. ${opening}
Responde únicamente con el JSON {"text":"..."}.`
  const L = lang === "en"
    ? { title: "Role", company: "Company", asks: "The job post asks for", covered: "What the CV covers from the post", headline: "CV headline", roles: "Experience (most recent first)", at: "at", skills: "CV skills", langs: "Languages", avoid: "Already shown (do not repeat)" }
    : { title: "Cargo", company: "Empresa", asks: "La oferta pide", covered: "Lo que el CV cubre de la oferta", headline: "Titular del CV", roles: "Experiencia (más reciente primero)", at: "en", skills: "Habilidades del CV", langs: "Idiomas", avoid: "Ya mostradas (no las repitas)" }
  const user = [
    `${L.title}: ${input.title}`,
    input.company ? `${L.company}: ${input.company}` : null,
    input.requirements.length ? `${L.asks}:\n${input.requirements.slice(0, 6).map((r) => `- ${r}`).join("\n")}` : null,
    input.covered.length ? `${L.covered}: ${input.covered.slice(0, 8).join(", ")}` : null,
    input.facts.headline ? `${L.headline}: ${input.facts.headline}` : null,
    input.facts.roles.length ? `${L.roles}:\n${input.facts.roles.map((r) => `- ${r.role} ${L.at} ${r.company}`).join("\n")}` : null,
    input.facts.skills.length ? `${L.skills}: ${input.facts.skills.join(", ")}` : null,
    input.facts.languages.length ? `${L.langs}: ${input.facts.languages.join(", ")}` : null,
    avoid.length ? `${L.avoid}:\n${avoid.slice(-6).map((a) => `- ${a.slice(0, 160)}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n")
  return { system, user }
}

/** Arreglos seguros de errores frecuentes del modelo en español: «la área» y formas con género («estoy entusiasmado con…»). */
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
      const middle = input.lang === "en" ? r.value.data.text.trim() : neutralize(r.value.data.text.trim())
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
