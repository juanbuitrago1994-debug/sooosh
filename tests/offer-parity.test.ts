import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const generate = vi.fn()
vi.mock("@/lib/ai", async (orig) => ({ ...(await orig<typeof import("@/lib/ai")>()), getProvider: () => ({ name: "mock", generateStructured: (r: unknown) => generate(r) }) }))

import { parseOfferText } from "@/lib/ai/parse-offer"
import { applyChannels } from "@/lib/jobs/apply"
import { buildDraft } from "@/lib/jobs/draft"
import { cleanOfferText, keepSchema } from "@/lib/offer/clean"
import { extractOffer } from "@/lib/offer/extract"
import { splitPostHeader } from "@/lib/offer/header"

/**
 * Paridad: la MISMA publicación leída por enlace (página con sus datos estructurados) y pegada como texto debe dar la misma tarjeta. Solo pueden diferir
 * los datos que el texto pegado no trae: la empresa que publica y la fecha (la persona los puede escribir aparte).
 */
const html = readFileSync(path.join(__dirname, "fixtures/offers/linkedin-post-empresa.html"), "utf8")
const URL_ = "https://www.linkedin.com/posts/consultoravos_estamos-seleccionando-uxui"

// El modelo local (simulado) etiqueta por número de línea; aquí elige el título (línea 0) y las viñetas de requisitos.
const labeler = (lines: string[]) => ({
  title: 0,
  company: null,
  requirements: lines.flatMap((l, i) => (/^\s*🔹/.test(l) && !/modalidad/i.test(l) ? [i] : [])),
  niceToHave: [],
  responsibilities: [],
})

async function analyze(text: string, extra: { company?: string; ld?: { datePosted?: string }; url?: string } = {}) {
  generate.mockImplementation(async (r: { user: string; schema: unknown }) => {
    const lines = r.user.replace(/^Líneas:\n/, "").split("\n").map((l) => l.replace(/^\d+: /, ""))
    const meta = { provider: "mock", model: "m", ms: 1, attempts: 1 }
    // limpieza: el modelo (simulado) conserva todo; estructura: elige el título (línea 0) y las viñetas de requisitos
    return r.schema === keepSchema ? { data: { keep: lines.map((_, i) => i) }, meta } : { data: labeler(lines), meta }
  })
  const cleaned = await cleanOfferText(text)
  const parsed = await parseOfferText(cleaned.text)
  return buildDraft({ offer: parsed.data, text: cleaned.text, url: extra.url ?? URL_, company: extra.company, ld: extra.ld, fallbackHash: "h" })
}

// OJO: con llaves; si la función devuelve el simulacro, vitest lo llama como «limpieza» y rompe la prueba
beforeEach(() => {
  generate.mockReset()
})

describe("paridad enlace / texto pegado", () => {
  it("la tarjeta es la misma salvo la empresa y la fecha, que el texto pegado no trae", async () => {
    const page = extractOffer(html, URL_)!
    const viaLink = await analyze(page.text, { company: page.company, ld: page.ld })
    const viaText = await analyze(page.text)
    const same = (d: typeof viaLink) => ({ title: d.title, titleSource: d.titleSource, workMode: d.workMode, requirements: d.offer.requirements, responsibilities: d.offer.responsibilities, skills: d.skills, apply: applyChannels(d.apply).map((c) => [c.method, c.email ?? c.url]) })
    expect(same(viaText)).toEqual(same(viaLink))
    expect(viaLink.title).toBe("Diseñador/a UX/UI")
    expect(viaLink.offer.requirements).toHaveLength(2)
    expect(viaLink.apply.alt?.some((c) => c.email === "candidatos@consultoravos.com")).toBe(true)
    // lo que sí cambia
    expect(viaLink.company).toBe("Vos Consultora")
    expect(viaLink.postedAt).toBe("2026-10-29T19:17:30.572Z")
    expect(viaText.company).toBeUndefined()
  })
  it("si la persona escribe la empresa (o pega el encabezado), el texto pegado también la tiene", async () => {
    const page = extractOffer(html, URL_)!
    const typed = await analyze(page.text, { company: "Vos Consultora" })
    expect(typed.company).toBe("Vos Consultora")
    const split = splitPostHeader(`Vos Consultora\n830 seguidores\n3 sem •\n${page.text}`)
    const viaHeader = await analyze(split.text, { company: split.company })
    expect(viaHeader.company).toBe("Vos Consultora")
    expect(viaHeader.title).toBe("Diseñador/a UX/UI")
  })
})
