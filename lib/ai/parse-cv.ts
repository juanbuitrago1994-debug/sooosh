import { cvSchema, type CV } from "@/lib/schemas/cv"
import { getProvider } from "./index"

/** Con num_ctx 8192 hay que dejar sitio a la respuesta (~3k tokens). ≈ 3,5 caracteres por token. */
export const MAX_INPUT_CHARS = 12_000

export const SYSTEM_PROMPT = `Eres un extractor de datos de currículums. Recibes el texto de un CV y devuelves un JSON con la estructura pedida.

REGLA DE ORO: extrae SOLO lo que está escrito en el texto.
- Si un dato no aparece, omite el campo (o deja la lista vacía). No lo adivines.
- NUNCA inventes fechas, empresas, cargos, cifras, métricas, títulos ni herramientas.
- No mejores, resumas ni reescribas: copia las frases tal como están. No traduzcas; conserva el idioma original.
- Cada logro o responsabilidad de un puesto es un elemento de "bullets", en el orden original.
- No agregues prefijos ni formato que no estén en el texto (mailto:, tel:, https://).
- Las fechas van tal como aparecen (p. ej. "Mar 2021", "2019", "Actual").
- "skills": agrupa por categoría solo si el CV las agrupa; si no, un único grupo sin categoría.
- "summary": solo si el CV tiene un perfil/resumen explícito.
- header: "fullName" es el nombre; "headline" el título profesional que aparece bajo el nombre; "email", "phone" y "location" van en sus propios campos. "links" es SOLO para URLs (LinkedIn, GitHub, portafolio), nunca para email, teléfono ni ciudad.
- experience: "startDate" y "endDate" separados. Si el rango termina en "Actual", "Presente", "Present" o similar, endDate es esa misma palabra.
- education: "institution", "degree" (título o carrera) y "field" solo si están escritos; las fechas en startDate/endDate. "details" solo para notas extra del texto.
- Ignora números de página, encabezados repetidos y texto basura de la extracción.
Responde únicamente con el JSON.`

export async function parseCvText(text: string, signal?: AbortSignal) {
  const truncated = text.length > MAX_INPUT_CHARS
  const input = truncated ? text.slice(0, MAX_INPUT_CHARS) : text
  const result = await getProvider().generateStructured<CV>({
    system: SYSTEM_PROMPT,
    user: `Texto del CV:\n"""\n${input}\n"""`,
    schema: cvSchema,
    signal,
  })
  return { ...result, truncated }
}
