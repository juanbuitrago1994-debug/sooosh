import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OWNER_KEY, claimLocalData, clearLocalAccountData } from "@/lib/auth/local-data"

describe("datos personales locales", () => {
  const mem = new Map<string, string>()
  const events: string[] = []
  beforeEach(() => {
    mem.clear()
    events.length = 0
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      key: (i: number) => [...mem.keys()][i] ?? null,
      get length() {
        return mem.size
      },
    })
    vi.stubGlobal("sessionStorage", { clear: () => {} })
    vi.stubGlobal("window", { dispatchEvent: (e: { type: string }) => (events.push(e.type), true) })
    vi.stubGlobal("Event", class { constructor(public type: string) {} })
    mem.set("sooosh:perfil-busqueda:v1", "{}")
    mem.set("cv-tailor:history:v1", "[]")
    mem.set("sooosh:correo-datos:v1", "{}")
    mem.set("sooosh:consentimiento:v1", "{}")
    mem.set("sooosh:region", "CO")
  })
  afterEach(() => vi.unstubAllGlobals())

  it("borra CV, historial y datos del correo; conserva consentimiento y región", () => {
    clearLocalAccountData()
    expect([...mem.keys()].sort()).toEqual(["sooosh:consentimiento:v1", "sooosh:region"])
    expect(events).toHaveLength(1)
  })

  it("en silencio (al cerrar sesión) no avisa a la pantalla", () => {
    clearLocalAccountData({ silent: true })
    expect(events).toHaveLength(0)
  })

  it("una cuenta distinta a la dueña borra lo local; la misma cuenta no", () => {
    expect(claimLocalData("ana")).toBe(false) // primera vez: reclama sin borrar (el CV local pasa a ser de Ana)
    expect(mem.has("sooosh:perfil-busqueda:v1")).toBe(true)
    expect(claimLocalData("ana")).toBe(false)
    expect(claimLocalData("luis")).toBe(true)
    expect(mem.has("sooosh:perfil-busqueda:v1")).toBe(false)
    expect(mem.get(OWNER_KEY)).toBe("luis")
  })
})
