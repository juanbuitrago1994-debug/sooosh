import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import type { Db } from "@/lib/db"
import { createTestDb } from "@/lib/db/testing"
import { createAlert, deleteAlert, ensureDefaultAlert, findMatchingJobs, INACTIVE_DAYS, isDue, listAlerts, MAX_PER_PASS, runAlerts, setAlertEnabled, takeUnseen, touchAlerts, updateAlert } from "@/lib/alerts/engine"
import { describeFilters, filtersSchema, keywordMatches, MAX_ALERTS, type AlertFilters, type AlertInput, type Frequency } from "@/lib/alerts/filters"
import { bellData, createNotification, listNotifications, markAllRead, markRead, notifyOfferClosed, purgeNotifications, unreadCount } from "@/lib/alerts/notifications"

const ana = "11111111-1111-4111-8111-111111111111"
const luis = "22222222-2222-4222-8222-222222222222"
type Client = { exec: (q: string) => Promise<unknown>; query: <T>(q: string, p?: unknown[]) => Promise<{ rows: T[] }> }

import { jobMatchesKeywords } from "@/lib/alerts/filters"

describe("palabras clave de una alerta", () => {
  it("solo mira el título: las habilidades no cuentan", () => {
    expect(jobMatchesKeywords({ title: "Senior Fullstack Node/React Engineer" }, ["analista de datos"])).toBe(false)
    expect(jobMatchesKeywords({ title: "Analista de datos Jr" }, ["analista de datos"])).toBe(true)
    expect(jobMatchesKeywords({ title: "Cualquiera" }, [])).toBe(true)
  })
  it("todas las palabras importantes del cargo deben estar, sin tildes, mayúsculas ni plural", () => {
    expect(keywordMatches("Diseñador de Producto Senior", "diseñador de producto")).toBe(true)
    expect(keywordMatches("Diseñadora de productos digitales", "Diseñador de producto")).toBe(true)
    expect(keywordMatches("Analista de datos", "analista datos")).toBe(true)
    expect(keywordMatches("Ingeniero de datos", "analista de datos")).toBe(false)
    expect(keywordMatches("Senior Data Engineer", "data engineer")).toBe(true)
    expect(keywordMatches("Java Developer", "java")).toBe(true)
    expect(keywordMatches("JavaScript Developer", "java")).toBe(false) // palabras cortas: exactas
    expect(keywordMatches("Cualquier cosa", "de la")).toBe(false) // solo palabras vacías no encuentra nada
  })
  it("cruza español e inglés en los cargos más comunes", () => {
    expect(keywordMatches("Senior Software Engineer", "ingeniero de software")).toBe(true)
    expect(keywordMatches("Data Analyst (Junior)", "analista de datos")).toBe(true)
    expect(keywordMatches("Product Designer", "diseñador de producto")).toBe(true)
    expect(keywordMatches("Ingeniero de datos", "data engineer")).toBe(true)
    expect(keywordMatches("Data Engineer", "analista de datos")).toBe(false)
    expect(keywordMatches("Product Manager", "diseñador de producto")).toBe(false)
    expect(keywordMatches("Business Development Representative", "desarrollador")).toBe(false) // «development» no es «developer»
    expect(keywordMatches("Python Engineer - Data & Analytics", "analista de datos")).toBe(false) // «analytics» no es «analyst»
    expect(keywordMatches("Software Engineers", "ingeniero de software")).toBe(true) // plural
  })
})

describe("alertas", () => {
  let db: Db
  let client: Client
  const T0 = new Date("2026-11-26T12:00:00.000Z")
  const at = (h: number) => new Date(T0.getTime() + h * 3_600_000)
  const input = (o: { name?: string; frequency?: Frequency; filters?: Partial<AlertFilters> } = {}): AlertInput => ({ name: o.name ?? "Datos en Colombia", frequency: o.frequency ?? "cada_pasada", filters: filtersSchema.parse({ regions: ["CO"], keywords: ["analista de datos"], ...o.filters }) })
  let n = 0
  const addJob = async (o: { title?: string; regions?: string[]; country?: string | null; mode?: string; type?: string; seniority?: string; family?: string; status?: string; createdAt?: Date; company?: string } = {}) => {
    n++
    const { rows } = await client.query<{ id: string }>(
      `insert into public.jobs (title, company, country, regions, work_mode, employment_type, seniority, role_family, status, source_url, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [o.title ?? "Analista de datos", o.company ?? "Acme", o.country === undefined ? "CO" : o.country, `{${(o.regions ?? ["CO"]).join(",")}}`, o.mode ?? "hibrido", o.type ?? "Tiempo completo", o.seniority ?? "junior", o.family ?? "datos", o.status ?? "activa", `https://x.com/${n}`, (o.createdAt ?? T0).toISOString()],
    )
    return rows[0].id
  }
  const notes = (u = ana) => listNotifications(db, u)

  beforeEach(async () => {
    db = await createTestDb()
    client = (db as unknown as { $client: Client }).$client
    await client.exec("create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';")
    await client.exec(`insert into auth.users (id) values ('${ana}'), ('${luis}')`)
    // `jobs` real usa pgvector (no disponible en PGlite): versión mínima con las columnas que lee el buscador.
    await client.exec(`create table public.jobs (id uuid primary key default gen_random_uuid(), title text not null, company text, location_text text, country text, regions text[] not null default '{}', work_mode text, remote_scope text, employment_type text, seniority text, language text, skills text[] not null default '{}', apply jsonb, salary jsonb, source_name text not null default 'x', source_url text not null, posted_at timestamptz, valid_through timestamptz, created_at timestamptz not null default now(), origin text not null default 'feed', role_family text, is_tech boolean not null default false, offer jsonb not null default '{}', status text not null default 'activa')`)
    for (const f of ["0016_accounts.sql", "0020_alerts_notifications.sql"]) await client.exec(readFileSync(path.join(process.cwd(), "db/migrations", f), "utf8"))
    for (const id of [ana, luis]) await client.exec(`insert into public.profiles (id, name, country, role_interests) values ('${id}', 'P', 'CO', '{"Analista de datos","Científico de datos"}')`)
  })

  it("cada condición filtra: región (con remotas de Latinoamérica), modalidad, contrato, nivel, familia y palabras", async () => {
    const co = await addJob({ title: "Analista de datos" })
    const mx = await addJob({ title: "Analista de datos", regions: ["MX"], country: "MX", mode: "presencial" }) // otro país, presencial
    const remoteLatam = await addJob({ title: "Analista de datos remoto", regions: ["LATAM"], country: null, mode: "remoto" })
    await addJob({ title: "Chef", family: "otros" })
    await addJob({ title: "Analista de datos", status: "cerrada" })
    const ids = async (f: Partial<AlertInput["filters"]>) => (await findMatchingJobs(db, filtersSchema.parse({ keywords: [], ...f }))).map((j) => j.id).sort()
    expect(await ids({ regions: ["CO"], keywords: ["analista de datos"] })).toEqual([co, remoteLatam].sort())
    expect(await ids({ regions: ["CO"], workModes: ["remoto"] })).toEqual([remoteLatam])
    expect(await ids({ regions: ["CO"], employmentTypes: ["Prácticas"] })).toEqual([])
    expect(await ids({ regions: ["CO"], seniority: ["junior"], families: ["datos"] })).toEqual([co, remoteLatam].sort())
    expect(await ids({ regions: ["CO"], families: ["ventas"] })).toEqual([])
    expect((await ids({ keywords: ["chef"] })).length).toBe(1)
    expect(await ids({ regions: ["LATAM", "MX"], keywords: ["analista de datos"] })).toEqual([mx, remoteLatam].sort()) // varias regiones: cualquiera
  })

  it("primera pasada: mira los últimos 7 días, avisa una vez y no repite la misma oferta", async () => {
    await createAlert(db, ana, input())
    await addJob({ createdAt: at(-24) })
    await addJob({ createdAt: at(-24 * 10) }) // más vieja que 7 días: no entra
    let s = await runAlerts(db, T0)
    expect(s).toMatchObject({ alerts: 1, newMatches: 1, notifications: 1 })
    let list = await notes()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ kind: "alerta", title: "1 oferta nueva para «Datos en Colombia»", read: false })
    expect(list[0].body).toBe("Analista de datos — Acme")
    expect(list[0].href).toMatch(/^\/alertas\/[0-9a-f-]{36}$/)

    s = await runAlerts(db, at(3)) // nada nuevo: no hay aviso vacío
    expect(s).toMatchObject({ newMatches: 0, notifications: 0 })
    await addJob({ createdAt: at(4) })
    await addJob({ createdAt: at(5) })
    s = await runAlerts(db, at(6))
    expect(s).toMatchObject({ newMatches: 2, notifications: 1 })
    list = await notes()
    expect(list).toHaveLength(2)
    expect(list[0].title).toBe("2 ofertas nuevas para «Datos en Colombia»") // un solo aviso por pasada
    s = await runAlerts(db, at(9))
    expect(s.notifications).toBe(0)
  })

  it("frecuencia: «diaria» y «semanal» juntan lo nuevo y esperan su tiempo", async () => {
    const d = (await createAlert(db, ana, input({ name: "Diaria", frequency: "diaria" }))) as { id: string }
    await createAlert(db, ana, input({ name: "Semanal", frequency: "semanal" }))
    await addJob({ createdAt: at(-1) })
    await runAlerts(db, T0)
    expect((await notes()).map((x) => x.title).sort()).toEqual(["1 oferta nueva para «Diaria»", "1 oferta nueva para «Semanal»"]) // el primer aviso sale enseguida
    await addJob({ createdAt: at(2) })
    await runAlerts(db, at(3)) // < 22 h: se junta, sin aviso
    expect(await notes()).toHaveLength(2)
    await addJob({ createdAt: at(10) })
    await runAlerts(db, at(24)) // ≥ 22 h: la diaria avisa con las 2 acumuladas
    const list = await notes()
    expect(list).toHaveLength(3)
    expect(list[0].title).toBe("2 ofertas nuevas para «Diaria»")
    await runAlerts(db, at(24 * 7 + 1)) // la semanal aún acumulaba 2: ya cumplió 6 d 20 h
    expect((await notes()).some((x) => x.title === "2 ofertas nuevas para «Semanal»")).toBe(true)
    expect(isDue("diaria", at(0).toISOString(), at(21))).toBe(false)
    expect(isDue("diaria", at(0).toISOString(), at(22))).toBe(true)
    expect(isDue("cada_pasada", at(0).toISOString(), at(0))).toBe(true)
    void d
  })

  it("tope por pasada, ofertas cerradas no cuentan y alertas pausadas se saltan", async () => {
    const a = (await createAlert(db, ana, input())) as { id: string }
    for (let i = 0; i < MAX_PER_PASS + 10; i++) await addJob({ createdAt: at(-1) })
    await addJob({ status: "cerrada", createdAt: at(-1) })
    expect((await runAlerts(db, T0)).newMatches).toBe(MAX_PER_PASS)
    await setAlertEnabled(db, ana, a.id, false)
    await addJob({ createdAt: at(1) })
    expect((await runAlerts(db, at(3))).alerts).toBe(0)
  })

  it("se pausa sola a los 30 días sin abrir; abrir (o reanudar) reinicia el reloj", async () => {
    const a = (await createAlert(db, ana, input())) as { id: string }
    // La alerta se crea con la hora real de la base: el «ahora» de la prueba se mide desde ella (no desde una fecha fija, que dejaba de valer al cambiar el día).
    const s = await runAlerts(db, new Date(Date.now() + (INACTIVE_DAYS + 1) * 86_400_000))
    expect(s.paused).toBe(1)
    let [al] = await listAlerts(db, ana)
    expect(al).toMatchObject({ enabled: false, pausedReason: "inactiva" })
    expect(await setAlertEnabled(db, ana, a.id, true)).toBe(true)
    ;[al] = await listAlerts(db, ana)
    expect(al).toMatchObject({ enabled: true, pausedReason: null })
    await client.exec(`update public.alerts set last_opened_at = now() - interval '29 days'`)
    await touchAlerts(db, ana, a.id)
    expect((await runAlerts(db, new Date())).paused).toBe(0)
  })

  it("editar reinicia lo no avisado; borrar se lleva coincidencias; límite de alertas; aislamiento", async () => {
    const a = (await createAlert(db, ana, input())) as { id: string }
    await addJob({ createdAt: at(-1) })
    await runAlerts(db, T0)
    expect(await takeUnseen(db, a.id)).toHaveProperty("size", 1)
    expect(await takeUnseen(db, a.id)).toHaveProperty("size", 0) // ya vistas
    expect(await updateAlert(db, luis, a.id, input({ name: "robada" }))).toBe(false)
    expect(await updateAlert(db, ana, a.id, input({ name: "Otra", filters: { keywords: ["chef"] } }))).toBe(true)
    expect((await listAlerts(db, ana))[0]).toMatchObject({ name: "Otra" })
    expect(await deleteAlert(db, luis, a.id)).toBe(false)
    expect(await deleteAlert(db, ana, a.id)).toBe(true)
    expect((await client.query<{ n: number }>(`select count(*)::int n from public.alert_matches`)).rows[0].n).toBe(0)
    for (let i = 0; i < MAX_ALERTS; i++) await createAlert(db, ana, input({ name: `A${i}` }))
    expect(await createAlert(db, ana, input({ name: "una más" }))).toEqual({ error: "limit" })
    expect(await listAlerts(db, luis)).toHaveLength(0)
  })

  it("alerta inicial: con los cargos de interés y el país, una sola vez (si se borra, no vuelve)", async () => {
    expect(await ensureDefaultAlert(db, ana)).toBe(true)
    const [a] = await listAlerts(db, ana)
    expect(a.name).toBe("Mis cargos en Colombia")
    expect(a.frequency).toBe("cada_pasada")
    expect(a.filters).toMatchObject({ regions: ["CO"], keywords: ["Analista de datos", "Científico de datos"] })
    expect(await ensureDefaultAlert(db, ana)).toBe(false)
    await deleteAlert(db, ana, a.id)
    expect(await ensureDefaultAlert(db, ana)).toBe(false)
    expect(await listAlerts(db, ana)).toHaveLength(0)
    expect(describeFilters(a.filters)).toEqual(["Colombia", "«Analista de datos»", "«Científico de datos»"])
  })

  it("la campana trae las últimas 30 y el total sin leer en UNA consulta", async () => {
    for (let i = 0; i < 35; i++) await createNotification(db, { userId: ana, kind: "alerta", title: `n${i}`, href: "/notificaciones" })
    await createNotification(db, { userId: luis, kind: "alerta", title: "de luis", href: "/notificaciones" })
    await client.exec(`update public.notifications set read_at = now() where title in ('n0','n1') and user_id = '${ana}'`)
    const b = await bellData(db, ana)
    expect(b.items).toHaveLength(30)
    expect(b.unread).toBe(33) // las 35 menos 2 leídas, aunque solo se devuelvan 30
    expect(b.items.every((x) => x.title.startsWith("n"))).toBe(true)
    expect(await bellData(db, "33333333-3333-4333-8333-333333333333")).toEqual({ unread: 0, items: [] })
  })

  it("notificaciones: leer una o todas, una sola «oferta cerrada» por oferta y limpieza de las viejas", async () => {
    const offer = { id: "0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b", title: "Analista", company: "Acme" }
    await notifyOfferClosed(db, ana, offer)
    await notifyOfferClosed(db, ana, offer) // no se repite
    await createNotification(db, { userId: ana, kind: "alerta", title: "x", href: "/alertas/1" })
    await createNotification(db, { userId: luis, kind: "alerta", title: "de luis", href: "/alertas/2" })
    expect(await unreadCount(db, ana)).toBe(2)
    const list = await notes()
    expect(list.find((x) => x.kind === "oferta_cerrada")).toMatchObject({ title: "Una oferta guardada ya cerró", body: "Analista — Acme", href: "/mis-ofertas" })
    expect(await markRead(db, luis, list[0].id)).toBe(false) // ajena
    expect(await markRead(db, ana, list[0].id)).toBe(true)
    expect(await unreadCount(db, ana)).toBe(1)
    expect(await markAllRead(db, ana)).toBe(1)
    expect(await unreadCount(db, ana)).toBe(0)
    expect(await unreadCount(db, luis)).toBe(1)
    await client.exec(`update public.notifications set created_at = now() - interval '61 days' where user_id = '${ana}'`)
    expect(await purgeNotifications(db)).toBe(2)
    expect(await notes(luis)).toHaveLength(1)
  })
})
