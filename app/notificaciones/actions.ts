"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createAlert, deleteAlert, ensureDefaultAlert, setAlertEnabled, touchAlerts, updateAlert } from "@/lib/alerts/engine"
import { alertInputSchema } from "@/lib/alerts/filters"
import { listNotifications, markAllRead, markRead, unreadCount, type Notification } from "@/lib/alerts/notifications"
import { getCurrentUser } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { withDb } from "@/lib/db/resilient"

/** Todas las acciones toman a la persona de la sesión verificada (nunca de lo que envíe el navegador). */
const uuid = z.string().uuid()
const refresh = () => revalidatePath("/notificaciones")

/** Lo que pinta la campana: no leídas y las últimas 5. Aquí se crea (una sola vez) la alerta inicial de la persona. */
export async function getBell(): Promise<{ unread: number; items: Notification[] } | null> {
  const user = await getCurrentUser()
  if (!user) return null
  try {
    const db = getDb()
    await ensureDefaultAlert(db, user.id).catch((e) => console.error("[alertas] alerta inicial", e))
    const [unread, items] = await Promise.all([withDb((d) => unreadCount(d, user.id)), withDb((d) => listNotifications(d, user.id, 5))])
    return { unread, items }
  } catch (e) {
    console.error("[notificaciones] campana", e)
    return null
  }
}

export async function readNotification(id: string, alertHref?: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user || !uuid.safeParse(id).success) return
  const db = getDb()
  await markRead(db, user.id, id).catch(() => false)
  // Abrir el aviso de una alerta cuenta como actividad: no se pausa por inactividad.
  const m = alertHref?.match(/^\/alertas\/([0-9a-f-]{36})$/)
  if (m && uuid.safeParse(m[1]).success) await touchAlerts(db, user.id, m[1]).catch(() => {})
  refresh()
}

export async function readAllNotifications(): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  await markAllRead(getDb(), user.id).catch(() => 0)
  refresh()
}

export type AlertResult = { ok: true } | { ok: false; reason: "session" | "invalid" | "limit" | "error"; message?: string }

/** Crea (id = null) o edita una alerta. */
export async function saveAlert(id: string | null, raw: unknown): Promise<AlertResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, reason: "session" }
  const parsed = alertInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message }
  try {
    const db = getDb()
    if (id === null) {
      const r = await createAlert(db, user.id, parsed.data)
      if ("error" in r) return { ok: false, reason: "limit" }
    } else if (!uuid.safeParse(id).success || !(await updateAlert(db, user.id, id, parsed.data))) return { ok: false, reason: "invalid" }
    refresh()
    return { ok: true }
  } catch (e) {
    console.error("[alertas] guardar", e)
    return { ok: false, reason: "error" }
  }
}

export async function toggleAlert(id: string, enabled: boolean): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user || !uuid.safeParse(id).success) return false
  const ok = await setAlertEnabled(getDb(), user.id, id, enabled).catch(() => false)
  if (ok) refresh()
  return ok
}

export async function removeAlert(id: string): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user || !uuid.safeParse(id).success) return false
  const ok = await deleteAlert(getDb(), user.id, id).catch(() => false)
  if (ok) refresh()
  return ok
}

