/**
 * Sugerencia de «Mantener sesión iniciada» (decisión de Juan, 27-nov-2026): por defecto la sesión muere al cerrar el navegador (lo más seguro); la PRIMERA vez que
 * alguien entra en un dispositivo se le sugiere, una sola vez, mantenerla si es su equipo personal. Responder (con «Mantener», «Ahora no» o cerrando el aviso) la
 * apaga para siempre en ese dispositivo, también después de cerrar sesión (la marca NO usa el prefijo `sooosh:`, que se borra al cerrar sesión).
 */
export const REMEMBER_ANSWERED_KEY = "ct-recordar-respondido"
/** Una vez por pestaña mientras no se responda: si no hizo caso, no se le repite en cada página. */
export const REMEMBER_SHOWN_KEY = "ct-recordar-mostrado"
export const REMEMBER_DELAY_MS = 2500

export function shouldAskRemember(s: { remembered: boolean; answered: boolean; shownThisTab: boolean }): boolean {
  return !s.remembered && !s.answered && !s.shownThisTab
}
