/**
 * Datos personales que la app guarda en este navegador (CV, historial de adaptaciones, marcas, filtros, datos del correo). Se borran al cerrar
 * sesión y cuando entra una cuenta distinta a la dueña de estos datos: en un equipo compartido nadie debe ver el CV de otra persona.
 * Quedan el consentimiento de medición (es del navegador, no de la cuenta) y las preferencias de región/área.
 */
const KEEP = ["sooosh:consentimiento:v1", "sooosh:consentimiento-cambio", "sooosh:region", "sooosh:area"]
export const OWNER_KEY = "sooosh:duena:v1"

/**
 * `silent`: al cerrar sesión no se avisa a la pantalla (la página se recarga enseguida). Avisar haría creer a `CvSync` que la persona
 * pidió cambiar de CV y desactivaría en la cuenta el CV que sigue siendo suyo.
 */
export function clearLocalAccountData(opts: { silent?: boolean } = {}): void {
  try {
    const drop: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k.startsWith("sooosh:") || k.startsWith("cv-tailor:")) && !KEEP.includes(k)) drop.push(k)
    }
    drop.forEach((k) => localStorage.removeItem(k))
    sessionStorage.clear()
    if (!opts.silent) window.dispatchEvent(new Event("sooosh:perfil-busqueda-cambio"))
  } catch {
    /* sin almacenamiento */
  }
}

/** Marca de quién es la dueña de los datos locales. Si ya había otra, los borra antes de seguir. Devuelve si hubo que borrar. */
export function claimLocalData(userId: string): boolean {
  try {
    const owner = localStorage.getItem(OWNER_KEY)
    let wiped = false
    if (owner && owner !== userId) {
      clearLocalAccountData()
      wiped = true
    }
    localStorage.setItem(OWNER_KEY, userId)
    return wiped
  } catch {
    return false
  }
}
