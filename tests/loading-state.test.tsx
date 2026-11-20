import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LoadingState } from "@/components/ai/loading-state"

describe("cargador con frases (reemplaza a los esqueletos)", () => {
  const html = renderToStaticMarkup(<LoadingState messages={["Buscando…", "Ordenando…"]} />)
  it("muestra el cargador de referencia (4×4 puntos de 2 px con 2 px de separación = 14 px) y la primera frase", () => {
    expect(html).toContain('data-variant="twinkle"')
    expect(html).toContain("size-3.5")
    expect(html).toContain("gap-0.5")
    expect((html.match(/class="size-0\.5 bg-current"/g) ?? []).length).toBe(16)
    expect(html).toContain("Buscando…")
  })
  it("el cargador y la frase van siempre alineados en horizontal (fila), nunca uno debajo del otro", () => {
    expect(html).toContain("flex items-center justify-center gap-3")
    expect(html).not.toContain("flex-col")
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
