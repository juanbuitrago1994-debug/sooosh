import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) => readFileSync(p, "utf8")

describe("solo tema oscuro (decisión de Juan, 24-nov-2026)", () => {
  it("el proveedor fuerza el tema oscuro y no sigue el del sistema; <html> ya lleva la clase dark", () => {
    const p = read("components/theme-provider.tsx")
    expect(p).toContain('forcedTheme="dark"')
    expect(p).toContain("enableSystem={false}")
    expect(read("app/layout.tsx")).toMatch(/\} dark h-full/)
    expect(read("app/layout.tsx")).toContain('colorScheme: "dark"')
  })
  it("ya no existe el interruptor de tema ni se usa en ninguna cabecera", () => {
    expect(existsSync("components/theme-toggle.tsx")).toBe(false)
    for (const f of ["components/wizard/app-header.tsx", "components/jobs/job-search.tsx", "components/jobs/job-detail.tsx", "components/jobs/jobs-admin.tsx"]) {
      expect(read(f), f).not.toMatch(/ThemeToggle|theme-toggle/)
    }
  })
})
