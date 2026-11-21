/**
 * Correos de postulación dentro del texto de una oferta, SIN IA. Devuelve hasta `MAX_EMAILS`, el más probable primero.
 * Cubre lo que antes se perdía: correos sin verbo («CV a: x@y.com»), correos antes del verbo, correos ofuscados
 * («x [at] y.com», «x arroba y punto com») y más de un correo por oferta. Un correo es «fuerte» si hay un verbo de
 * postulación justo antes (la señal que ya usaba `detectApply` para elegirlo como vía principal).
 */
export type DetectedEmail = { email: string; /** verbo de postulación justo antes del correo */ strong: boolean; score: number }

export const MAX_EMAILS = 3

const VERBS =
  /(?:env[ií]a(?:r|nos|lo|la)?|mand(?:a|ar|anos)|remite|remitir|postula(?:te|r)?|aplica(?:r)?|escr[ií]be(?:nos)?|e-?mail(?: us)?|cont[aá]ctanos|send (?:us )?(?:your )?(?:cv|resume|application)|apply (?:by|via|at|to)|(?:cv|curr[ií]culum|curriculum|hoja de vida|resume|portafolio|portfolio)(?: vitae)?\s*(?:a|al|to|:|en)\b)/i
const APPLY_WORDS = /(?:cv|curr[ií]cul|curricul|hoja de vida|postula|aplica|candidat|interesad|vacante|resume|apply|application)/i
const LOCAL_HINTS = /(?:^|[._-])(?:cv|cvs|rrhh|rh|hr|talento|talent|seleccion|selecci[oó]n|candidatos|empleo|empleos|jobs|careers|carreras|recruit\w*|reclutamiento|people|trabaja|trabajo|postulaciones|vacantes|personas)(?:$|[._-])/i
const GENERIC_LOCAL = /^(?:info|contacto|contact|hola|hello|ventas|sales|soporte|support|admin|administracion|comercial|marketing|prensa|press)$/i
const DISCARD_LOCAL = /^(?:no-?reply|noreply|do-?not-?reply|mailer-daemon|postmaster|abuse|privacy|privacidad|legal|webmaster)$/i
const DISCARD_DOMAIN = /(?:^|\.)(?:example\.(?:com|org)|sentry\.io|linkedin\.com|licdn\.com)$/i
const IMAGE_TLD = /^(?:png|jpe?g|gif|svg|webp|ico|css|js)$/i

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g

/** «x [at] y [dot] com», «x (arroba) y punto com» → «x@y.com». Solo toca patrones inequívocos. */
export function deobfuscate(text: string): string {
  return text
    .replace(/\s*[[(]\s*(?:at|arroba)\s*[\])]\s*/gi, "@")
    .replace(/(\S)\s+arroba\s+(?=[A-Za-z0-9])/gi, "$1@")
    .replace(/\s*[[(]\s*(?:dot|punto)\s*[\])]\s*/gi, ".")
    .replace(/(@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*)\s+punto\s+(?=[A-Za-z]{2,})/gi, "$1.")
}

/** Trozo de texto entre el verbo y el correo: hasta 90 caracteres hacia atrás, sin cruzar un punto, salto de línea u otro correo. */
function beforeOf(text: string, index: number): string {
  const slice = text.slice(Math.max(0, index - 90), index)
  const cut = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("\n"), slice.lastIndexOf("@"))
  return cut >= 0 ? slice.slice(cut + 1) : slice
}

export function detectEmails(input?: string | null): DetectedEmail[] {
  if (!input) return []
  const text = deobfuscate(input)
  const found = new Map<string, DetectedEmail>()
  for (const m of text.matchAll(EMAIL)) {
    const email = m[0].replace(/[.]+$/, "").toLowerCase()
    const [local, domain] = email.split("@")
    const tld = domain.split(".").pop() ?? ""
    if (IMAGE_TLD.test(tld) || DISCARD_LOCAL.test(local) || DISCARD_DOMAIN.test(domain)) continue
    const before = beforeOf(text, m.index ?? 0)
    const around = text.slice(Math.max(0, (m.index ?? 0) - 120), (m.index ?? 0) + email.length + 60)
    const strong = VERBS.test(before)
    let score = 0
    if (strong) score += 3
    if (APPLY_WORDS.test(around)) score += 1
    if (LOCAL_HINTS.test(local)) score += 2
    if (GENERIC_LOCAL.test(local)) score -= 1
    const prev = found.get(email)
    if (!prev || score > prev.score) found.set(email, { email, strong: strong || !!prev?.strong, score })
  }
  const all = [...found.values()]
  // Un único correo en toda la oferta se acepta aunque no tenga pistas; con varios, se exige alguna señal (≥ 1).
  const kept = all.length === 1 ? all : all.filter((e) => e.score >= 1)
  return kept.sort((a, b) => b.score - a.score).slice(0, MAX_EMAILS)
}
