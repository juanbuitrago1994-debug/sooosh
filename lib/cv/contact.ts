/** Datos de contacto por expresiones regulares (sin IA). */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PHONE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d[\d\s.-]{6,}\d/g
const URL_RE = /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/(?:in|company)\/[\w%-]+|github\.com\/[\w.-]+|gitlab\.com\/[\w.-]+|behance\.net\/[\w.-]+|dribbble\.com\/[\w.-]+|(?<![\w@.-])[\w-]+\.(?:dev|io|me|tech|com|net|org)(?![\w@-])(?:\/[\w./%-]*)?)/gi

const LABELS: [RegExp, string][] = [
  [/linkedin\./i, "LinkedIn"],
  [/github\./i, "GitHub"],
  [/gitlab\./i, "GitLab"],
  [/behance\./i, "Behance"],
  [/dribbble\./i, "Dribbble"],
]

export type Contact = { email?: string; phone?: string; links: { label: string; url: string }[] }

/** Teléfono con etiqueta («Teléfono +57 319…»): más fiable que un número suelto, sobre todo con ruido de OCR. */
const LABELED_PHONE = /\b(?:tel[eé]fono|tel\.?|celular|cel\.?|m[oó]vil|whatsapp|phone|mobile)\s*[:.]?\s*(\+?\d[\d\s().-]{6,}\d)/i
const KNOWN_LINK = /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/(?:in|company)\/[\w%-]+|github\.com\/[\w.-]+|gitlab\.com\/[\w.-]+|behance\.net\/[\w.-]+|dribbble\.com\/[\w.-]+)/gi

/**
 * `text` = encabezado y primeras líneas (donde se espera el contacto). `whole` = el CV completo: si el diseño
 * pone el contacto al final («Contacto», pie de página), se busca ahí.
 */
export function extractContact(text: string, whole: string = text): Contact {
  const email = text.match(EMAIL)?.[0] ?? whole.match(EMAIL)?.[0]
  const noEmail = email ? text.split(email).join(" ") : text
  let phone: string | undefined
  // Un dígito suelto al final suele ser un ícono leído por el OCR («+57 300 123 4567 7»): se descarta si ya hay ≥ 10 dígitos.
  let labeled = LABELED_PHONE.exec(whole)?.[1]?.trim()
  if (labeled && /\s\d$/.test(labeled) && labeled.replace(/\D/g, "").length - 1 >= 10) labeled = labeled.slice(0, -2).trim()
  const labeledDigits = labeled?.replace(/\D/g, "").length ?? 0
  if (labeled && labeledDigits >= 8 && labeledDigits <= 15) phone = labeled
  for (const m of phone ? [] : noEmail.matchAll(PHONE)) {
    const digits = m[0].replace(/\D/g, "")
    // 8–15 dígitos y que no parezca un rango de años ("2019 - 2021")
    if (digits.length >= 8 && digits.length <= 15 && !/^(19|20)\d{2}[\s.-]+(19|20)\d{2}$/.test(m[0].trim())) {
      phone = m[0].trim()
      break
    }
  }
  const links: Contact["links"] = []
  for (const m of noEmail.matchAll(URL_RE)) {
    const raw = m[0].replace(/[).,;]+$/, "")
    if (email && raw.includes(email.split("@")[1])) continue
    if (/^\d/.test(raw) || links.some((l) => l.url === raw)) continue
    const label = LABELS.find(([re]) => re.test(raw))?.[1] ?? "Sitio web"
    links.push({ label, url: raw })
  }
  for (const m of whole.matchAll(KNOWN_LINK)) {
    const raw = m[0].replace(/[).,;]+$/, "")
    if (!links.some((l) => l.url.toLowerCase() === raw.toLowerCase())) links.push({ label: LABELS.find(([re]) => re.test(raw))?.[1] ?? "Sitio web", url: raw })
  }
  return { email, phone, links: links.slice(0, 5) }
}
