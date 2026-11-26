import { desc, eq } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { alerts, collections, cvs, notifications, profiles, trackedOffers, trustedDevices } from "@/lib/db/schema"

export const EXPORT_VERSION = 1

/**
 * Todo lo que Sooosh guarda de una persona, en un solo archivo legible (JSON). Es el derecho a llevarse sus datos: si se agrega una tabla con datos
 * de la persona, DEBE agregarse aquí (hay una prueba que lo exige). No incluye cookies ni claves; de los dispositivos solo nombre y fechas.
 */
export async function buildExport(db: Db, userId: string, account: { email: string }, now: Date = new Date()) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1)
  const cvRows = await db.select().from(cvs).where(eq(cvs.userId, userId)).orderBy(desc(cvs.isActive), desc(cvs.updatedAt))
  const offers = await db.select().from(trackedOffers).where(eq(trackedOffers.userId, userId)).orderBy(desc(trackedOffers.createdAt))
  const cats = await db.select().from(collections).where(eq(collections.userId, userId))
  const catName = new Map(cats.map((c) => [c.id, c.name]))
  const myAlerts = await db.select().from(alerts).where(eq(alerts.userId, userId)).orderBy(desc(alerts.createdAt))
  const notes = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt))
  const devices = await db.select().from(trustedDevices).where(eq(trustedDevices.userId, userId)).orderBy(desc(trustedDevices.lastSeenAt))
  return {
    sooosh: { version: EXPORT_VERSION, exportedAt: now.toISOString(), note: "Todos tus datos en Sooosh. Los CV y las ofertas están completos." },
    cuenta: { correo: account.email, id: userId },
    perfil: profile ? { nombre: profile.name, pais: profile.country, cargosDeInteres: profile.roleInterests, creadoEn: profile.createdAt } : null,
    cvs: cvRows.map((r) => ({ activo: r.isActive, etiqueta: r.label, validadoEn: r.validatedAt, archivo: r.file, afinidadAts: r.originalAts, cv: r.cv })),
    categorias: cats.map((c) => ({ nombre: c.name, creadaEn: c.createdAt })),
    ofertasGuardadas: offers.map((o) => ({
      titulo: o.title,
      empresa: o.company,
      enlace: o.originalUrl,
      fuente: o.sourceName,
      publicadaEn: o.postedAt,
      guardadaEn: o.createdAt,
      categoria: o.collectionId ? (catName.get(o.collectionId) ?? null) : null,
      nota: o.note,
      origen: o.origin,
      estado: o.status,
      ultimaRevision: o.lastCheckedAt,
      cerradaDetectadaEn: o.closedDetectedAt,
      oferta: o.offer,
      texto: o.text,
    })),
    alertas: myAlerts.map((a) => ({ nombre: a.name, condiciones: a.filters, frecuencia: a.frequency, activa: a.enabled, creadaEn: a.createdAt })),
    notificaciones: notes.map((n) => ({ tipo: n.kind, titulo: n.title, texto: n.body, enlace: n.href, creadaEn: n.createdAt, leida: !!n.readAt })),
    dispositivos: devices.map((d) => ({ nombre: d.label, sesionMantenida: d.remember, creadoEn: d.createdAt, ultimoUso: d.lastSeenAt, revocado: !!d.revokedAt })),
  }
}
