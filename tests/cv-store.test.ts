import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import type { Db } from "@/lib/db"
import { createTestDb } from "@/lib/db/testing"
import { MAX_SAVED_CVS, deactivateActiveCv, getActiveCv, listCvs, saveValidatedCv, type StoredCv } from "@/lib/cv-store/store"
import { cvSchema } from "@/lib/schemas/cv"

const ana = "11111111-1111-4111-8111-111111111111"
const luis = "22222222-2222-4222-8222-222222222222"

const cv = (name: string) => cvSchema.parse({ header: { fullName: name }, summary: "Resumen", experience: [], education: [], skills: [], languages: [] })
const stored = (name: string, o: Partial<StoredCv> = {}): StoredCv => ({ cv: cv(name), label: name, validatedAt: "2026-11-26T10:00:00.000Z", ...o })

describe("CV validados de la cuenta", () => {
  let db: Db
  beforeEach(async () => {
    db = await createTestDb()
    const client = (db as unknown as { $client: { exec: (q: string) => Promise<unknown> } }).$client
    // Supabase Auth no existe en PGlite: un `auth.users` mínimo y `auth.uid()` para que corra la migración tal cual.
    await client.exec("create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';")
    await client.exec(`insert into auth.users (id) values ('${ana}'), ('${luis}')`)
    await client.exec(readFileSync(path.join(process.cwd(), "db/migrations/0017_cvs.sql"), "utf8"))
  })

  it("guarda y devuelve el CV activo con su archivo y fecha", async () => {
    await saveValidatedCv(db, ana, stored("Ana", { file: { name: "ana.pdf", type: "PDF", size: 1200, readMs: 3000 }, originalAts: { percent: 80, label: "casi", labelText: "Casi listo" }, fileId: "f1" }))
    const r = await getActiveCv(db, ana)
    expect(r?.cv.header.fullName).toBe("Ana")
    expect(r?.file).toEqual({ name: "ana.pdf", type: "PDF", size: 1200, readMs: 3000 })
    expect(r?.originalAts?.percent).toBe(80)
    expect(r?.fileId).toBe("f1")
    expect(r?.validatedAt).toBe("2026-11-26T10:00:00.000Z")
  })

  it("el mismo archivo corregido actualiza la fila; otro archivo manda el anterior al historial", async () => {
    await saveValidatedCv(db, ana, stored("Ana v1", { fileId: "f1" }))
    await saveValidatedCv(db, ana, stored("Ana v2", { fileId: "f1", validatedAt: "2026-11-27T10:00:00.000Z" }))
    expect(await listCvs(db, ana)).toHaveLength(1)
    expect((await getActiveCv(db, ana))?.cv.header.fullName).toBe("Ana v2")

    await saveValidatedCv(db, ana, stored("Ana otro", { fileId: "f2" }))
    const all = await listCvs(db, ana)
    expect(all).toHaveLength(2)
    expect(all.filter((x) => x.isActive)).toHaveLength(1)
    expect((await getActiveCv(db, ana))?.label).toBe("Ana otro")
  })

  it("cada persona ve solo lo suyo", async () => {
    await saveValidatedCv(db, ana, stored("Ana"))
    expect(await getActiveCv(db, luis)).toBeNull()
    await saveValidatedCv(db, luis, stored("Luis"))
    expect((await getActiveCv(db, ana))?.label).toBe("Ana")
    expect((await getActiveCv(db, luis))?.label).toBe("Luis")
  })

  it("al cambiar de CV no queda ninguno activo, pero el historial se conserva", async () => {
    await saveValidatedCv(db, ana, stored("Ana", { fileId: "f1" }))
    await deactivateActiveCv(db, ana)
    expect(await getActiveCv(db, ana)).toBeNull()
    expect(await listCvs(db, ana)).toHaveLength(1)
  })

  it("recorta el historial al máximo y conserva el activo", async () => {
    for (let i = 0; i < MAX_SAVED_CVS + 3; i++) await saveValidatedCv(db, ana, stored(`Ana ${i}`, { fileId: `f${i}` }))
    const all = await listCvs(db, ana)
    expect(all).toHaveLength(MAX_SAVED_CVS)
    expect((await getActiveCv(db, ana))?.label).toBe(`Ana ${MAX_SAVED_CVS + 2}`)
  })
})
