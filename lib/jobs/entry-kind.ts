/** Lo que se pegó en la caja única de «Cargar una oferta»: un enlace (una sola «palabra» que empieza con http) o el texto de la oferta. */
export type EntryKind = "url" | "text"

export function classifyEntry(value: string): EntryKind {
  return /^https?:\/\/\S+$/i.test(value.trim()) ? "url" : "text"
}
