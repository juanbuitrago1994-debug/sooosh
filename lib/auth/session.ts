import "server-only"
import { cache } from "react"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { and, eq, isNull, sql } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { profiles, trustedDevices } from "@/lib/db/schema"
import { LAST_USER_COOKIE } from "./last-user"
import { updateDeviceRemember } from "./devices"
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

export type Session = { user: AuthUser; /** `null` = aún no completó el registro */ profile: Profile | null; /** la alerta inicial ya se creó */ alertsSeeded: boolean }

/**
 * Sesión válida EN ESTE dispositivo, o `null`. Exige las tres cosas a la vez: cookie de dispositivo firmada y vigente, sesión de Supabase verificada
 * (con las claves públicas de Auth: sin viaje de red) que pertenezca a la misma persona, y dispositivo no revocado en la base. Si falta una, es como no
 * tener sesión. UNA sola consulta trae el dispositivo y el perfil (cada viaje a la base cuesta ~150 ms desde casa), y `cache` de React la comparte
 * entre todo lo que se renderice o ejecute en la misma petición (página, puerta de acceso, campana…).
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies()
  const device = await verifyDevice(store.get(DEVICE_COOKIE)?.value)
  if (!device) return null
  const supabase = await authClientFor(device.remember)
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims || claims.sub !== device.userId) return null
  const [row] = await getDb()
    .select({ id: trustedDevices.id, name: profiles.name, country: profiles.country, roleInterests: profiles.roleInterests, alertsSeeded: profiles.alertsSeeded, hasProfile: sql<boolean>`${profiles.id} is not null` })
    .from(trustedDevices)
    .leftJoin(profiles, eq(profiles.id, trustedDevices.userId))
    .where(and(eq(trustedDevices.id, device.id), eq(trustedDevices.userId, device.userId), isNull(trustedDevices.revokedAt)))
    .limit(1)
  if (!row) return null
  const meta = (claims.user_metadata ?? {}) as { full_name?: string; name?: string }
  const user: AuthUser = { id: device.userId, email: String(claims.email ?? ""), googleName: meta.full_name ?? meta.name ?? "", deviceId: device.id, remember: device.remember }
  return { user, profile: row.hasProfile ? { name: row.name!, country: row.country!, roleInterests: row.roleInterests ?? [] } : null, alertsSeeded: !!row.alertsSeeded }
})

export async function getCurrentUser(): Promise<AuthUser | null> {
  return (await getSession())?.user ?? null
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
  const session = await getSession()
  if (!session) redirect("/login")
  if (!session.profile) redirect("/registro")
  return { user: session.user, profile: session.profile }
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

/**
 * Cambia «Mantener sesión iniciada» del dispositivo actual (Ajustes): actualiza su fila, reemite la cookie de dispositivo (persistente o de sesión) y
 * renueva la sesión de Supabase para que sus cookies también pasen a durar lo que corresponde. Solo desde acciones o rutas (escribe cookies).
 */
export async function setDeviceRemember(remember: boolean): Promise<boolean> {
  const session = await getSession()
  if (!session) return false
  const { user } = session
  const expiresAt = await updateDeviceRemember(getDb(), user.id, user.deviceId, remember)
  if (expiresAt === null) return false
  const store = await cookies()
  store.set(DEVICE_COOKIE, await signDevice({ id: user.deviceId, userId: user.id, expiresAt, remember }), deviceCookieOptions(remember, expiresAt))
  // Renovar la sesión reescribe sus cookies con la regla nueva (con «mantener»: duración larga; sin ella: cookies de sesión).
  const supabase = await authClientFor(remember)
  await supabase.auth.refreshSession().catch(() => {})
  return true
}

/** Tras borrar la cuenta: solo quedan por limpiar las cookies de este navegador (la fila del dispositivo ya se fue con la persona). */
export async function clearSessionCookies(): Promise<void> {
  const store = await cookies()
  const supabase = await authClientFor(false)
  await supabase.auth.signOut({ scope: "local" }).catch(() => {})
  store.delete(DEVICE_COOKIE)
  store.delete(LAST_USER_COOKIE) // la cuenta ya no existe: no se ofrece más «Continuar como…»
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
