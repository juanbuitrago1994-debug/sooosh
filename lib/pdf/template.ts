import { SECTION_KEYS, type CV } from "@/lib/schemas/cv"

/**
 * Plantilla del CV en HTML para el PDF (y para la vista previa).
 * Pensada para ATS: una sola columna, texto real seleccionable (sin imágenes ni tablas),
 * encabezados estándar y orden cronológico inverso tal como lo escribió el usuario.
 * No añade texto propio salvo los títulos de sección.
 * Nota: este CSS es del documento impreso, no de la interfaz de la app.
 */
export type PdfLang = "es" | "en"

export const HEADINGS: Record<PdfLang, Record<"summary" | "experience" | "education" | "skills" | "languages" | "projects", string>> = {
  es: { summary: "Resumen", experience: "Experiencia", education: "Educación", skills: "Habilidades", languages: "Idiomas", projects: "Proyectos" },
  en: { summary: "Summary", experience: "Experience", education: "Education", skills: "Skills", languages: "Languages", projects: "Projects" },
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const clean = (xs: (string | undefined)[]) => xs.map((x) => x?.trim()).filter((x): x is string => !!x)
const range = (a?: string, b?: string) => clean([a, b]).join(" – ")

const CSS = `
@page { size: A4; margin: 16mm 16mm 16mm 16mm; }
* { box-sizing: border-box; }
html { color: #111; background: #fff; }
body { margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 1.4; }
main { max-width: 178mm; margin: 0 auto; }
h1 { font-size: 20pt; line-height: 1.15; margin: 0; }
.headline { font-size: 11.5pt; margin: 2pt 0 0; }
.contact { margin: 4pt 0 0; font-size: 9.5pt; color: #333; overflow-wrap: anywhere; }
h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.04em; margin: 14pt 0 6pt; padding-bottom: 2pt; border-bottom: 1px solid #333; break-after: avoid; }
section, article { break-inside: auto; }
.entry { margin: 0 0 8pt; break-inside: avoid; }
.row { display: flex; justify-content: space-between; gap: 12pt; }
.title { font-weight: 700; }
.meta { color: #333; white-space: nowrap; }
.sub { margin: 0; color: #222; }
ul { margin: 3pt 0 0; padding-left: 14pt; }
li { margin: 0 0 2pt; }
p { margin: 0; }
@media screen { body { padding: 16px; } }
`

function entry(title: string, meta: string, sub: string, bullets: string[], extra = ""): string {
  return `<article class="entry"><div class="row"><span class="title">${esc(title)}</span>${meta ? `<span class="meta">${esc(meta)}</span>` : ""}</div>${
    sub ? `<p class="sub">${esc(sub)}</p>` : ""
  }${extra}${bullets.length ? `<ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}</article>`
}


export function renderCvHtml(cv: CV, lang: PdfLang = "es"): string {
  const h = HEADINGS[lang]
  const bodies = new Map<string, string>()
  const section = (key: string, title: string, body: string) => body && bodies.set(key, `<section><h2>${esc(title)}</h2>${body}</section>`)

  const contact = clean([cv.header.email, cv.header.phone, cv.header.location, ...cv.header.links.map((l) => clean([l.label, l.url]).join(": "))])
  const head = `<header><h1>${esc(cv.header.fullName)}</h1>${cv.header.headline ? `<p class="headline">${esc(cv.header.headline)}</p>` : ""}${
    contact.length ? `<p class="contact">${contact.map(esc).join(" · ")}</p>` : ""
  }</header>`

  section("summary", h.summary, cv.summary?.trim() ? `<p>${esc(cv.summary.trim())}</p>` : "")
  section("experience", h.experience, cv.experience.map((e) => entry(e.role, range(e.startDate, e.endDate), clean([e.company, e.location]).join(", "), clean(e.bullets))).join(""))
  section(
    "education",
    h.education,
    cv.education.map((e) => entry(clean([e.degree, e.field]).join(", ") || e.institution, range(e.startDate, e.endDate), e.degree || e.field ? e.institution : "", clean(e.details))).join(""),
  )
  section(
    "skills",
    h.skills,
    cv.skills.map((g) => `<p>${g.category?.trim() ? `<span class="title">${esc(g.category.trim())}:</span> ` : ""}${esc(clean(g.items).join(", "))}</p>`).join(""),
  )
  section("languages", h.languages, cv.languages.length ? `<p>${esc(cv.languages.map((l) => clean([l.name, l.level && `(${l.level.trim()})`]).join(" ")).join(", "))}</p>` : "")
  section(
    "projects",
    h.projects,
    cv.projects
      .map((p) =>
        entry(p.name, "", clean([p.url]).join(""), clean(p.bullets), `${p.description?.trim() ? `<p>${esc(p.description.trim())}</p>` : ""}${p.technologies.length ? `<p class="sub">${esc(clean(p.technologies).join(", "))}</p>` : ""}`),
      )
      .join(""),
  )

  // Orden de secciones: el elegido por la persona (cv.sectionOrder) y, para lo que falte, el orden estándar.
  const parts = [...new Set([...(cv.sectionOrder ?? []), ...SECTION_KEYS])].map((k) => bodies.get(k) ?? "").filter(Boolean)

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(cv.header.fullName)}</title><style>${CSS}</style></head><body><main>${head}${parts.join("")}</main></body></html>`
}
