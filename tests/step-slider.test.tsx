import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { StepSlider } from "@/components/step-slider"

const options = [
  { value: "a", label: "Corto", hint: "Unas 2 frases." },
  { value: "b", label: "Medio", hint: "3 o 4 frases." },
  { value: "c", label: "Largo", hint: "5 o 6 frases." },
]

describe("StepSlider", () => {
  it("muestra el campo, el paso actual, los dos extremos y la explicación del paso", () => {
    const html = renderToStaticMarkup(<StepSlider label="Longitud" options={options} value="b" onValueChange={() => {}} />)
    expect(html).toContain("Longitud")
    expect(html).toContain("Medio")
    expect(html).toContain("Corto")
    expect(html).toContain("Largo")
    expect(html).toContain("3 o 4 frases.")
    expect(html).not.toContain("Unas 2 frases.")
  })
  it("es un slider (grupo accesible) con una sola bolita", () => {
    const html = renderToStaticMarkup(<StepSlider label="Longitud" options={options} value="c" onValueChange={() => {}} />)
    expect(html).toContain('data-slot="step-slider"')
    expect(html).toContain('role="group"')
    expect((html.match(/data-index="/g) ?? []).length).toBe(1)
  })
  it("un valor desconocido cae en el primer paso", () => {
    const html = renderToStaticMarkup(<StepSlider label="Longitud" options={options} value="zzz" onValueChange={() => {}} />)
    expect(html).toContain(">Corto</span>")
    expect(html).toContain("Unas 2 frases.")
  })
  it("dibuja una marca por paso", () => {
    const html = renderToStaticMarkup(<StepSlider label="Longitud" options={options} value="a" onValueChange={() => {}} />)
    expect((html.match(/size-1 rounded-full/g) ?? []).length).toBe(3)
  })
})
