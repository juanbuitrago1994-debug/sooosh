import { fold } from "@/lib/keywords/normalize"
import { styleIssues } from "@/lib/apply/guidelines"
import type { Lang } from "@/lib/apply/body-settings"

/**
 * Revisión final del correo antes de copiarlo (paso «Listo»): comprobaciones por reglas, sin IA. Cada una sale de
 * `docs/CONOCIMIENTO-UX-CONTENT.md` (códigos `R-…`). Son avisos, no bloqueos: la persona decide.
 */
export type ReviewCheck = { id: string; ok: boolean; label: string; hint: string }
export type ReviewInput = { recipients: number; subject: string; /** el asunto lo pide la oferta: no se juzga su largo ni su orden */ subjectFromOffer: boolean; jobTitle: string; body: string; lang: Lang }

export const MAX_BODY_WORDS = 200
export const MAX_SUBJECT = 60
export const SUBJECT_VISIBLE = 40

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const significant = (title: string) => fold(title).split(/[^a-z0-9]+/).filter((w) => w.length >= 4)

const ISSUE_TEXT: Record<string, string> = {
  exclamación: "exclamaciones",
  emoji: "emojis",
  "apertura de relleno": "una apertura de relleno («Mi nombre es…», «Le escribo para…»)",
  "frase de relleno": "frases de relleno («excelente oportunidad»…)",
  "gerundio de posterioridad": "gerundios que encadenan acciones",
  "frase larga": "una frase de más de 35 palabras",
}

export function reviewEmail({ recipients, subject, subjectFromOffer, jobTitle, body, lang }: ReviewInput): ReviewCheck[] {
  const out: ReviewCheck[] = []
  const n = words(body)
  out.push({ id: "destinatario", ok: recipients > 0, label: "Tienes al menos un destinatario", hint: "Vuelve al paso 1 y elige a quién escribirle." })
  out.push({ id: "asunto-vacio", ok: subject.trim().length > 0, label: "El asunto no está vacío", hint: "Un correo sin asunto suele ir a la bandeja de no deseados." })
  if (!subjectFromOffer && subject.trim()) {
    out.push({ id: "asunto-largo", ok: subject.trim().length <= MAX_SUBJECT, label: `El asunto es corto (${subject.trim().length} de ${MAX_SUBJECT} caracteres)`, hint: "Los programas de correo lo cortan: acórtalo." })
    const titleWords = significant(jobTitle)
    const head = fold(subject.slice(0, SUBJECT_VISIBLE))
    out.push({ id: "asunto-cargo", ok: titleWords.length === 0 || titleWords.some((w) => head.includes(w)), label: "El cargo se ve al inicio del asunto", hint: `Quien lee ve solo los primeros ${SUBJECT_VISIBLE} caracteres: pon ahí «Postulación» y el cargo, y tu nombre al final.` })
  }
  out.push({ id: "largo", ok: n <= MAX_BODY_WORDS, label: `El cuerpo es breve (${n} de ${MAX_BODY_WORDS} palabras)`, hint: "Quien selecciona lee poco: deja lo esencial en los primeros párrafos." })
  out.push({ id: "marcadores", ok: !/\[[^\]\n]{1,60}\]|\{\{|\bXXX+\b|\.\.\.\s*$/m.test(body), label: "No quedan marcadores sin completar", hint: "Busca corchetes o «XXX» en el cuerpo y reemplázalos." })
  out.push({ id: "adjunto", ok: lang === "en" ? /attach/i.test(body) : /adjunt/i.test(body), label: "El texto menciona tu CV adjunto", hint: "Si adjuntas tu CV, dilo en una frase; si no lo mencionas, puede pasar desapercibido." })
  const issues = styleIssues(body, lang)
  out.push({ id: "estilo", ok: issues.length === 0, label: "Sin exclamaciones, relleno ni frases largas", hint: issues.length ? `Se detectó: ${issues.map((i) => ISSUE_TEXT[i] ?? i).join(", ")}.` : "" })
  return out
}
