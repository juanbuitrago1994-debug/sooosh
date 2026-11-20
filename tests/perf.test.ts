import { describe, expect, it } from "vitest"
import { cacheEnabled, getCached, LOGIC_VERSION, putCached, sha256, versionFor } from "@/lib/cache/results"
import { createCacheDb } from "@/lib/db/cache"
import { DEFAULT_KEEP_ALIVE, DEFAULT_NUM_CTX } from "@/lib/ai/ollama"
import { mapWithLimit } from "@/lib/util/pool"
import { headingKind } from "@/lib/cv/sections"

describe("caché de resultados por huella", () => {
  it("la huella es el hash del contenido; el mismo contenido da la misma clave", () => {
    expect(sha256("abc")).toBe(sha256("abc"))
    expect(sha256("abc")).not.toBe(sha256("abd"))
    expect(sha256(new Uint8Array([1, 2, 3]))).toHaveLength(64)
  })
  it("acierta con la misma versión y falla con otra versión o otra clave", async () => {
    const db = await createCacheDb(":memory:")
    const v = versionFor("cv", "modelo-a")
    expect(await getCached(db, "cv:1", "cv", v)).toBeNull()
    await putCached(db, "cv:1", "cv", v, { cv: { nombre: "Ana" } })
    expect(await getCached(db, "cv:1", "cv", v)).toEqual({ cv: { nombre: "Ana" } })
    expect(await getCached(db, "cv:2", "cv", v)).toBeNull() // otro archivo
    expect(await getCached(db, "cv:1", "cv", versionFor("cv", "modelo-b"))).toBeNull() // otro modelo
  })
  it("volver a guardar la misma clave actualiza (no duplica)", async () => {
    const db = await createCacheDb(":memory:")
    const v = versionFor("offer", "m")
    await putCached(db, "offer:1", "offer", v, { a: 1 })
    await putCached(db, "offer:1", "offer", v, { a: 2 })
    expect(await getCached(db, "offer:1", "offer", v)).toEqual({ a: 2 })
  })
  it("la versión incluye modelo, prompts, esquemas y lógica; cv y oferta no se mezclan", () => {
    const cv = versionFor("cv", "m")
    expect(cv).toMatch(/^m\|p[0-9a-f]{8}\|s[0-9a-f]{8}\|l\d+$/)
    expect(cv).toContain(`|l${LOGIC_VERSION}`)
    expect(versionFor("offer", "m")).not.toBe(cv)
    expect(versionFor("cv", "m2")).not.toBe(cv)
  })
  it("las pruebas corren con la caché apagada", () => {
    expect(cacheEnabled()).toBe(false)
  })
})

describe("rendimiento: configuración medida", () => {
  it("un único num_ctx (cambiarlo recarga el modelo y pierde la caché de prefijo) y keep_alive de 60 min", () => {
    expect(DEFAULT_NUM_CTX).toBe(8192)
    expect(DEFAULT_KEEP_ALIVE).toBe("60m")
  })
  it("el OCR/paralelismo respeta el límite y conserva el orden", async () => {
    let running = 0
    let peak = 0
    const out = await mapWithLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running--
      return n * 10
    })
    expect(out).toEqual([10, 20, 30, 40, 50, 60])
    expect(peak).toBe(2)
  })
  it("encabezados con errores de OCR se reconocen (evita el método clásico de ~50 s)", () => {
    expect(headingKind("EXPERTENCIA")?.kind).toBe("experience")
  })
})
