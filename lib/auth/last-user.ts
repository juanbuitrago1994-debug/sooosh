/**
 * «Último usuario» de este dispositivo: nombre y correo de Google de quien entró por última vez, para ofrecerle «Continuar como …» en la pantalla de entrada.
 * Vive en una cookie `httpOnly` (solo la lee el servidor) de 1 año. NO da acceso a nada: entrar sigue exigiendo a Google y a la cookie de dispositivo firmada.
 * Se queda al cerrar sesión (ese es su sentido) y se borra con «Quitar» o al eliminar la cuenta.
 */
export const LAST_USER_COOKIE = "ct_last_user"
export const LAST_USER_MAX_AGE = 365 * 86_400

export type LastUser = { name: string; email: string }

export function encodeLastUser(u: LastUser): string {
  return encodeURIComponent(JSON.stringify({ n: u.name.trim().slice(0, 80), e: u.email.trim().slice(0, 120) }))
}

/** Lee la cookie con desconfianza: cualquier cosa que no sea nombre y correo razonables → `null`. */
export function parseLastUser(raw: string | undefined): LastUser | null {
  if (!raw) return null
  try {
    const d = JSON.parse(decodeURIComponent(raw)) as { n?: unknown; e?: unknown }
    if (typeof d.n !== "string" || typeof d.e !== "string") return null
    const name = d.n.trim()
    const email = d.e.trim()
    if (!name || name.length > 80 || !/^[^\s@]{1,64}@[^\s@]{1,100}\.[^\s@]{2,}$/.test(email) || email.length > 120) return null
    return { name, email }
  } catch {
    return null
  }
}

/** Iniciales para el avatar («Juan Buitrago» → «JB»). */
export function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"
}
