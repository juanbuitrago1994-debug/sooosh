import type { CV } from "@/lib/schemas/cv"

/**
 * «Llenar con tu CV»: completa lo que está VACÍO del perfil con lo leído de un CV, sin pisar nada de lo que la persona ya escribió.
 * Cada campo de texto solo se llena si está vacío; cada lista (experiencia, educación…) solo se llena si está vacía; los enlaces se suman si su URL no estaba.
 */
const blank = (s?: string) => !s?.trim()

export function mergeCv(current: CV, incoming: CV): CV {
  const h = current.header
  const ih = incoming.header
  const fill = <K extends keyof Pick<CV["header"], "headline" | "email" | "phone" | "location">>(k: K) => (blank(h[k]) ? ih[k] : h[k])
  const urls = new Set(h.links.map((l) => l.url.trim().toLowerCase()))
  const links = [...h.links, ...ih.links.filter((l) => l.url.trim() && !urls.has(l.url.trim().toLowerCase()))]
  const list = <K extends "experience" | "education" | "skills" | "languages" | "projects" | "certifications" | "volunteering" | "awards" | "publications">(k: K): CV[K] => (current[k].length ? current[k] : incoming[k])
  return {
    ...current,
    header: {
      // «Sin nombre» es el marcador que deja la lectura cuando no encontró el nombre: no cuenta como un nombre escrito.
      fullName: blank(h.fullName) || h.fullName === "Sin nombre" ? ih.fullName : h.fullName,
      headline: fill("headline"),
      email: fill("email"),
      phone: fill("phone"),
      location: fill("location"),
      links,
    },
    summary: blank(current.summary) ? incoming.summary : current.summary,
    experience: list("experience"),
    education: list("education"),
    skills: list("skills"),
    languages: list("languages"),
    projects: list("projects"),
    certifications: list("certifications"),
    volunteering: list("volunteering"),
    awards: list("awards"),
    publications: list("publications"),
  }
}

/** Qué secciones traerían datos nuevos (para avisar «Completamos N secciones»). */
export function filledSections(before: CV, after: CV): string[] {
  const out: string[] = []
  if (before.header !== after.header && JSON.stringify(before.header) !== JSON.stringify(after.header)) out.push("datos personales")
  if (blank(before.summary) && !blank(after.summary)) out.push("resumen")
  const names = { experience: "experiencia", education: "educación", skills: "habilidades", languages: "idiomas", projects: "proyectos", certifications: "certificaciones", volunteering: "voluntariado", awards: "premios", publications: "publicaciones" } as const
  for (const k of Object.keys(names) as (keyof typeof names)[]) if (!before[k].length && after[k].length) out.push(names[k])
  return out
}

export const emptyCv = (): CV => ({ header: { fullName: "", links: [] }, experience: [], education: [], skills: [], languages: [], projects: [], certifications: [], volunteering: [], awards: [], publications: [] })
