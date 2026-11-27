import { HEADINGS, type PdfLang } from "@/lib/pdf/template"
import { SECTION_KEYS, type CV } from "@/lib/schemas/cv"

/**
 * Modelo común de exportación (Fase K7): el CV final convertido en bloques simples, en el orden elegido por la persona
 * (`CV.sectionOrder`). TXT, Markdown y Word salen de aquí, así los tres dicen exactamente lo mismo; el PDF usa la plantilla HTML
 * (`lib/pdf/template.ts`), que respeta el mismo orden. No añade texto propio salvo los títulos de sección.
 */
export type Block = { kind: "entry"; title: string; meta: string; sub: string; bullets: string[] } | { kind: "para"; text: string }
export type DocSection = { key: (typeof SECTION_KEYS)[number]; title: string; blocks: Block[] }
export type DocModel = { name: string; headline: string; contact: string[]; sections: DocSection[] }

const clean = (xs: (string | undefined)[]) => xs.map((x) => x?.trim()).filter((x): x is string => !!x)
const range = (a?: string, b?: string) => clean([a, b]).join(" – ")

export function toDocModel(cv: CV, lang: PdfLang = "es"): DocModel {
  const h = HEADINGS[lang]
  const bodies: Record<DocSection["key"], Block[]> = {
    summary: cv.summary?.trim() ? [{ kind: "para", text: cv.summary.trim() }] : [],
    experience: cv.experience.map((e) => ({ kind: "entry" as const, title: e.role, meta: range(e.startDate, e.endDate), sub: clean([e.company, e.location]).join(", "), bullets: clean(e.bullets) })),
    education: cv.education.map((e) => ({ kind: "entry" as const, title: clean([e.degree, e.field]).join(", ") || e.institution, meta: range(e.startDate, e.endDate), sub: e.degree || e.field ? e.institution : "", bullets: clean(e.details) })),
    skills: cv.skills.map((g) => ({ kind: "para" as const, text: `${g.category?.trim() ? `${g.category.trim()}: ` : ""}${clean(g.items).join(", ")}` })).filter((b) => b.text.trim()),
    languages: cv.languages.length ? [{ kind: "para", text: cv.languages.map((l) => clean([l.name, l.level && `(${l.level.trim()})`]).join(" ")).join(", ") }] : [],
    projects: cv.projects.map((p) => ({ kind: "entry" as const, title: p.name, meta: "", sub: clean([p.url, p.description, p.technologies.length ? clean(p.technologies).join(", ") : undefined]).join(" · "), bullets: clean(p.bullets) })),
    certifications: cv.certifications.map((c) => ({ kind: "entry" as const, title: c.name, meta: c.date?.trim() ?? "", sub: clean([c.issuer, c.url]).join(" · "), bullets: [] })),
    volunteering: cv.volunteering.map((v) => ({ kind: "entry" as const, title: v.role?.trim() || v.organization, meta: range(v.startDate, v.endDate), sub: v.role?.trim() ? v.organization : "", bullets: clean(v.bullets) })),
    awards: cv.awards.map((a) => ({ kind: "entry" as const, title: a.name, meta: a.date?.trim() ?? "", sub: clean([a.issuer, a.description]).join(" · "), bullets: [] })),
    publications: cv.publications.map((p) => ({ kind: "entry" as const, title: p.title, meta: p.date?.trim() ?? "", sub: clean([p.publisher, p.url]).join(" · "), bullets: [] })),
  }
  const order = [...new Set([...(cv.sectionOrder ?? []), ...SECTION_KEYS])]
  return {
    name: cv.header.fullName.trim(),
    headline: cv.header.headline?.trim() ?? "",
    contact: clean([cv.header.email, cv.header.phone, cv.header.location, ...cv.header.links.map((l) => clean([l.label, l.url]).join(": "))]),
    sections: order.map((key) => ({ key, title: h[key], blocks: bodies[key] })).filter((s) => s.blocks.length),
  }
}
