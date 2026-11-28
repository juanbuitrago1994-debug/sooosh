import { beforeEach, describe, expect, it } from "vitest"
import { createTestDb } from "@/lib/db/testing"
import { effective, listCatalog, setSourceActive, setSourceCadence } from "@/lib/sources/catalog"
import { stateOf } from "@/lib/sources/status"
import { TARGETS } from "@/lib/sources/schedule"
import type { Db } from "@/lib/db"

describe("catálogo de fuentes (tabla sources)", () => {
  let db: Db
  beforeEach(async () => {
    db = await createTestDb()
  })

  it("la migración siembra las 8 fuentes del código, con atribución y sitio cuando lo tienen", async () => {
    const rows = await listCatalog(db)
    expect(rows.map((r) => r.key).sort()).toEqual(TARGETS.map((t) => t.id).sort())
    const himalayas = rows.find((r) => r.key === "remote:himalayas")!
    expect(himalayas).toMatchObject({ kind: "Remotas", homeUrl: "https://himalayas.app", active: true, cadenceHours: null })
    expect(himalayas.attribution).toContain("Himalayas")
    expect(rows.find((r) => r.key === "companies")!.homeUrl).toBeNull()
    expect(rows.every((r) => r.attribution.length > 10 && r.description.length > 10)).toBe(true)
  })

  it("pausar y reanudar una fuente; una clave que no existe devuelve false", async () => {
    expect(await setSourceActive(db, "remote:jobicy", false)).toBe(true)
    expect((await listCatalog(db)).find((r) => r.key === "remote:jobicy")!.active).toBe(false)
    expect(await setSourceActive(db, "remote:jobicy", true)).toBe(true)
    expect(await setSourceActive(db, "no-existe", false)).toBe(false)
  })

  it("cadencia propia entre 1 y 168 h (fuera de rango se rechaza) y null vuelve a la del código", async () => {
    expect(await setSourceCadence(db, "getonboard", 6)).toBe(true)
    expect((await listCatalog(db)).find((r) => r.key === "getonboard")!.cadenceHours).toBe(6)
    expect(await setSourceCadence(db, "getonboard", 0)).toBe(false)
    expect(await setSourceCadence(db, "getonboard", 169)).toBe(false)
    expect(await setSourceCadence(db, "getonboard", 1.5)).toBe(false)
    expect(await setSourceCadence(db, "getonboard", null)).toBe(true)
    expect((await listCatalog(db)).find((r) => r.key === "getonboard")!.cadenceHours).toBeNull()
  })

  it("la cadencia efectiva usa la propia si existe, y sin fila todo sigue como en el código", async () => {
    await setSourceCadence(db, "portal:trabajando", 24)
    const rows = await listCatalog(db)
    expect(effective(rows.find((r) => r.key === "portal:trabajando"), 12)).toEqual({ everyHours: 24, active: true })
    expect(effective(undefined, 3)).toEqual({ everyHours: 3, active: true })
    await setSourceActive(db, "portal:trabajando", false)
    expect(effective((await listCatalog(db)).find((r) => r.key === "portal:trabajando"), 12).active).toBe(false)
  })

  it("una fuente pausada se muestra «off» y nunca como atrasada", () => {
    expect(stateOf({ active: false, failing: false, stale: false, lastError: null, lastOkAt: "2026-11-20T10:00:00Z" })).toBe("off")
    expect(stateOf({ active: true, failing: false, stale: true, lastError: null, lastOkAt: "2026-11-20T10:00:00Z" })).toBe("late")
  })

  it("la tabla no es legible por anónimos (RLS activa y sin permisos)", async () => {
    const res = await (db as unknown as { execute: (q: unknown) => Promise<{ rows: { relrowsecurity: boolean }[] }> }).execute((await import("drizzle-orm")).sql`select relrowsecurity from pg_class where relname = 'sources'`)
    expect(res.rows[0].relrowsecurity).toBe(true)
  })
})
