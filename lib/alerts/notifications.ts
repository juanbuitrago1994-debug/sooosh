import { and, desc, eq, isNull, sql } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"

export const RETENTION_DAYS = 60

export type Notification = { id: string; kind: "alerta" | "oferta_cerrada"; title: string; body: string; href: string; createdAt: string; read: boolean }

const iso = (s: string) => new Date(/[zZ]|[+-]\d\d(:?\d\d)?$/.test(s) ? s : `${s}Z`).toISOString()

export async function listNotifications(db: Db, userId: string, limit = 50): Promise<Notification[]> {
  const rows = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit)
  return rows.map((r) => ({ id: r.id, kind: r.kind as Notification["kind"], title: r.title, body: r.body, href: r.href, createdAt: iso(r.createdAt), read: !!r.readAt }))
}

export async function unreadCount(db: Db, userId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  return r?.n ?? 0
}

export async function markRead(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db.update(notifications).set({ readAt: sql`now()` }).where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt))).returning({ id: notifications.id })
  return rows.length > 0
}

export async function markAllRead(db: Db, userId: string): Promise<number> {
  const rows = await db.update(notifications).set({ readAt: sql`now()` }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))).returning({ id: notifications.id })
  return rows.length
}

/** Crea un aviso. Con `ref`, nunca se repite para la misma persona y tipo (p. ej. una sola notificación por oferta que cerró). */
export async function createNotification(db: Db, n: { userId: string; kind: Notification["kind"]; title: string; body?: string; href: string; ref?: string }): Promise<boolean> {
  const rows = await db.insert(notifications).values({ userId: n.userId, kind: n.kind, title: n.title.slice(0, 200), body: (n.body ?? "").slice(0, 400), href: n.href, ref: n.ref ?? null }).onConflictDoNothing().returning({ id: notifications.id })
  return rows.length > 0
}

/** Una oferta guardada cerró (la detecta el seguimiento de vigencia): un solo aviso por oferta. */
export async function notifyOfferClosed(db: Db, userId: string, offer: { id: string; title: string; company: string | null }): Promise<void> {
  await createNotification(db, { userId, kind: "oferta_cerrada", ref: offer.id, title: "Una oferta guardada ya cerró", body: [offer.title, offer.company].filter(Boolean).join(" — "), href: "/mis-ofertas" })
}

/** Quita avisos viejos (60 días). */
export async function purgeNotifications(db: Db): Promise<number> {
  const rows = await db.delete(notifications).where(sql`${notifications.createdAt} < now() - make_interval(days => ${RETENTION_DAYS})`).returning({ id: notifications.id })
  return rows.length
}

/** Las notificaciones de una alerta se marcan leídas al abrir sus resultados. */
export async function markAlertNotificationsRead(db: Db, userId: string, alertId: string): Promise<void> {
  await db.update(notifications).set({ readAt: sql`now()` }).where(and(eq(notifications.userId, userId), eq(notifications.kind, "alerta"), eq(notifications.href, `/alertas/${alertId}`), isNull(notifications.readAt)))
}

