import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import type { Db } from "@/lib/db"
import { createTestDb } from "@/lib/db/testing"
import { companyKey } from "@/lib/tracking/company"
import { judgeResponse, probeOfferLink, type Verdict } from "@/lib/tracking/liveness"
import { ago, groupByCompany } from "@/lib/tracking/relative"
import { MAX_TRACKED, checkDueOffers, listTrackedOffers, nextState, removeTrackedOffer, saveTrackedOffer } from "@/lib/tracking/store"
import { offerSchema } from "@/lib/schemas/offer"

const page = (body: string, extra = "") => `<html><head><title>Oferta</title>${extra}</head><body><main>${body}</main></body></html>`
const LONG = "Buscamos una persona para liderar el diseño de producto en nuestro equipo. Trabajarás con ingeniería y negocio. ".repeat(4)
const URL1 = "https://empresa.com/empleos/123"

describe("¿sigue abierta la oferta?", () => {
  const j = (o: Partial<Parameters<typeof judgeResponse>[0]> & { html?: string }) => judgeResponse({ status: 200, finalUrl: URL1, originalUrl: URL1, html: page(LONG), ...o })

  it("abierta: página normal con contenido", () => expect(j({}).state).toBe("alive"))
  it("404 y 410: cerrada", () => {
    expect(j({ status: 404 }).state).toBe("dead")
    expect(j({ status: 410 }).state).toBe("dead")
  })
  it("403, 429, 5xx y 999: no se puede saber (no cuenta como cerrada)", () => {
    for (const status of [401, 403, 429, 500, 503, 999]) expect(j({ status }).state).toBe("unknown")
  })
  it("pared de inicio de sesión: no se puede saber", () => expect(j({ finalUrl: "https://x.com/login?next=/jobs/1" }).state).toBe("unknown"))
  it("redirige a la portada: cerrada", () => expect(j({ finalUrl: "https://empresa.com/" }).state).toBe("dead"))
  it("redirige a la lista de ofertas o a una página de error: cerrada", () => {
    expect(j({ originalUrl: "https://boards.greenhouse.io/acme/jobs/123", finalUrl: "https://job-boards.greenhouse.io/acme?error=true" }).state).toBe("dead")
    expect(j({ originalUrl: "https://jobs.lever.co/acme/abc-123", finalUrl: "https://jobs.lever.co/acme" }).state).toBe("dead")
    expect(j({ originalUrl: "https://boards.greenhouse.io/acme/jobs/123", finalUrl: "https://job-boards.greenhouse.io/acme/jobs/123" }).state).toBe("alive") // solo cambió de dominio
  })
  it("frases de cierre en español e inglés", () => {
    for (const t of ["Esta oferta ya no está disponible.", "Vacante cerrada", "La oferta ha finalizado", "Ya no se aceptan postulaciones", "No longer accepting applications", "This job has expired", "The position has been filled", "Applications are closed"])
      expect(j({ html: page(`${t} ${LONG}`) }).state, t).toBe("dead")
  })
  it("una página de oferta normal que habla de «aplicaciones» no se confunde", () => expect(j({ html: page(`Diseñarás aplicaciones móviles y cerrarás ciclos con el equipo. ${LONG}`) }).state).toBe("alive"))
  it("vigencia declarada (JSON-LD) vencida: cerrada y no necesita confirmación", () => {
    const ld = `<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title: "Dev", description: LONG, validThrough: "2026-01-01" })}</script>`
    const v = j({ html: page(LONG, ld), now: new Date("2026-11-26") })
    expect(v).toMatchObject({ state: "dead", declared: true })
    expect(j({ html: page(LONG, ld), now: new Date("2025-12-01") }).state).toBe("alive")
  })
  it("página vacía (necesita JavaScript): no se puede saber", () => expect(j({ html: page("Cargando…") }).state).toBe("unknown"))

  it("probe: sigue redirecciones, rechaza redes locales y un fallo de red es «no se sabe»", async () => {
    const ok = async () => new Response(page(LONG), { status: 200, headers: { "content-type": "text/html" } })
    expect((await probeOfferLink(URL1, { fetchImpl: ok as typeof fetch, lookup: async () => ["93.184.216.34"] })).state).toBe("alive")
    expect((await probeOfferLink("http://192.168.0.1/x", { fetchImpl: ok as typeof fetch, lookup: async () => ["192.168.0.1"] })).state).toBe("unknown")
    const boom = async () => {
      throw new Error("ECONNRESET")
    }
    expect((await probeOfferLink(URL1, { fetchImpl: boom as unknown as typeof fetch, lookup: async () => ["93.184.216.34"] })).state).toBe("unknown")
    const moved = async (u: URL | string) => (String(u).includes("empleos") ? new Response(null, { status: 301, headers: { location: "/" } }) : new Response(page("Inicio " + LONG), { status: 200 }))
    expect((await probeOfferLink(URL1, { fetchImpl: moved as unknown as typeof fetch, lookup: async () => ["93.184.216.34"] })).state).toBe("dead")
  })
})

describe("cuándo una oferta pasa a «finalizada»", () => {
  const base = { status: "vigente" as const, deadStreak: 0, closedDetectedAt: null, lastAliveAt: "2026-11-25T00:00:00.000Z" }
  const now = new Date("2026-11-26T12:00:00.000Z")
  const dead: Verdict = { state: "dead", reason: "cerró" }
  it("una sola señal de cierre no basta; la segunda seguida sí", () => {
    const a = nextState(base, dead, now)
    expect(a).toMatchObject({ status: "vigente", deadStreak: 1, closedDetectedAt: null })
    const b = nextState({ ...base, deadStreak: a.deadStreak }, dead, now)
    expect(b).toMatchObject({ status: "finalizada", deadStreak: 2, closedDetectedAt: now.toISOString() })
  })
  it("una revisión abierta reinicia la cuenta y reabre una finalizada", () => {
    expect(nextState({ ...base, deadStreak: 1 }, { state: "alive", reason: "ok" }, now)).toMatchObject({ status: "vigente", deadStreak: 0 })
    expect(nextState({ ...base, status: "finalizada", deadStreak: 2, closedDetectedAt: "2026-11-20T00:00:00.000Z" }, { state: "alive", reason: "ok" }, now)).toMatchObject({ status: "vigente", closedDetectedAt: null })
  })
  it("«no se sabe» no cambia nada (ni abre ni cierra)", () => {
    expect(nextState({ ...base, deadStreak: 1 }, { state: "unknown", reason: "403" }, now)).toMatchObject({ status: "vigente", deadStreak: 1 })
    expect(nextState({ ...base, status: "sin_verificar" }, { state: "unknown", reason: "login" }, now).status).toBe("sin_verificar")
  })
  it("la vigencia declarada cierra de inmediato y conserva la primera fecha de cierre", () => {
    expect(nextState(base, { state: "dead", declared: true, reason: "venció" }, now).status).toBe("finalizada")
    expect(nextState({ ...base, status: "finalizada", deadStreak: 2, closedDetectedAt: "2026-11-20T00:00:00.000Z" }, dead, now).closedDetectedAt).toBe("2026-11-20T00:00:00.000Z")
  })
})

describe("ofertas guardadas en la cuenta", () => {
  let db: Db
  const ana = "11111111-1111-4111-8111-111111111111"
  const luis = "22222222-2222-4222-8222-222222222222"
  const offer = (title: string, company?: string) => offerSchema.parse({ title, company, language: "es", requirements: ["SQL"], niceToHave: [], responsibilities: [] })
  beforeEach(async () => {
    db = await createTestDb()
    const client = (db as unknown as { $client: { exec: (q: string) => Promise<unknown> } }).$client
    await client.exec("create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';")
    await client.exec(`insert into auth.users (id) values ('${ana}'), ('${luis}')`)
    for (const f of ["0018_tracked_offers.sql", "0019_collections_notes.sql"]) await client.exec(readFileSync(path.join(process.cwd(), "db/migrations", f), "utf8"))
  })

  it("guarda la oferta completa y no la duplica aunque el enlace traiga rastreadores", async () => {
    const a = await saveTrackedOffer(db, ana, { url: "https://www.empresa.com/empleos/1?utm_source=x", offer: offer("Analista", "Nubank"), text: "texto completo", postedAt: "2026-11-01" })
    expect(a).toMatchObject({ created: true })
    const b = await saveTrackedOffer(db, ana, { url: "https://empresa.com/empleos/1?utm_campaign=y", offer: offer("Analista Sr", "Nubank"), text: "texto completo 2" })
    expect(b).toMatchObject({ created: false })
    const list = await listTrackedOffers(db, ana)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ title: "Analista Sr", company: "Nubank", status: "sin_verificar", text: "texto completo 2", postedAt: null === list[0].postedAt ? null : list[0].postedAt })
    expect(list[0].offer.requirements).toEqual(["SQL"])
  })

  it("cada persona ve y borra solo lo suyo", async () => {
    const r = await saveTrackedOffer(db, ana, { url: "https://empresa.com/e/1", offer: offer("A"), text: "t" })
    await saveTrackedOffer(db, luis, { url: "https://empresa.com/e/1", offer: offer("A"), text: "t" })
    expect(await listTrackedOffers(db, luis)).toHaveLength(1)
    expect(await removeTrackedOffer(db, luis, (r as { id: string }).id)).toBe(false)
    expect(await removeTrackedOffer(db, ana, (r as { id: string }).id)).toBe(true)
    expect(await listTrackedOffers(db, ana)).toHaveLength(0)
    expect(await listTrackedOffers(db, luis)).toHaveLength(1)
  })

  it("respeta el máximo y rechaza enlaces inválidos", async () => {
    expect(await saveTrackedOffer(db, ana, { url: "no es un enlace", offer: offer("A"), text: "t" })).toEqual({ error: "invalid_url" })
    const client = (db as unknown as { $client: { exec: (q: string) => Promise<unknown> } }).$client
    await client.exec(`insert into public.tracked_offers (user_id, source_url, original_url, title, offer, text) select '${ana}', 'https://x.com/' || g, 'https://x.com/' || g, 't', '{}'::jsonb, 't' from generate_series(1, ${MAX_TRACKED}) g`)
    expect(await saveTrackedOffer(db, ana, { url: "https://empresa.com/e/otra", offer: offer("A"), text: "t" })).toEqual({ error: "limit" })
  })

  it("la revisión automática: una sola vez por enlace, confirma el cierre en la segunda y reabre si vuelve", async () => {
    await saveTrackedOffer(db, ana, { url: URL1, offer: offer("A", "Acme"), text: "t" })
    await saveTrackedOffer(db, luis, { url: URL1, offer: offer("A", "Acme"), text: "t" })
    const calls: string[] = []
    let verdict: Verdict = { state: "alive", reason: "abierta" }
    const probe = async (u: string) => (calls.push(u), verdict)
    const t0 = new Date("2026-11-26T00:00:00.000Z")
    const hours = (h: number) => new Date(t0.getTime() + h * 3_600_000)

    let s = await checkDueOffers(db, { probe, now: t0 })
    expect(calls).toHaveLength(1) // dos personas, un solo enlace → una sola visita
    expect(s).toMatchObject({ urls: 1, alive: 1 })
    expect((await listTrackedOffers(db, ana))[0].status).toBe("vigente")

    s = await checkDueOffers(db, { probe, now: hours(5) }) // revisada hace 5 h: todavía no toca
    expect(s.urls).toBe(0)

    verdict = { state: "dead", reason: "404" }
    s = await checkDueOffers(db, { probe, now: hours(13) })
    expect(s).toMatchObject({ dead: 1, newlyClosed: 0 })
    expect((await listTrackedOffers(db, ana))[0].status).toBe("vigente") // una señal no basta

    s = await checkDueOffers(db, { probe, now: hours(14) }) // confirmación pendiente: solo esperó 1 h
    expect(s.urls).toBe(0)
    s = await checkDueOffers(db, { probe, now: hours(17) }) // a las 3 h se confirma
    expect(s.newlyClosed).toBe(2)
    const closed = (await listTrackedOffers(db, ana))[0]
    expect(closed.status).toBe("finalizada")
    expect(closed.closedDetectedAt).toBe(hours(17).toISOString())

    verdict = { state: "alive", reason: "abierta otra vez" }
    await checkDueOffers(db, { probe, now: hours(17 + 73) }) // las finalizadas se miran cada 72 h por si la reabren
    expect((await listTrackedOffers(db, ana))[0].status).toBe("vigente")
  })

  it("«no se sabe» deja la oferta sin verificar", async () => {
    await saveTrackedOffer(db, ana, { url: "https://www.linkedin.com/jobs/view/1234567890/", offer: offer("A"), text: "t" })
    await checkDueOffers(db, { probe: async () => ({ state: "unknown", reason: "pide iniciar sesión" }), now: new Date() })
    const o = (await listTrackedOffers(db, ana))[0]
    expect(o.status).toBe("sin_verificar")
    expect(o.checkNote).toBe("pide iniciar sesión")
    expect(o.lastCheckedAt).not.toBeNull()
  })
})

describe("textos y grupos", () => {
  it("tiempo transcurrido en español", () => {
    const now = new Date("2026-11-26T12:00:00Z")
    expect(ago("2026-11-26T11:59:30Z", now)).toBe("hace un momento")
    expect(ago("2026-11-26T09:00:00Z", now)).toBe("hace 3 h")
    expect(ago("2026-11-25T11:00:00Z", now)).toBe("hace 1 día")
    expect(ago("2026-11-16T12:00:00Z", now)).toBe("hace 10 días")
    expect(ago("2026-08-26T12:00:00Z", now)).toBe("hace 3 meses")
    expect(ago(null, now)).toBe("")
  })
  it("empresas iguales sin importar tildes ni mayúsculas, y «sin empresa» al final", () => {
    expect(companyKey("  Nübank ")).toBe(companyKey("NUBANK"))
    const g = groupByCompany(
      [
        { company: null, savedAt: "2026-11-26T00:00:00Z" },
        { company: "Nubank", savedAt: "2026-11-20T00:00:00Z" },
        { company: "NUBANK", savedAt: "2026-11-21T00:00:00Z" },
        { company: "Rappi", savedAt: "2026-11-25T00:00:00Z" },
      ],
      companyKey,
    )
    expect(g.map((x) => [x.name, x.items.length])).toEqual([["Rappi", 1], ["Nubank", 2], ["Sin empresa", 1]])
  })
})
