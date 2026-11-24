import { ACCEPT_LABEL, formatBytes, getExtension, isAllowedExtension, MAX_UPLOAD_BYTES } from "@/lib/uploads"

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
