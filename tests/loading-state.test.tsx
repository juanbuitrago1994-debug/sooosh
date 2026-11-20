import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LoadingState } from "@/components/ai/loading-state"

describe("cargador con frases (reemplaza a los esqueletos)", () => {
  const html = renderToStaticMarkup(<LoadingState messages={["Buscando…", "Ordenando…"]} />)
  it("muestra la matriz de puntos de referencia (16 puntos, tamaño lg) y la primera frase", () => {
    expect(html).toContain('data-size="lg"')
    expect((html.match(/rounded-xs/g) ?? []).length).toBe(16)
    expect(html).toContain("Buscando…")
  })
  it("se anuncia una sola vez (status + aria-live) y la frase animada es decorativa", () => {
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('class="sr-only">Buscando…')
    expect(html).toContain('aria-hidden="true"')
  })
  it("ya no quedan esqueletos en las pantallas del buscador", async () => {
    const { readFileSync } = await import("node:fs")
    for (const f of ["components/jobs/job-search.tsx", "components/jobs/sources-status.tsx", "app/ofertas/[id]/page.tsx"]) expect(readFileSync(f, "utf8"), f).not.toContain("Skeleton")
  })
})
