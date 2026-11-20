import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { TOKENS, token } from "@/lib/design-tokens"

describe("tokens de diseño", () => {
  const doc = readFileSync("docs/DESIGN-TOKENS.md", "utf8")
  it("cada token de código está documentado con sus mismas clases", () => {
    for (const [name, classes] of Object.entries(TOKENS)) {
      expect(doc, `token ${name} sin documentar`).toContain(`\`${name}\``)
      expect(doc, `clases de ${name} desactualizadas en docs/DESIGN-TOKENS.md`).toContain(`\`${classes}\``)
    }
  })
  it("sin valores arbitrarios de Tailwind (corchetes) en ningún token", () => {
    for (const classes of Object.values(TOKENS)) expect(classes).not.toMatch(/\[|\]/)
  })
  it("el título de portada es más pequeño y más cerrado que antes, y la pila más junta", () => {
    expect(token("hero-title")).toContain("tracking-tighter")
    expect(token("hero-title")).toContain("text-2xl")
    expect(token("hero-subtitle")).toContain("text-sm")
    expect(token("hero-stack")).toContain("gap-1.5")
  })
})
