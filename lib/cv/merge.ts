import type { CV } from "@/lib/schemas/cv"

/**
 * «Llenar con tu CV»: completa lo que está VACÍO del perfil con lo leído de un CV, sin pisar nada de lo que la persona ya escribió.
 * Tolera CV sin las listas nuevas (un resultado viejo o de otra lectura). Cada campo de texto solo se llena si está vacío; cada lista (experiencia, educación…) solo se llena si está vacía; los enlaces se suman si su URL no estaba.
 */
const blank = (s?: string) => !s?.trim()

export function mergeCv(current: CV, incoming: CV): CV {
  const h = { ...current.header, links: current.header.links ?? [] }
  const ih = { ...incoming.header, links: incoming.header.links ?? [] }
  const fill = <K extends keyof Pick<CV["header"], "headline" | "email" | "phone" | "location">>(k: K) => (blank(h[k]) ? ih[k] : h[k])
  const urls = new Set(h.links.map((l) => l.url.trim().toLowerCase()))
  const links = [...h.links, ...ih.links.filter((l) => l.url.trim() && !urls.has(l.url.trim().toLowerCase()))]
  const list = <K extends "experience" | "education" | "skills" | "languages" | "projects" | "certifications" | "volunteering" | "awards" | "publications">(k: K): CV[K] => ((current[k] ?? []).length ? current[k] : (incoming[k] ?? []))
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
      // Los titulares complementarios se llenan solo si no hay ninguno escrito.
      taglines: (h.taglines ?? []).length ? h.taglines : (ih.taglines ?? []),
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
  for (const k of Object.keys(names) as (keyof typeof names)[]) if (!(before[k] ?? []).length && (after[k] ?? []).length) out.push(names[k])
  return out
}

export const emptyCv = (): CV => ({ header: { fullName: "", links: [], taglines: [] }, experience: [], education: [], skills: [], languages: [], projects: [], certifications: [], volunteering: [], awards: [], publications: [] })

/**
 * Qué pasaría si se completa el perfil con un CV leído, para mostrarlo ANTES de aplicar: `fills` = lo vacío que se llenaría; `keeps` = lo que la persona
 * ya tiene y es distinto de lo que trae el archivo (se conserva tal cual: nunca se borra ni se reemplaza).
 */
export function describeFill(base: CV, source: CV): { fills: string[]; keeps: string[] } {
  const fills: string[] = []
  const keeps: string[] = []
  const same = (a?: string, b?: string) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase()
  const text = (label: string, mine?: string, theirs?: string) => {
    if (blank(theirs)) return
    if (blank(mine) || mine === "Sin nombre") fills.push(label)
    else if (!same(mine, theirs)) keeps.push(`${label}: conservas «${mine!.trim().slice(0, 60)}»`)
  }
  const bh = base.header
  const sh = source.header
  text("Nombre", bh.fullName, sh.fullName)
  text("Título profesional", bh.headline, sh.headline)
  text("Correo", bh.email, sh.email)
  text("Teléfono", bh.phone, sh.phone)
  text("Ubicación", bh.location, sh.location)
  if (!(bh.taglines ?? []).length && (sh.taglines ?? []).length) fills.push(`Titulares (${sh.taglines.length})`)
  const urls = new Set((bh.links ?? []).map((l) => l.url.trim().toLowerCase()))
  const newLinks = (sh.links ?? []).filter((l) => l.url.trim() && !urls.has(l.url.trim().toLowerCase())).length
  if (newLinks > 0) fills.push(`Enlaces (+${newLinks})`)
  text("Resumen profesional", base.summary, source.summary)
  const lists = {
    experience: "Experiencia",
    education: "Educación",
    skills: "Habilidades",
    languages: "Idiomas",
    projects: "Proyectos",
    certifications: "Certificaciones",
    volunteering: "Voluntariado",
    awards: "Premios",
    publications: "Publicaciones",
  } as const
  for (const k of Object.keys(lists) as (keyof typeof lists)[]) {
    const mine = base[k] ?? []
    const theirs = source[k] ?? []
    if (!theirs.length) continue
    if (!mine.length) fills.push(`${lists[k]} (${theirs.length})`)
    else if (JSON.stringify(mine) !== JSON.stringify(theirs)) keeps.push(`${lists[k]}: conservas tus ${mine.length}; el archivo trae ${theirs.length}`)
  }
  return { fills, keeps }
}
