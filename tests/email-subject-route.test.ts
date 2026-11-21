import { beforeEach, describe, expect, it, vi } from "vitest"

const suggest = vi.hoisted(() => vi.fn())
vi.mock("@/lib/apply/subject-ai", () => ({ suggestSubject: suggest }))

import { POST } from "@/app/api/email/subject/route"

const req = (body: unknown) => new Request("http://x/api/email/subject", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } })

beforeEach(() => suggest.mockReset())

describe("POST /api/email/subject", () => {
  it("devuelve el asunto sugerido y solo pasa cargo, empresa, nombre y los asuntos a evitar", async () => {
    suggest.mockResolvedValue({ subject: "Candidatura para Analista", source: "plantilla" })
    const res = await POST(req({ title: "Analista", company: "Acme", name: "Ana", avoid: ["Postulación: Analista"], cv: { secreto: true } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ subject: "Candidatura para Analista", source: "plantilla" })
    expect(suggest.mock.calls[0][0]).toEqual({ title: "Analista", company: "Acme", name: "Ana" })
    expect(suggest.mock.calls[0][1]).toEqual(["Postulación: Analista"])
  })
  it("rechaza solicitudes sin cargo o mal formadas", async () => {
    expect((await POST(req({ company: "Acme" }))).status).toBe(400)
    expect((await POST(req("no es json"))).status).toBe(400)
    expect(suggest).not.toHaveBeenCalled()
  })
})
