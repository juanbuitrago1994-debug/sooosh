/**
 * Encabezados estándar del CV ATS por idioma (docs/CONOCIMIENTO-ATS.md §4). Una sola fuente: la usan el generador y, en A3, el verificador.
 */
export type AtsLang = "es" | "en"
export type AtsSectionKey = "summary" | "experience" | "education" | "certifications" | "skills" | "languages" | "projects" | "volunteering" | "awards" | "publications"

/** Orden fijo de la plantilla (regla ATS-S5). */
export const ATS_ORDER: readonly AtsSectionKey[] = ["summary", "experience", "education", "certifications", "skills", "languages", "projects", "volunteering", "awards", "publications"]

export const ATS_HEADINGS: Record<AtsLang, Record<AtsSectionKey, string>> = {
  es: { summary: "Resumen profesional", experience: "Experiencia laboral", education: "Educación", certifications: "Certificaciones", skills: "Habilidades", languages: "Idiomas", projects: "Proyectos", volunteering: "Voluntariado", awards: "Premios y reconocimientos", publications: "Publicaciones" },
  en: { summary: "Professional Summary", experience: "Work Experience", education: "Education", certifications: "Certifications", skills: "Skills", languages: "Languages", projects: "Projects", volunteering: "Volunteering", awards: "Honors and Awards", publications: "Publications" },
}

/** Textos fijos del documento que no vienen del CV (no son datos de la persona). */
export const ATS_LABELS: Record<AtsLang, { present: string; technologies: string }> = {
  es: { present: "Presente", technologies: "Tecnologías" },
  en: { present: "Present", technologies: "Technologies" },
}
