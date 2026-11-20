export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const ALLOWED_EXTENSIONS = [
  "pdf",
  "docx",
  "doc",
  "odt",
  "rtf",
  "txt",
  "md",
  "jpg",
  "jpeg",
  "png",
  "heic",
] as const

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number]

/** Mapa `accept` para react-dropzone / <input>. HEIC y MD llegan a veces sin MIME, por eso van también por extensión. */
export const ACCEPT: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
  "application/vnd.oasis.opendocument.text": [".odt"],
  "application/rtf": [".rtf"],
  "text/rtf": [".rtf"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
}

export const ACCEPT_LABEL = "PDF, DOCX, DOC, ODT, RTF, TXT, MD, JPG, PNG, HEIC"

export function getExtension(name: string): string {
  const i = name.lastIndexOf(".")
  return i === -1 ? "" : name.slice(i + 1).toLowerCase()
}

export function isAllowedExtension(ext: string): ext is AllowedExtension {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Devuelve un mensaje de error en español, o null si el archivo es válido. */
export function validateFile(file: { name: string; size: number }): string | null {
  if (file.size === 0) return "El archivo está vacío."
  if (file.size > MAX_UPLOAD_BYTES)
    return `Pesa ${formatBytes(file.size)} y el máximo es ${formatBytes(MAX_UPLOAD_BYTES)}.`
  if (!isAllowedExtension(getExtension(file.name)))
    return `Formato no admitido. Usa ${ACCEPT_LABEL}.`
  return null
}

export type UploadedFile = {
  id: string // nombre en disco, p. ej. "<uuid>.pdf"
  name: string // nombre original
  size: number
  type: string // extensión en mayúsculas, p. ej. "PDF"
}

/** id válido: uuid + extensión permitida. Evita path traversal en DELETE. */
export const STORED_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]{2,4}$/
