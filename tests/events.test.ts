import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { eq } from "drizzle-orm"
import { events } from "@/lib/db/schema"
import { createTestDb } from "@/lib/db/testing"
import type { Db } from "@/lib/db"
import { personalize, MIN_SIGNALS } from "@/lib/events/personalize"
import { eraseUser, ingestEvents, latestConsent, purgeOld, recordConsent, trendingSearches } from "@/lib/events/server"
import { CONSENT_VERSION, cleanEvent, sanitizeQuery } from "@/lib/events/types"

const J1 = "11111111-1111-4111-8111-111111111111"
const U = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`

describe("texto de búsqueda que se puede guardar", () => {
  it("normaliza: minúsculas, sin tildes, espacios simples", () => {
    expect(sanitizeQuery("  Diseñador   UX  ")).toBe("disenador ux")
    expect(sanitizeQuery("Python")).toBe("python")
  })
  it("descarta lo que parece un dato personal", () => {
    for (const q of ["ana.perez@gmail.com", "mi cv https://ana.dev", "www.miweb.com", "llamar 3001234567", "cc 1020304050", "300 123 4567", "a", "x".repeat(61), "soy juan perez de bogota y busco trabajo urgente en diseno"]) expect(sanitizeQuery(q), q).toBeNull()
    expect(sanitizeQuery(null)).toBeNull()
  })
})

describe("evento limpio: lista cerrada de campos", () => {
  it("deja solo los campos de su tipo y sanea el texto", () => {
    const e = cleanEvent({ kind: "search", payload: { region: "CO", area: "tecnologia", sort: "relevancia", onlyMatches: false, q: "Diseñador UX", results: 12, email: "x@y.co", cv: "texto del cv" } })!
    expect(e.payload).toEqual({ region: "CO", area: "tecnologia", sort: "relevancia", onlyMatches: false, q: "disenador ux", results: 12 })
  })
  it("una búsqueda con un dato personal se guarda sin texto", () => {
    const e = cleanEvent({ kind: "search", payload: { region: "CO", area: "todas", sort: "relevancia", onlyMatches: false, q: "ana@correo.com", results: 3 } })!
    expect(e.payload.q).toBeNull()
  })
  it("rechaza tipos desconocidos y cargas inválidas", () => {
    expect(cleanEvent({ kind: "cv_text", payload: { texto: "x" } })).toBeNull()
    expect(cleanEvent({ kind: "open", payload: { jobId: "no-es-uuid" } })).toBeNull()
    expect(cleanEvent({ kind: "apply_click", payload: { jobId: J1, method: "otro" } })).toBeNull()
    expect(cleanEvent({ kind: "open", payload: { jobId: J1, position: 2, score: 80, match: true } })).toEqual({ kind: "open", payload: { jobId: J1, position: 2, score: 80, match: true } })
  })
})

describe("registro en el servidor (solo con consentimiento)", () => {
  let db: Db
  beforeEach(async () => {
    db = await createTestDb()
  })
  const ev = (n = 1) => Array.from({ length: n }, () => ({ kind: "open", payload: { jobId: J1, extra: "no" } }))

  it("sin consentimiento registrado no guarda nada", async () => {
    expect(await ingestEvents(db, U(1), ev())).toEqual({ error: "sin_consentimiento" })
    expect((await db.select().from(events)).length).toBe(0)
  })
  it("con «Para mí» guarda los eventos limpios y marca para qué sirven", async () => {
    await recordConsent(db, { anonId: U(1), personal: true, aggregate: false })
    expect(await ingestEvents(db, U(1), [...ev(2), { kind: "malo", payload: {} }])).toEqual({ stored: 2, rejected: 1 })
    const rows = await db.select().from(events)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ kind: "open", personal: true, aggregate: false, payload: { jobId: J1 } })
    expect(JSON.stringify(rows[0].payload)).not.toContain("extra")
  })
  it("la última decisión manda: retirar el permiso detiene el registro", async () => {
    await recordConsent(db, { anonId: U(2), personal: true, aggregate: true })
    expect(await latestConsent(db, U(2))).toEqual({ personal: true, aggregate: true, version: CONSENT_VERSION })
    await recordConsent(db, { anonId: U(2), personal: false, aggregate: false })
    expect(await ingestEvents(db, U(2), ev())).toEqual({ error: "sin_consentimiento" })
  })
  it("limita a 300 eventos por hora por identificador", async () => {
    await recordConsent(db, { anonId: U(3), personal: true, aggregate: false })
    expect(await ingestEvents(db, U(3), ev(50))).toMatchObject({ stored: 50 })
    for (let i = 0; i < 5; i++) await ingestEvents(db, U(3), ev(50))
    expect(await ingestEvents(db, U(3), ev(50))).toEqual({ error: "demasiados" })
  })
  it("«Borrar mis datos» elimina eventos y consentimientos de ese identificador y de nadie más", async () => {
    await recordConsent(db, { anonId: U(4), personal: true, aggregate: false })
    await recordConsent(db, { anonId: U(5), personal: true, aggregate: false })
    await ingestEvents(db, U(4), ev(3))
    await ingestEvents(db, U(5), ev(2))
    expect(await eraseUser(db, U(4))).toEqual({ events: 3 })
    expect(await latestConsent(db, U(4))).toBeNull()
    expect((await db.select().from(events)).length).toBe(2)
  })
  it("los eventos de más de 90 días se borran", async () => {
    await db.insert(events).values([
      { anonId: U(6), kind: "open", payload: { jobId: J1 }, personal: true, at: new Date(Date.now() - 100 * 86_400_000).toISOString() },
      { anonId: U(6), kind: "open", payload: { jobId: J1 }, personal: true },
    ])
    expect(await purgeOld(db, true)).toBe(1)
    expect((await db.select().from(events).where(eq(events.anonId, U(6)))).length).toBe(1)
  })
  it("las búsquedas populares exigen 5 personas distintas con «Para todos»", async () => {
    const search = (n: number, q: string, aggregate: boolean) => ({ anonId: U(100 + n), kind: "search", payload: { region: "CO", q }, personal: !aggregate, aggregate })
    await db.insert(events).values([
      ...[1, 2, 3, 4, 5].map((n) => search(n, "disenador ux", true)), // 5 distintas → sale
      ...[6, 7, 8, 9].map((n) => search(n, "python", true)), // solo 4 → no sale
      ...[10, 11, 12, 13, 14].map((n) => search(n, "react", false)), // 5, pero sin «Para todos» → no sale
      ...[1, 1, 1, 1, 1].map((n) => search(n, "sql", true)), // 5 búsquedas de UNA persona → no sale
    ])
    expect(await trendingSearches(db, "CO")).toEqual([{ q: "disenador ux", users: 5 }])
    expect(await trendingSearches(db, "MX")).toEqual([])
  })
})

describe("orden según lo que la persona hace (suave)", () => {
  const jobs = ["a", "b", "c", "d"].map((id, i) => ({ id, roleFamily: i < 2 ? "ventas" : "diseno-digital", company: i === 3 ? "Acme" : "Otra" }))
  it("sin señales suficientes no cambia nada", () => {
    expect(personalize(jobs, [{ family: "diseno-digital", company: null, kind: "open", n: MIN_SIGNALS - 1 }])).toBe(jobs)
  })
  it("sube lo que abre, guarda o aplica, y baja lo que descarta", () => {
    const up = personalize(jobs, [{ family: "diseno-digital", company: "Acme", kind: "apply_click", n: 2 }, { family: "ventas", company: null, kind: "dismiss", n: 1 }])
    // El gusto ajusta, no manda: sube el diseño (lo que aplicó) sobre las ventas (lo que descartó), pero «a» (relevante y de ventas) sigue sobre «d».
    expect(up.map((j) => j.id)).toEqual(["c", "a", "d", "b"])
  })
  it("el orden de relevancia pesa más que el gusto: una oferta muy abajo no pasa al primer lugar por una sola señal", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: "j" + i, roleFamily: i === 19 ? "diseno-digital" : "ventas", company: null as string | null }))
    const out = personalize(many, [{ family: "diseno-digital", company: null, kind: "open", n: 3 }])
    expect(out[0].id).toBe("j0")
  })
})

describe("consentimiento en el navegador", () => {
  const mem = new Map<string, string>()
  const fetchMock = vi.fn()
  beforeEach(() => {
    mem.clear()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) })
    vi.stubGlobal("window", { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} })
    vi.stubGlobal("Event", class {})
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("crypto", { randomUUID: () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  const load = () => import("@/lib/events/consent")

  it("se pregunta después de la primera búsqueda; cerrar vuelve a preguntar una vez a la semana y luego no insiste", async () => {
    const c = await load()
    expect(c.shouldAsk(c.getConsent())).toBe(false) // antes de buscar
    c.markFirstSearch()
    expect(c.shouldAsk(c.getConsent())).toBe(true)
    c.dismissAsk()
    expect(c.shouldAsk(c.getConsent())).toBe(false) // en pausa
    vi.setSystemTime(Date.now() + 8 * 86_400_000)
    expect(c.shouldAsk(c.getConsent())).toBe(true) // una vez más
    c.dismissAsk()
    vi.setSystemTime(Date.now() + 30 * 86_400_000)
    expect(c.shouldAsk(c.getConsent())).toBe(false) // ya no insiste
  })
  it("sin consentimiento, track no envía NADA", async () => {
    const c = await load()
    c.track("open", { jobId: J1 })
    await vi.advanceTimersByTimeAsync(3000)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("«Solo lo necesario» no crea identificador ni llama al servidor", async () => {
    const c = await load()
    expect(await c.decide(false, false)).toBe(true)
    expect(c.getConsent()).toMatchObject({ personal: false, aggregate: false, anonId: null })
    c.track("open", { jobId: J1 })
    await vi.advanceTimersByTimeAsync(3000)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("aceptar crea el identificador, registra el permiso en el servidor y desde ahí se envían eventos en lote", async () => {
    const c = await load()
    expect(await c.decide(true, true)).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith("/api/consent", expect.objectContaining({ method: "POST" }))
    expect(c.getConsent().anonId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
    c.track("open", { jobId: J1 })
    c.track("save", { jobId: J1, saved: true })
    await vi.advanceTimersByTimeAsync(2000)
    const call = fetchMock.mock.calls.find((x) => x[0] === "/api/events")!
    const body = JSON.parse(call[1].body)
    expect(body.anonId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
    expect(body.events.map((e: { kind: string }) => e.kind)).toEqual(["open", "save"])
  })
  it("si el servidor no pudo registrar el permiso, la medición NO se activa", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 })
    const c = await load()
    expect(await c.decide(true, false)).toBe(false)
    expect(c.consentActive(c.getConsent())).toBe(false)
  })
  it("retirar el permiso se avisa al servidor y apaga el envío; borrar mis datos limpia el navegador", async () => {
    const c = await load()
    await c.decide(true, true)
    await c.decide(false, false)
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toMatchObject({ personal: false, aggregate: false })
    c.track("open", { jobId: J1 })
    await vi.advanceTimersByTimeAsync(3000)
    expect(fetchMock.mock.calls.filter((x) => x[0] === "/api/events")).toHaveLength(0)
    expect(await c.eraseMyData()).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith("/api/events", expect.objectContaining({ method: "DELETE" }))
    expect(c.getConsent().anonId).toBeNull()
  })
})
