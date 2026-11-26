import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import type { Db } from "@/lib/db"
import { createTestDb } from "@/lib/db/testing"
import { MAX_COLLECTIONS, MAX_NOTE, createCollection, deleteCollection, listCollections, moveOffer, removeJobOffer, renameCollection, saveJobAsOffer, savedJobIds, setNote } from "@/lib/tracking/collections"
import { listTrackedOffers, saveTrackedOffer } from "@/lib/tracking/store"
import { offerSchema } from "@/lib/schemas/offer"

const ana = "11111111-1111-4111-8111-111111111111"
const luis = "22222222-2222-4222-8222-222222222222"
const JOB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const JOB_CLOSED = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
type Client = { exec: (q: string) => Promise<unknown> }

describe("categorías, notas y ofertas del buscador", () => {
  let db: Db
  let client: Client
  const offer = (t: string) => offerSchema.parse({ title: t, company: "Acme", language: "es", requirements: ["SQL"], niceToHave: [], responsibilities: ["Analizar datos"] })
  const mine = async () => listTrackedOffers(db, ana)
  beforeEach(async () => {
    db = await createTestDb()
    client = (db as unknown as { $client: Client }).$client
    await client.exec("create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';")
    await client.exec(`insert into auth.users (id) values ('${ana}'), ('${luis}')`)
    // `jobs` real usa pgvector (no disponible en PGlite): versión mínima con las columnas que lee el guardado.
    await client.exec(`create table public.jobs (id uuid primary key, source_url text, source_name text, title text, company text, offer jsonb, posted_at timestamptz, valid_through timestamptz, status text default 'activa', location_text text, remote_scope text)`)
    await client.exec(`insert into public.jobs (id, source_url, source_name, title, company, offer, location_text, status) values
      ('${JOB}', 'https://www.getonbrd.com/jobs/data/analista-acme?utm_source=x', 'getonboard', 'Analista de datos', 'Acme', '${JSON.stringify(offer("Analista de datos"))}', 'Bogotá', 'activa'),
      ('${JOB_CLOSED}', 'https://getonbrd.com/jobs/data/vieja', 'getonboard', 'Vieja', 'Acme', '${JSON.stringify(offer("Vieja"))}', null, 'cerrada')`)
    for (const f of ["0018_tracked_offers.sql", "0019_collections_notes.sql"]) await client.exec(readFileSync(path.join(process.cwd(), "db/migrations", f), "utf8"))
  })

  it("crea, renombra y valida categorías (nombre único sin distinguir mayúsculas, máximo 20)", async () => {
    const a = await createCollection(db, ana, "  Plan   B ")
    expect(a).toHaveProperty("id")
    expect((await listCollections(db, ana)).map((c) => c.name)).toEqual(["Plan B"])
    expect(await createCollection(db, ana, "plan b")).toEqual({ error: "duplicate" })
    expect(await createCollection(db, ana, "   ")).toEqual({ error: "invalid" })
    expect(await createCollection(db, luis, "Plan B")).toHaveProperty("id") // otra persona sí puede
    const id = (a as { id: string }).id
    expect(await renameCollection(db, ana, id, "Startups")).toEqual({ id })
    expect(await renameCollection(db, luis, id, "Robada")).toEqual({ error: "invalid" })
    for (let i = 0; i < MAX_COLLECTIONS - 1; i++) await createCollection(db, ana, `Cat ${i}`)
    expect(await createCollection(db, ana, "una más")).toEqual({ error: "limit" })
  })

  it("mover una oferta: solo entre cosas propias; borrar la categoría deja las ofertas «sin categoría»", async () => {
    const o = (await saveTrackedOffer(db, ana, { url: "https://empresa.com/e/1", offer: offer("A"), text: "t" })) as { id: string }
    const mineCat = (await createCollection(db, ana, "Plan B")) as { id: string }
    const luisCat = (await createCollection(db, luis, "Suya")) as { id: string }
    expect(await moveOffer(db, ana, o.id, luisCat.id)).toBe(false) // categoría ajena
    expect(await moveOffer(db, luis, o.id, luisCat.id)).toBe(false) // oferta ajena
    expect(await moveOffer(db, ana, o.id, mineCat.id)).toBe(true)
    expect((await mine())[0].collectionId).toBe(mineCat.id)
    expect(await deleteCollection(db, luis, mineCat.id)).toBe(false)
    expect(await deleteCollection(db, ana, mineCat.id)).toBe(true)
    const after = await mine()
    expect(after).toHaveLength(1) // la oferta NO se borró
    expect(after[0].collectionId).toBeNull()
  })

  it("notas: se recortan, se pueden vaciar y no se escriben en ofertas ajenas", async () => {
    const o = (await saveTrackedOffer(db, ana, { url: "https://empresa.com/e/1", offer: offer("A"), text: "t" })) as { id: string }
    expect(await setNote(db, ana, o.id, "  Hablar con María  ")).toBe(true)
    expect((await mine())[0].note).toBe("Hablar con María")
    expect(await setNote(db, luis, o.id, "intruso")).toBe(false)
    await setNote(db, ana, o.id, "x".repeat(MAX_NOTE + 50))
    expect((await mine())[0].note).toHaveLength(MAX_NOTE)
    await setNote(db, ana, o.id, "   ")
    expect((await mine())[0].note).toBeNull()
  })

  it("guardar una oferta del buscador: copia completa, sin duplicar, y se puede quitar", async () => {
    const r = await saveJobAsOffer(db, ana, JOB)
    expect(r).toMatchObject({ created: true })
    const o = (await mine())[0]
    expect(o).toMatchObject({ title: "Analista de datos", company: "Acme", origin: "buscador", jobId: JOB, status: "sin_verificar" })
    expect(o.text).toContain("Analizar datos") // el texto sale de lo ya extraído
    expect(o.offer.requirements).toEqual(["SQL"])
    expect(await saveJobAsOffer(db, ana, JOB)).toMatchObject({ created: false })
    expect(await mine()).toHaveLength(1)
    expect(await savedJobIds(db, ana)).toEqual([JOB])
    expect(await savedJobIds(db, luis)).toEqual([])
    expect(await removeJobOffer(db, ana, JOB)).toBe(true)
    expect(await mine()).toHaveLength(0)
    expect(await saveJobAsOffer(db, ana, "cccccccc-cccc-4ccc-8ccc-cccccccccccc")).toEqual({ error: "not_found" })
  })

  it("una oferta que el buscador ya cerró entra como finalizada", async () => {
    await saveJobAsOffer(db, ana, JOB_CLOSED)
    const o = (await mine())[0]
    expect(o.status).toBe("finalizada")
    expect(o.closedDetectedAt).not.toBeNull()
  })

  it("si la persona ya la tenía por enlace, se enlaza con la del buscador en vez de duplicarse", async () => {
    await saveTrackedOffer(db, ana, { url: "https://getonbrd.com/jobs/data/analista-acme", offer: offer("Analista de datos"), text: "texto del enlace" })
    const r = await saveJobAsOffer(db, ana, JOB)
    expect(r).toMatchObject({ created: false })
    const list = await mine()
    expect(list).toHaveLength(1)
    expect(list[0].jobId).toBe(JOB)
    expect(list[0].text).toBe("texto del enlace") // conserva el texto original
  })
})
