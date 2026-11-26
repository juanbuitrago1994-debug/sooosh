/**
 * Cookie de dispositivo: `id.usuario.vence.recordar.firma`. La firma (HMAC-SHA256 con AUTH_DEVICE_SECRET) impide fabricarla, así que
 * copiar a otro equipo solo la cookie de sesión de Supabase no sirve: ese equipo no tiene cookie de dispositivo válida y cae en el login.
 * Usa Web Crypto para poder verificarse también en `proxy.ts`. La revocación (cerrar sesión en un dispositivo) se comprueba además en la base.
 */
export const DEVICE_COOKIE = "ct_device"
/** «Mantener sesión iniciada»: el dispositivo y la sesión duran 30 días (se renuevan al usarlos). */
export const REMEMBER_DAYS = 30
/** Sin marcar: la cookie muere al cerrar el navegador y, por si no se cierra, el dispositivo caduca a las 12 h. */
export const SESSION_HOURS = 12

export type DevicePayload = { id: string; userId: string; expiresAt: number; remember: boolean }

const enc = new TextEncoder()

function secret(): string {
  const s = process.env.AUTH_DEVICE_SECRET
  if (!s || s.length < 32) throw new Error("Falta AUTH_DEVICE_SECRET (32+ caracteres) en .env.local.")
  return s
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("")
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function signDevice(p: DevicePayload): Promise<string> {
  const body = `${p.id}.${p.userId}.${p.expiresAt}.${p.remember ? 1 : 0}`
  return `${body}.${await sign(body)}`
}

/** Devuelve el contenido si la firma es válida y no venció; `null` en cualquier otro caso. */
export async function verifyDevice(value: string | undefined): Promise<DevicePayload | null> {
  if (!value) return null
  const parts = value.split(".")
  if (parts.length !== 5) return null
  const [id, userId, exp, rem, sig] = parts
  if (!same(sig, await sign(`${id}.${userId}.${exp}.${rem}`))) return null
  const expiresAt = Number(exp)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null
  return { id, userId, expiresAt, remember: rem === "1" }
}

/** Opciones de la cookie de dispositivo: sin `maxAge` es cookie de sesión (muere al cerrar el navegador). */
export function deviceCookieOptions(remember: boolean, expiresAt: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", ...(remember ? { expires: new Date(expiresAt) } : {}) }
}

export function deviceExpiry(remember: boolean, from = Date.now()): number {
  return from + (remember ? REMEMBER_DAYS * 86_400_000 : SESSION_HOURS * 3_600_000)
}
