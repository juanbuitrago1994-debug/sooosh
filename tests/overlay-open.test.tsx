import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { OPEN_OVERLAY, useAnyOverlayOpen } from "@/lib/use-overlay-open"

describe("useAnyOverlayOpen (ocultar lo flotante mientras hay un panel abierto)", () => {
  it("en el servidor (sin DOM) no hay panel abierto", () => {
    const C = () => <span>{String(useAnyOverlayOpen())}</span>
    expect(renderToStaticMarkup(<C />)).toContain("false")
  })
  it("vigila el atributo que Base UI pone mientras un Dialog/Drawer está abierto", () => {
    expect(OPEN_OVERLAY).toBe('[role="dialog"][data-open]')
  })
  it("el distintivo «Ofertas encontradas» se oculta cuando hay un panel abierto", () => {
    const src = readFileSync(path.join(__dirname, "..", "components/jobs/job-search.tsx"), "utf8")
    expect(src).toMatch(/show=\{shown !== null && jobs !== null && !overlayOpen\}/)
  })
})
