import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Borra a una persona de Supabase Auth con la clave de servicio (SUPABASE_SECRET_KEY, solo en `.env.local`, nunca en el navegador).
 * Las tablas de la persona (perfil, dispositivos, CV, ofertas…) cuelgan de `auth.users` con `on delete cascade`: se van con ella.
 */
export async function deleteAuthUser(userId: string): Promise<boolean> {
  const key = process.env.SUPABASE_SECRET_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!key || !url) throw new Error("Falta SUPABASE_SECRET_KEY o NEXT_PUBLIC_SUPABASE_URL en .env.local.")
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    console.error("[cuenta] no se pudo borrar el usuario", error.message)
    return false
  }
  return true
}
