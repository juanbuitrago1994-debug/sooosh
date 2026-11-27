import { readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { API_POLICY, RATE_PER_MINUTE, policyFor } from "@/lib/auth/api-policy"
import { createLimiter } from "@/lib/auth/rate-limit"

/** Rutas reales de `app/api` (cada `route.ts`), como «/api/jobs/[id]/fit». */
function apiRoutes(dir = path.join(process.cwd(), "app/api"), base = "/api"): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...apiRoutes(full, `${base}/${name}`))
    else if (name === "route.ts") out.push(base)
  }
  return out.sort()
}

describe("quién puede llamar a cada ruta de /api", () => {
  it("TODA ruta está en la tabla (agregar una ruta sin decidir su acceso hace fallar esta prueba)", () => {
    const missing = apiRoutes().filter((r) => !API_POLICY.some((p) => p.route === r))
    expect(missing).toEqual([])
  })
  it("la tabla no tiene rutas que ya no existen ni repetidas", () => {
    const real = new Set(apiRoutes())
    expect(API_POLICY.filter((p) => !real.has(p.route)).map((p) => p.route)).toEqual([])
    expect(new Set(API_POLICY.map((p) => p.route)).size).toBe(API_POLICY.length)
  })
  it("lo ÚNICO público es la comprobación de salud", () => {
    expect(API_POLICY.filter((p) => p.access === "publica").map((p) => p.route)).toEqual(["/api/db/health"])
  })
  it("las rutas de administrador de la tabla llaman a requireAdmin (y las demás no la necesitan)", async () => {
    const { readFileSync } = await import("node:fs")
    for (const p of API_POLICY) {
      const file = path.join(process.cwd(), "app", p.route, "route.ts")
      const src = readFileSync(file, "utf8")
      expect(/requireAdmin\(/.test(src), `${p.route}: ${p.access}`).toBe(p.access === "admin")
    }
  })

  it("encuentra la regla de una dirección real; gana la más específica", () => {
    expect(policyFor("/api/db/health")?.access).toBe("publica")
    expect(policyFor("/api/jobs/count")?.access).toBe("sesion") // no se confunde con /api/jobs/[id] (admin)
    expect(policyFor("/api/jobs/3f9d1c0e-aaaa-4bbb-8ccc-0123456789ab")?.access).toBe("admin")
    expect(policyFor("/api/jobs/3f9d1c0e-aaaa-4bbb-8ccc-0123456789ab/fit")?.access).toBe("sesion")
    expect(policyFor("/api/upload")).toMatchObject({ access: "sesion", pesada: true })
    expect(policyFor("/api/no-existe")).toBeUndefined() // sin regla: exige sesión igual (por defecto)
  })
})

describe("límite de peticiones", () => {
  it("deja pasar hasta el máximo en la ventana y avisa cuánto esperar; reinicia al pasar el minuto", () => {
    const hit = createLimiter()
    const t0 = 1_000_000
    for (let i = 0; i < 3; i++) expect(hit("ana", 3, t0 + i).ok).toBe(true)
    const r = hit("ana", 3, t0 + 10_000)
    expect(r).toMatchObject({ ok: false, retryAfterSeconds: 50 })
    expect(hit("luis", 3, t0 + 10_000).ok).toBe(true) // cada persona cuenta aparte
    expect(hit("ana", 3, t0 + 60_001).ok).toBe(true)
  })
  it("las rutas pesadas tienen un tope menor que el general", () => {
    expect(RATE_PER_MINUTE.pesada).toBeLessThan(RATE_PER_MINUTE.general)
  })
})
