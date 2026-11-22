import { describe, expect, it } from "vitest"
import { reviewEmail } from "@/lib/apply/review"

const base = { recipients: 1, subject: "Postulación: Diseñador/a UX/UI – Ana Pérez", subjectFromOffer: false, jobTitle: "Diseñador/a UX/UI", lang: "es" as const, body: "Hola, equipo de Acme:\n\nMe interesa el cargo de Diseñador/a UX/UI. Trabajo con Figma.\n\nAdjunto mi CV. Quedo atento.\n\nAna Pérez" }
const failing = (c: ReturnType<typeof reviewEmail>) => c.filter((x) => !x.ok).map((x) => x.id)

describe("reviewEmail", () => {
  it("un correo en orden no tiene avisos", () => {
    expect(failing(reviewEmail(base))).toEqual([])
  })
  it("avisa de destinatario y asunto vacíos", () => {
    expect(failing(reviewEmail({ ...base, recipients: 0, subject: "" }))).toEqual(["destinatario", "asunto-vacio"])
  })
  it("un asunto largo o con el cargo al final avisa; si lo pide la oferta, no se juzga", () => {
    const long = "Hola buen día, les escribo para enviar mi hoja de vida – Ana Pérez – Diseñador/a UX/UI"
    expect(failing(reviewEmail({ ...base, subject: long }))).toEqual(["asunto-largo", "asunto-cargo"])
    expect(failing(reviewEmail({ ...base, subject: long, subjectFromOffer: true }))).toEqual([])
  })
  it("más de 200 palabras, marcadores sin completar, sin mención del adjunto y relleno", () => {
    expect(failing(reviewEmail({ ...base, body: base.body + " " + Array(210).fill("palabra").join(" ") }))).toContain("largo")
    expect(failing(reviewEmail({ ...base, body: base.body.replace("Trabajo", "Trabajo [completar]") }))).toContain("marcadores")
    expect(failing(reviewEmail({ ...base, body: base.body.replace("Adjunto mi CV. ", "") }))).toContain("adjunto")
    const est = reviewEmail({ ...base, body: base.body + " Es una excelente oportunidad!" }).find((c) => c.id === "estilo")
    expect(est?.ok).toBe(false)
    expect(est?.hint).toContain("exclamaciones")
  })
  it("en inglés reconoce «attached»", () => {
    expect(failing(reviewEmail({ ...base, lang: "en", body: "Hello, team:\n\nMy CV is attached." }))).toEqual([])
  })
})
