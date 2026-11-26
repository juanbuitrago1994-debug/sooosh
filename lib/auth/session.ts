import "server-only"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { and, eq, isNull } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { profiles, trustedDevices } from "@/lib/db/schema"
import { DEVICE_COOKIE, deviceCookieOptions, deviceExpiry, signDevice, verifyDevice } from "./device"
import { createAuthClient } from "./supabase"

export type AuthUser = { id: string; email: string; googleName: string; deviceId: string; remember: boolean }
export type Profile = { name: string; country: string; roleInterests: string[] }

/** Lee las cookies de la petición y devuelve una función que guarda las cookies nuevas (solo posible en acciones y rutas, no al renderizar). */
async function authClientFor(remember: boolean) {
  const store = await cookies()
  return createAuthClient({
    getAll: () => store.getAll(),
    setAll: (list) => {
      try {
        for (const c of list) store.set(c.name, c.value, c.options)
      } catch {
        // al renderizar un Server Component no se pueden escribir cookies; la renovación la hace `proxy.ts`
      }
    },
    remember,
  })
}

/** Etiqueta legible del dispositivo, a partir del navegador. No es un dato de seguridad. */
export function deviceLabel(ua: string | null): string {
  if (!ua) return "Dispositivo"
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Equipo"
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "navegador"
  return `${browser} en ${os}`
}

/**
 * Persona con sesión válida EN ESTE dispositivo, o `null`. Exige las tres cosas a la vez: cookie de dispositivo firmada y vigente, sesión de Supabase
 * verificada que pertenezca a la misma persona, y dispositivo no revocado en la base. Si falta una, es como no tener sesión.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies()
  const device = await verifyDevice(store.get(DEVICE_COOKIE)?.value)
  if (!device) return null
  const supabase = await authClientFor(device.remember)
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims || claims.sub !== device.userId) return null
  const db = getDb()
  const [row] = await db
    .select({ id: trustedDevices.id, lastSeenAt: trustedDevices.lastSeenAt })
    .from(trustedDevices)
    .where(and(eq(trustedDevices.id, device.id), eq(trustedDevices.userId, device.userId), isNull(trustedDevices.revokedAt)))
    .limit(1)
  if (!row) return null
  const meta = (claims.user_metadata ?? {}) as { full_name?: string; name?: string }
  return { id: device.userId, email: String(claims.email ?? ""), googleName: meta.full_name ?? meta.name ?? "", deviceId: device.id, remember: device.remember }
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const [row] = await getDb().select({ name: profiles.name, country: profiles.country, roleInterests: profiles.roleInterests }).from(profiles).where(eq(profiles.id, userId)).limit(1)
  return row ?? null
}

/** Para páginas y acciones que exigen sesión: sin ella, al login. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return user
}

/** Sesión y registro completo (nombre, país, intereses). Sin registro, al paso de registro. */
export async function requireProfile(): Promise<{ user: AuthUser; profile: Profile }> {
  const user = await requireUser()
  const profile = await getProfile(user.id)
  if (!profile) redirect("/registro")
  return { user, profile }
}

/** Crea el dispositivo de esta sesión y deja su cookie firmada. Solo desde rutas o acciones (escribe cookies). */
export async function registerDevice(userId: string, remember: boolean): Promise<void> {
  const expiresAt = deviceExpiry(remember)
  const label = deviceLabel((await headers()).get("user-agent")).slice(0, 80)
  const [row] = await getDb()
    .insert(trustedDevices)
    .values({ userId, remember, label, expiresAt: new Date(expiresAt).toISOString() })
    .returning({ id: trustedDevices.id })
  const value = await signDevice({ id: row.id, userId, expiresAt, remember })
  ;(await cookies()).set(DEVICE_COOKIE, value, deviceCookieOptions(remember, expiresAt))
}

/** Tras borrar la cuenta: solo quedan por limpiar las cookies de este navegador (la fila del dispositivo ya se fue con la persona). */
export async function clearSessionCookies(): Promise<void> {
  const store = await cookies()
  const supabase = await authClientFor(false)
  await supabase.auth.signOut({ scope: "local" }).catch(() => {})
  store.delete(DEVICE_COOKIE)
}

/** Cierra la sesión de este dispositivo: revoca su fila, borra las cookies y cierra la sesión en Supabase. */
export async function signOutThisDevice(): Promise<void> {
  const store = await cookies()
  const device = await verifyDevice(store.get(DEVICE_COOKIE)?.value)
  if (device) await getDb().update(trustedDevices).set({ revokedAt: new Date().toISOString() }).where(eq(trustedDevices.id, device.id))
  const supabase = await authClientFor(device?.remember ?? false)
  await supabase.auth.signOut({ scope: "local" })
  store.delete(DEVICE_COOKIE)
}
