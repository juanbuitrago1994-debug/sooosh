import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DropMessage } from "@/components/cv/drop-message"
import { ENTRY_IDLE, describeDrag, entryDropCopy } from "@/lib/profile/cv-drop"

const read = (p: string) => readFileSync(path.join(__dirname, "..", p), "utf8")

describe("mensaje de la pantalla inicial: título de 1 línea, descripción de 2, formatos en insignia", () => {
  const many = describeDrag([1, 2, 3].map(() => ({ kind: "file", type: "application/pdf" })))
  const bad = describeDrag([{ kind: "file", type: "application/zip" }])
  const pdf = describeDrag([{ kind: "file", type: "application/pdf" }])
  const copies = [ENTRY_IDLE, entryDropCopy(null), entryDropCopy(many), entryDropCopy(bad), entryDropCopy(pdf)]

  it("cada título cabe en una línea (≤ 38 caracteres) y cada descripción en dos (≤ 95), en reposo y al arrastrar", () => {
    for (const c of copies) {
      expect(c.title.length, c.title).toBeLessThanOrEqual(38)
      expect(c.description.length, c.description).toBeLessThanOrEqual(95)
      expect(c.description.length, c.description).toBeGreaterThan(40) // explica, no solo etiqueta
    }
  })
  it("la pantalla fuerza 1 línea en el título (truncate) y 2 en la descripción (line-clamp-2), con el alto de dos líneas reservado, en reposo y al arrastrar", () => {
    const src = read("components/wizard/entry-screen.tsx")
    expect(src).toMatch(/const TITLE = "[^"]*truncate/)
    expect(src).toMatch(/const DESCRIPTION = "[^"]*line-clamp-2[^"]*min-h-10/)
    expect(src.match(/className=\{TITLE\}/g)).toHaveLength(2) // reposo + arrastrando
    expect(src.match(/className=\{DESCRIPTION\}/g)).toHaveLength(2)
  })
  it("los formatos van en una insignia redonda (pill) en todos los mensajes de soltar", () => {
    const html = renderToStaticMarkup(<DropMessage title={<p>t</p>} description={<p>d</p>} />)
    expect(html).toContain('data-slot="badge"')
    expect(html).toContain("rounded-4xl")
    expect(html).toContain("PDF, Word o imagen")
    expect(html).not.toContain("<p class=\"text-xs text-muted-foreground\">PDF")
  })
})

describe("el botón del ícono es el cargador mientras no hay nada subido", () => {
  it("con onPick el cuadro del ícono es un botón accesible que abre el selector; sin él, solo el ícono", () => {
    const withPick = renderToStaticMarkup(<DropMessage title={<p>t</p>} description={<p>d</p>} onPick={() => {}} />)
    expect(withPick).toContain('<button')
    expect(withPick).toContain('aria-label="Elegir un archivo de tu equipo"')
    const without = renderToStaticMarkup(<DropMessage title={<p>t</p>} description={<p>d</p>} />)
    expect(without).not.toContain("<button")
  })
  it("solo el mensaje de reposo trae el botón (al arrastrar el aviso no es interactivo) y la página en sí sigue sin ser clicable", () => {
    const src = read("components/wizard/entry-screen.tsx")
    expect(src.match(/onPick=\{open\}/g)).toHaveLength(1)
    expect(src).toContain("inputProps, open")
    const dz = read("components/dropzone.tsx")
    expect(dz).toContain("noClick: true") // la página no es clicable
    expect(dz).toContain("isDragActive, open")
    expect(dz).toMatch(/^\s*open,$/m)
  })
  it("el texto de reposo menciona el botón y no promete «haz clic»", () => {
    expect(ENTRY_IDLE.description).toContain("pulsa el botón")
    expect(ENTRY_IDLE.description).not.toMatch(/clic|toca/i)
  })
})

describe("zona de cancelar al arrastrar: soltar el archivo ahí no sube nada", () => {
  const src = read("components/wizard/entry-screen.tsx")
  const dz = read("components/dropzone.tsx")
  it("aparece abajo, punteada, solo mientras se arrastra (no al subir ni leer) y es decorativa para lectores de pantalla", () => {
    expect(src).toContain("data-cancel-zone")
    expect(src).toMatch(/dragging && !busy && \(\s*<motion\.div\s+data-cancel-zone/)
    expect(src).toContain("border-dashed")
    expect(src).toContain("bottom-6")
    expect(src).toContain("aria-hidden")
    expect(src).toContain("{...cancelZoneProps}")
    expect(src).toContain("motion-safe:transition-colors") // sin transición con «reducir movimiento»
  })
  it("sus textos son claros y el mensaje central explica qué pasará cuando el archivo está encima", () => {
    expect(src).toContain("¿Te equivocaste de archivo?")
    expect(src).toContain("Suéltalo para cancelar")
    expect(src).toContain("Llévalo aquí y no se sube nada.")
    const over = entryDropCopy(null, true)
    expect(over.title).toBe("Cancelar la carga")
    expect(over.description).toContain("no se sube nada")
    expect(over.title.length).toBeLessThanOrEqual(38) // una línea
    expect(over.description.length).toBeLessThanOrEqual(95) // dos líneas
    expect(entryDropCopy(null, false).title).toBe("Suéltalo aquí, ya casi está") // fuera de la zona, igual que siempre
  })
  it("la zona de soltar ignora el archivo si está sobre la zona de cancelar (acepta o rechaza) y avisa de que no se subió nada", () => {
    expect(dz).toContain("cancelRef.current")
    expect(dz.match(/if \(cancelRef\.current\) \{/g)).toHaveLength(2) // onDropAccepted y onDropRejected
    expect(dz).toContain("onCancelDrop?.()")
    expect(dz).toContain("cancelZoneProps")
    expect(dz).toMatch(/onDragEnter: \(e: React\.DragEvent\) => \{\s*e\.preventDefault\(\)\s*setCancel\(true\)/) // preventDefault: el navegador permite soltar ahí
    expect(dz).toContain("onDragLeave: () => setCancel(false)")
    expect(src).toContain("Cancelaste la carga: no se subió nada.")
  })
  it("los hijos de la zona no reciben eventos (así es un solo blanco y no parpadea al pasar por encima del texto)", () => {
    const zone = src.slice(src.indexOf("data-cancel-zone"), src.indexOf("</motion.div>", src.indexOf("data-cancel-zone")))
    expect(zone.match(/pointer-events-none/g)?.length).toBeGreaterThanOrEqual(3) // ícono y dos textos
  })
})
