import { describe, expect, it, vi } from "vitest"

const postgres = vi.fn(() => ({ end: vi.fn(async () => {}) }) as unknown)
vi.mock("postgres", () => ({ default: (...a: unknown[]) => (postgres as unknown as (...x: unknown[]) => unknown)(...a) }))
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: (c: unknown) => ({ client: c }) }))

describe("conexión a Supabase (pooler de transacciones)", () => {
  it("una sola consulta en vuelo por conexión: encadenar varias deja colgado al pooler", async () => {
    process.env.DATABASE_URL = "postgres://u:p@host:6543/postgres"
    const { getDb, resetDb } = await import("@/lib/db")
    getDb()
    expect(postgres).toHaveBeenCalledTimes(1)
    expect(postgres.mock.calls[0]).toMatchObject({ 1: { prepare: false, max_pipeline: 1 } })
    // se reutiliza mientras no se descarte; `resetDb` fuerza una nueva
    getDb()
    expect(postgres).toHaveBeenCalledTimes(1)
    expect(resetDb()).toBe(true)
    getDb()
    expect(postgres).toHaveBeenCalledTimes(2)
  })
  it("resetDb no recrea si la base con la que falló ya fue reemplazada", async () => {
    const { getDb, resetDb } = await import("@/lib/db")
    const old = getDb()
    resetDb()
    getDb()
    expect(resetDb(old)).toBe(false)
  })
})
