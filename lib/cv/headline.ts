import type { CV } from "@/lib/schemas/cv"

/**
 * El titular de un CV suele ser una sola línea con barras: «Semi Senior Product Designer | Estrategia de Producto | Design Systems | UX Research | Figma».
 * La primera parte es el TÍTULO profesional (`header.headline`) y el resto son los TITULARES complementarios (`header.taglines`), como los separa LinkedIn.
 * Solo se parte por «|», «•» y «·» (separadores de lista); la barra «/» NO se parte («UX/UI Designer» es un solo título). No se cambia ni una palabra:
 * lo único que se hace es repartir el texto original.
 */
const SEPARATORS = /\s*[|•·]\s*/
const MAX_PART = 80

export function splitHeadline(raw: string | undefined): { headline?: string; taglines: string[] } {
  const text = raw?.replace(/\s+/g, " ").trim()
  if (!text) return { headline: undefined, taglines: [] }
  const parts = text.split(SEPARATORS).map((p) => p.trim()).filter(Boolean)
  // Un solo trozo, o trozos demasiado largos para ser frases cortas: no es una lista de titulares, se deja entero.
  if (parts.length < 2 || parts.some((p) => p.length > MAX_PART)) return { headline: text, taglines: [] }
  return { headline: parts[0], taglines: parts.slice(1, 9) }
}

/** El titular completo tal como se escribió («título | titular | titular»), para los documentos y la búsqueda de palabras clave: no se pierde nada al separarlos. */
export const fullHeadline = (h: Pick<CV["header"], "headline" | "taglines">): string => [h.headline?.trim(), ...(h.taglines ?? []).map((t) => t.trim())].filter(Boolean).join(" | ")

/** CV guardado antes de existir los titulares: si el titular trae barras y no hay titulares, se reparte. Si ya hay titulares, no se toca nada. */
export function normalizeHeadline(cv: CV): CV {
  if ((cv.header.taglines ?? []).length > 0) return cv
  const { headline, taglines } = splitHeadline(cv.header.headline)
  if (taglines.length === 0) return cv.header.taglines ? cv : { ...cv, header: { ...cv.header, taglines: [] } }
  return { ...cv, header: { ...cv.header, headline, taglines } }
}
