import { describe, expect, it } from "vitest"
import { fullHeadline, normalizeHeadline, splitHeadline } from "@/lib/cv/headline"
import { emptyCv, mergeCv } from "@/lib/cv/merge"
import { heuristicIdentity } from "@/lib/cv/pipeline"
import type { CV } from "@/lib/schemas/cv"

const JUAN = "Semi Senior Product Designer | Estrategia de Producto | Design Systems | UX Research | Figma"

describe("título profesional y titulares", () => {
  it("reparte el titular con barras: el primer trozo es el título y el resto, los titulares", () => {
    expect(splitHeadline(JUAN)).toEqual({ headline: "Semi Senior Product Designer", taglines: ["Estrategia de Producto", "Design Systems", "UX Research", "Figma"] })
  })
  it("no parte lo que no es una lista: una sola frase, «UX/UI» ni trozos largos", () => {
    expect(splitHeadline("Contadora")).toEqual({ headline: "Contadora", taglines: [] })
    expect(splitHeadline("UX/UI Designer")).toEqual({ headline: "UX/UI Designer", taglines: [] })
    const largo = `Diseñadora ${"muy ".repeat(25)}experimentada | Figma`
    expect(splitHeadline(largo).taglines).toEqual([])
    expect(splitHeadline(undefined)).toEqual({ headline: undefined, taglines: [] })
  })
  it("también separa con «•» y «·»", () => {
    expect(splitHeadline("Data Analyst • SQL • Power BI").taglines).toEqual(["SQL", "Power BI"])
    expect(splitHeadline("Data Analyst · SQL").headline).toBe("Data Analyst")
  })
  it("no pierde nada: el titular completo se reconstruye igual al original", () => {
    expect(fullHeadline(splitHeadline(JUAN) as CV["header"])).toBe(JUAN)
  })
  it("tu encabezado real: la heurística lo encuentra y se reparte", () => {
    const head = ["Juan Buitrago", "", JUAN, "", "Bogotá, Colombia | +57 319 220 0959 | juanbuitrago1994@outlook.com"].join("\n")
    const id = heuristicIdentity(head)
    expect(splitHeadline(id.headline).headline).toBe("Semi Senior Product Designer")
  })
  it("un CV guardado con todo en el titular se reparte al abrirlo; si ya hay titulares no se toca", () => {
    const old = { ...emptyCv(), header: { fullName: "Juan", headline: JUAN, links: [], taglines: [] } }
    const n = normalizeHeadline(old)
    expect(n.header.headline).toBe("Semi Senior Product Designer")
    expect(n.header.taglines).toHaveLength(4)
    const mine = { ...old, header: { ...old.header, headline: "Mi título", taglines: ["Mío"] } }
    expect(normalizeHeadline(mine).header).toEqual(mine.header)
    const legacy = { ...old, header: { fullName: "Juan", links: [] } } as unknown as CV
    expect(normalizeHeadline(legacy).header.taglines).toEqual([])
  })
  it("«Llenar con tu CV» completa los titulares solo si están vacíos", () => {
    const incoming = { ...emptyCv(), header: { fullName: "Juan", headline: "Product Designer", taglines: ["Figma"], links: [] } }
    expect(mergeCv(emptyCv(), incoming).header.taglines).toEqual(["Figma"])
    const mine = { ...emptyCv(), header: { fullName: "Juan", taglines: ["Los míos"], links: [] } }
    expect(mergeCv(mine, incoming).header.taglines).toEqual(["Los míos"])
  })
})
