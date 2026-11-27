import { and, eq, isNull } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { trustedDevices } from "@/lib/db/schema"
import { deviceExpiry } from "./device"

/**
 * «Mantener sesión iniciada en este dispositivo» (se elige en Ajustes, no al entrar): marca el dispositivo como recordado (30 días) o de sesión (12 h, y su cookie
 * muere al cerrar el navegador). Solo toca un dispositivo de ESA persona que no esté revocado. Devuelve el vencimiento nuevo (ms) o `null` si no existe.
 */
export async function updateDeviceRemember(db: Db, userId: string, deviceId: string, remember: boolean, now = Date.now()): Promise<number | null> {
  const expiresAt = deviceExpiry(remember, now)
  const rows = await db
    .update(trustedDevices)
    .set({ remember, expiresAt: new Date(expiresAt).toISOString(), lastSeenAt: new Date(now).toISOString() })
    .where(and(eq(trustedDevices.id, deviceId), eq(trustedDevices.userId, userId), isNull(trustedDevices.revokedAt)))
    .returning({ id: trustedDevices.id })
  return rows.length ? expiresAt : null
}
