import { ACCEPT, ACCEPT_LABEL, formatBytes, getExtension, isAllowedExtension, MAX_UPLOAD_BYTES } from "@/lib/uploads"

/**
 * Elegir el CV desde el selector o soltándolo sobre el panel: valida lo que llegó y devuelve un mensaje claro en español (qué pasó y qué
 * hacer) en vez de fallar callado. Es una función pura para poder probarla sin navegador.
 */
export type PickedCv = { file: File; error?: undefined } | { file?: undefined; error: string }

export function pickCvFile(files: ArrayLike<File> | null | undefined): PickedCv {
  const list = files ? Array.from(files) : []
  if (list.length === 0) return { error: "No llegó ningún archivo. Suelta tu CV como archivo (no como texto ni como enlace)." }
  if (list.length > 1) return { error: "Suelta un solo archivo: tu CV. Si tienes varias versiones, sube la que quieras usar." }
  const file = list[0]
  const ext = getExtension(file.name)
  if (file.size === 0) return { error: `«${file.name}» está vacío. Revisa que sea el CV correcto y vuelve a intentarlo.` }
  if (!ext) return { error: "Eso no parece un archivo de CV (¿soltaste una carpeta?). Sube un PDF, un Word o una imagen." }
  if (!isAllowedExtension(ext)) return { error: `No podemos leer archivos .${ext}. Sube tu CV en PDF, Word, ODT, RTF, TXT, MD o imagen (${ACCEPT_LABEL}).` }
  if (file.size > MAX_UPLOAD_BYTES) return { error: `«${file.name}» pesa ${formatBytes(file.size)} y el máximo es ${formatBytes(MAX_UPLOAD_BYTES)}. Expórtalo de nuevo como PDF más liviano.` }
  return { file }
}

/** ¿Lo que se arrastra trae archivos? (arrastrar texto o un enlace no debe activar la zona de soltar). */
export const dragHasFiles = (types: ArrayLike<string> | undefined): boolean => !!types && Array.from(types).includes("Files")

/** Mensajes de la lectura del CV (red, IA local, archivo ilegible) reescritos para que digan qué hacer. */
export function friendlyReadError(message: string): string {
  const m = message.trim()
  if (/ollama|not_configured|unreachable|timeout|ia local|modelo/i.test(m)) return "No pudimos leer tu CV porque la IA local no responde. Revisa que Ollama esté corriendo e inténtalo de nuevo."
  if (/fetch|network|failed to|conectar|servidor/i.test(m)) return "No se pudo conectar con la app. Revisa que siga corriendo e inténtalo de nuevo."
  if (/cancelad/i.test(m)) return "Se canceló la lectura de tu CV."
  if (/escane|sin texto|ocr|no se pudo extraer|vac[ií]o/i.test(m)) return `${m.replace(/\.$/, "")}. Prueba con otra copia (por ejemplo, exportada a PDF desde Word o Google Docs).`
  return m || "No pudimos leer tu CV. Prueba con otro archivo."
}

/**
 * Lo que el navegador deja ver MIENTRAS se arrastra (antes de soltar): cuántos archivos son y su tipo (MIME). Nunca el nombre ni el peso: son datos
 * protegidos hasta el `drop`. En algunos formatos (`.md`, `.heic`, a veces `.docx`) el tipo llega vacío: entonces no se afirma nada.
 */
export type DragInfo = { count: number; /** «PDF», «Word», «Imagen»… si el tipo llegó y es de los que leemos */ label?: string; /** el tipo llegó y NO es de los que leemos */ unsupported: boolean }

const MIME_LABEL: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/msword": "Word",
  "application/vnd.oasis.opendocument.text": "ODT",
  "application/rtf": "RTF",
  "text/rtf": "RTF",
  "text/plain": "Texto",
  "text/markdown": "Markdown",
  "image/jpeg": "Imagen",
  "image/png": "Imagen",
  "image/heic": "Imagen",
  "image/heif": "Imagen",
}
export const mimeLabel = (mime: string): string | undefined => MIME_LABEL[mime.toLowerCase()]
const accepted = (mime: string) => mime.toLowerCase() in ACCEPT || mime.toLowerCase() === "image/heif"

export function describeDrag(items: ArrayLike<{ kind: string; type: string }> | null | undefined): DragInfo | null {
  const files = items ? Array.from(items).filter((i) => i.kind === "file") : []
  if (!files.length) return null
  if (files.length > 1) return { count: files.length, unsupported: false }
  const type = files[0].type.trim()
  if (!type) return { count: 1, unsupported: false }
  return accepted(type) ? { count: 1, label: mimeLabel(type), unsupported: false } : { count: 1, unsupported: true }
}

/** Texto del aviso de soltar según lo que se ve en el arrastre. */
export function dropCopy(info: DragInfo | null): { title: string; description: string } {
  if (!info) return { title: "Suelta tu CV aquí", description: "Un solo archivo" }
  if (info.count > 1) return { title: "Suelta un solo archivo", description: `Traes ${info.count} archivos` }
  if (info.unsupported) return { title: "Ese formato no lo leemos", description: "Prueba con PDF, Word o una imagen" }
  return { title: "Suelta tu CV aquí", description: info.label ? `${info.label} · un solo archivo` : "Un solo archivo" }
}

/**
 * Textos de la PANTALLA INICIAL al arrastrar (más explicativos y cercanos que los del panel «Mi CV», que sigue con `dropCopy`). Dicen qué va a pasar con el archivo
 * y, si algo no sirve (varios archivos, un formato que no leemos), qué hacer. La página no es clicable (solo se arrastra, o se pulsa el botón del ícono): los textos no prometen «haz clic». Cada título cabe en UNA línea (≤ 38 caracteres) y cada descripción en DOS (≤ 95).
 */
export function entryDropCopy(info: DragInfo | null, overCancel = false): { title: string; description: string } {
  // Encima de la zona de cancelar: se explica qué pasará si se suelta ahí.
  if (overCancel) return { title: "Cancelar la carga", description: "Si lo sueltas aquí, no se sube nada y vuelves al inicio." }
  if (info && info.count > 1) return { title: "Un solo archivo a la vez", description: `Traes ${info.count} archivos. Suelta solo tu CV más reciente.` }
  if (info?.unsupported) return { title: "Ese tipo de archivo no lo podemos leer", description: "Prueba con un PDF, un Word o una imagen de tu CV." }
  const label = info?.label
  return { title: "Suéltalo aquí, ya casi está", description: label ? `Formato ${label}: lo leeremos por ti y revisarás cada dato.` : "Con este CV armaremos tu perfil y tú revisas cada dato." }
}

/** Texto de la pantalla inicial en reposo (sin arrastrar): qué subir y qué pasará después. */
export const ENTRY_IDLE = { title: "Sube tu CV para empezar", description: "Arrastra el archivo hasta aquí o pulsa el botón. Lo leemos por ti y revisas cada dato." } as const

/** Una línea con lo que SÍ se sabe una vez soltado el archivo: nombre, peso y tipo. */
export function fileSummary(file: { name: string; size: number; type?: string }): string {
  const kind = (file.type && mimeLabel(file.type)) || getExtension(file.name).toUpperCase()
  return [file.name, file.size > 0 ? formatBytes(file.size) : "", kind].filter(Boolean).join(" · ")
}
