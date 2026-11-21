import { z } from "zod"
import { getProvider } from "@/lib/ai"
import { fold } from "@/lib/keywords/normalize"

/**
 * «Pedir otro asunto» del panel de correo. El modelo local (Ollama) propone un asunto con SOLO el cargo, la empresa y el nombre; un verificador
 * por reglas descarta cualquier palabra que no salga de esos datos o del vocabulario permitido (nada inventado). Si Ollama no responde o el
 * asunto no pasa la verificación, se usa la siguiente variante de plantilla: el botón siempre devuelve algo.
 */
export type SubjectInput = { title: string; company?: string | null; name?: string }
export type SubjectSuggestion = { subject: string; source: "ia" | "plantilla" }

/** Palabras sueltas que un asunto de postulación puede llevar sin ser un dato de la persona ni de la oferta. */
const ALLOWED = new Set(
  ("postulacion postulante postular candidatura candidato candidata aplicacion aplicar vacante cargo puesto posicion oferta interes interesado interesada interesa " +
    "perfil hoja vida cv curriculum envio propuesta de la el los las al a en para por con y e o un una mi su tu desde sobre como soy").split(" "),
)

const words = (s: string) => fold(s).split(/[^a-z0-9ñ]+/).filter(Boolean)

/** ¿Cada palabra del asunto sale del cargo, la empresa, el nombre o del vocabulario permitido? */
export function isGroundedSubject(subject: string, input: SubjectInput): boolean {
  const s = subject.trim()
  if (s.length < 8 || s.length > 90 || /[\n\r@]|https?:|www\./i.test(s) || /\p{Extended_Pictographic}/u.test(s)) return false
  const known = new Set([...words(input.title), ...words(input.company ?? ""), ...words(input.name ?? "")])
  const w = words(s)
  return w.length > 0 && w.every((x) => known.has(x) || ALLOWED.has(x))
}

/** Variantes de plantilla (sin IA), en orden de preferencia. El dato que falta (empresa, nombre) se omite, nunca se inventa. */
export function templateSubjects(input: SubjectInput): string[] {
  const t = input.title.trim()
  const n = input.name?.trim()
  const c = input.company?.trim()
  const out = [
    n ? `Postulación: ${t} – ${n}` : `Postulación: ${t}`,
    n ? `${n} – Postulación a ${t}` : `Postulación a ${t}`,
    c ? `Postulación a ${t} en ${c}${n ? ` – ${n}` : ""}` : "",
    n ? `Candidatura para ${t} | ${n}` : `Candidatura para ${t}`,
    n ? `${t} – ${n}` : t,
    n ? `Interesado/a en la vacante de ${t} – ${n}` : `Interesado/a en la vacante de ${t}`,
  ]
  return [...new Set(out.filter(Boolean))]
}

const schema = z.object({ subject: z.string().min(1).max(200) })
const SYSTEM = `Escribes el asunto de un correo de postulación a una vacante. Una sola línea en español, de 40 a 80 caracteres, profesional, sin comillas, sin emojis y sin ":" al final.
Usa SOLO el cargo, la empresa y el nombre que te dan; no agregues herramientas, años, cifras ni datos nuevos. Debe ser distinto de los asuntos ya usados.
Responde únicamente con el JSON {"subject": "..."}.`

const sameSubject = (a: string, b: string) => fold(a).replace(/\W+/g, " ").trim() === fold(b).replace(/\W+/g, " ").trim()

/** Un asunto nuevo: primero el modelo (si responde y pasa la verificación), si no, la siguiente plantilla que no se haya usado. */
export async function suggestSubject(input: SubjectInput, avoid: string[] = [], signal?: AbortSignal): Promise<SubjectSuggestion> {
  const used = (s: string) => avoid.some((a) => sameSubject(a, s))
  try {
    const user = [`Cargo: ${input.title}`, input.company ? `Empresa: ${input.company}` : null, input.name ? `Nombre: ${input.name}` : null, avoid.length ? `Ya usados (no los repitas):\n${avoid.map((a) => `- ${a}`).join("\n")}` : null].filter(Boolean).join("\n")
    const { data } = await getProvider({ temperature: 0.8 }).generateStructured({ system: SYSTEM, user, schema, signal, options: { numPredict: 60 } })
    const subject = data.subject.trim().replace(/^["“«]+|["”»]+$/g, "")
    if (isGroundedSubject(subject, input) && !used(subject)) return { subject, source: "ia" }
  } catch {
    /* sin Ollama o sin respuesta válida: se usa la plantilla */
  }
  const all = templateSubjects(input)
  return { subject: all.find((s) => !used(s)) ?? all[0], source: "plantilla" }
}
