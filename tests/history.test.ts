import { beforeEach, describe, expect, it } from "vitest"
import { addEntry, clearHistory, HISTORY_KEY, MAX_ENTRIES, parseHistory, readRaw, removeEntry, type NewHistoryEntry } from "@/lib/history"
import { cvSchema } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"

class MemStore {
  data = new Map<string, string>()
  getItem(k: string) { return this.data.get(k) ?? null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}

const cv = cvSchema.parse({ header: { fullName: "Ana Zapata" }, summary: "Analista de datos." })
const offer: Offer = { title: "Analista", company: "Globex", language: "es", requirements: ["SQL"], niceToHave: [], responsibilities: [] }
const entry = (over: Partial<NewHistoryEntry> = {}): NewHistoryEntry => ({
  offerText: "Texto de la oferta",
  offer,
  originalCv: cv,
  cv,
  review: { items: [], decisions: {} },
  lang: "es",
  coverageBefore: 40,
  coverageAfter: 70,
  acceptedChanges: 2,
  ...over,
})

let store: MemStore
beforeEach(() => {
  store = new MemStore()
})

describe("historial local", () => {
  it("empieza vacío", () => {
    expect(parseHistory(readRaw(store))).toEqual([])
  })

  it("guarda la oferta, la fecha, la cobertura antes/después y el CV para regenerar el PDF", () => {
    const saved = addEntry(entry(), store, new Date("2026-11-16T20:00:00Z"))!
    const [e] = parseHistory(readRaw(store))
    expect(e).toEqual(saved)
    expect(e.createdAt).toBe("2026-11-16T20:00:00.000Z")
    expect(e.offer.title).toBe("Analista")
    expect([e.coverageBefore, e.coverageAfter]).toEqual([40, 70])
    expect(e.cv.header.fullName).toBe("Ana Zapata")
    expect(e.lang).toBe("es")
  })

  it("lo más reciente va primero", () => {
    addEntry(entry({ offerText: "A" }), store, new Date("2026-01-01"))
    addEntry(entry({ offerText: "B" }), store, new Date("2026-02-01"))
    expect(parseHistory(readRaw(store)).map((e) => e.offerText)).toEqual(["B", "A"])
  })

  it("una adaptación idéntica se actualiza en vez de duplicarse", () => {
    const a = addEntry(entry(), store, new Date("2026-01-01"))!
    const b = addEntry(entry({ lang: "en" }), store, new Date("2026-03-01"))!
    const list = parseHistory(readRaw(store))
    expect(list).toHaveLength(1)
    expect(b.id).toBe(a.id)
    expect(list[0].lang).toBe("en")
    expect(list[0].createdAt).toBe("2026-03-01T00:00:00.000Z")
  })

  it("elimina una entrada y borra todo", () => {
    const a = addEntry(entry({ offerText: "A" }), store)!
    addEntry(entry({ offerText: "B" }), store)
    expect(removeEntry(a.id, store)).toBe(true)
    expect(parseHistory(readRaw(store)).map((e) => e.offerText)).toEqual(["B"])
    clearHistory(store)
    expect(store.getItem(HISTORY_KEY)).toBeNull()
  })

  it("guarda como máximo 50 entradas", () => {
    for (let i = 0; i < MAX_ENTRIES + 5; i++) addEntry(entry({ offerText: `Oferta ${i}` }), store)
    const list = parseHistory(readRaw(store))
    expect(list).toHaveLength(MAX_ENTRIES)
    expect(list[0].offerText).toBe(`Oferta ${MAX_ENTRIES + 4}`)
  })

  it("ignora datos corruptos o de otra versión sin romperse", () => {
    store.setItem(HISTORY_KEY, "{no es json")
    expect(parseHistory(readRaw(store))).toEqual([])
    store.setItem(HISTORY_KEY, JSON.stringify({ no: "lista" }))
    expect(parseHistory(readRaw(store))).toEqual([])
    const good = addEntry(entry(), store)!
    const raw = JSON.parse(store.getItem(HISTORY_KEY)!)
    store.setItem(HISTORY_KEY, JSON.stringify([{ id: "x" }, ...raw, 5]))
    expect(parseHistory(readRaw(store)).map((e) => e.id)).toEqual([good.id])
  })

  it("si el almacenamiento falla (cuota o bloqueado) no lanza y avisa con null/false", () => {
    const broken = { getItem: () => { throw new Error("bloqueado") }, setItem: () => { throw new Error("cuota") }, removeItem: () => { throw new Error("x") } }
    expect(readRaw(broken)).toBeNull()
    expect(addEntry(entry(), broken)).toBeNull()
    expect(removeEntry("x", broken)).toBe(false)
    expect(addEntry(entry(), null)).toBeNull()
  })
})
