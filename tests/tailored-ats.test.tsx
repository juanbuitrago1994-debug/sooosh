import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TailoredAts } from "@/components/steps/tailored-ats"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

describe("CV ATS para esta oferta (paso final)", () => {
  it("al inicio ofrece generarlo para la empresa y promete no agregar nada que no esté en el CV", () => {
    const html = renderToStaticMarkup(
      <TailoredAts cv={cvSchema.parse({ header: { fullName: "Ana" } })} offer={offerSchema.parse({ title: "Analista", company: "Globex", language: "es", requirements: [], niceToHave: [], responsibilities: [] })} onGenerated={() => {}} />,
    )
    expect(html).toContain("CV ATS para esta oferta")
    expect(html).toContain("Generar CV ATS para Globex")
    expect(html).toContain("No agrega nada que no esté en tu CV")
  })
})
