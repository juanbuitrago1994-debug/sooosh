import { describe, expect, it } from "vitest"
import { detectApply, emailsOf, syncEmails } from "@/lib/jobs/apply"
import { deobfuscate, detectEmails } from "@/lib/jobs/emails"

const LI = "https://www.linkedin.com/jobs/view/3912345678/"
const list = (t: string) => detectEmails(t).map((e) => e.email)

describe("detectEmails", () => {
  it("correo con verbo de postulación es fuerte", () => {
    const [e] = detectEmails("Si te interesa, envía tu CV a candidatos@consultoravos.com con tu portafolio.")
    expect(e).toMatchObject({ email: "candidatos@consultoravos.com", strong: true })
  })
  it("correo sin verbo («CV a: …») se detecta", () => {
    expect(list("Hoja de vida a: talento@acme.co")).toEqual(["talento@acme.co"])
  })
  it("un único correo sin pistas se acepta pero no es fuerte", () => {
    const [e] = detectEmails("Somos Acme. Escríbenos: hola@acme.com")
    expect(e.email).toBe("hola@acme.com")
  })
  it("con varios correos se exige alguna señal y se ordena por probabilidad", () => {
    const t = "Ventas: info@acme.com. Para postular envía tu CV a rrhh@acme.com"
    expect(list(t)).toEqual(["rrhh@acme.com"])
  })
  it("devuelve hasta 3, sin duplicados", () => {
    const t = "Envía tu CV a a@x.com o a b@x.com, también c@x.com y d@x.com. Envía tu CV a a@x.com"
    const r = list(t)
    expect(r.length).toBeLessThanOrEqual(3)
    expect(new Set(r).size).toBe(r.length)
  })
  it("correos ofuscados", () => {
    expect(deobfuscate("rrhh [at] acme [dot] com")).toBe("rrhh@acme.com")
    expect(list("Envía tu CV a rrhh arroba acme punto com")).toEqual(["rrhh@acme.com"])
    expect(list("Postula a empleo(at)acme.co")).toEqual(["empleo@acme.co"])
  })
  it("descarta no-reply, imágenes y duplicados", () => {
    expect(list("noreply@acme.com logo@2x.png")).toEqual([])
  })
  it("no hay correo sin texto", () => {
    expect(detectEmails(undefined)).toEqual([])
    expect(detectEmails("Sin correos aquí.")).toEqual([])
  })
})

describe("detectApply con correos", () => {
  it("oferta de LinkedIn con correo y formulario: vía principal intacta y correos guardados", () => {
    const a = detectApply({ sourceUrl: LI, text: "Envía tu CV a candidatos@consultoravos.com o llena https://forms.gle/U13v4492isxwh9aJ9" })
    expect(a.method).toBe("plataforma")
    expect(a.emails).toEqual(["candidatos@consultoravos.com"])
    expect(a.alt?.map((c) => c.method)).toEqual(["correo", "formulario"])
  })
  it("un correo sin verbo no pasa a ser vía principal si la fuente es una plataforma", () => {
    const a = detectApply({ sourceUrl: LI, text: "Hoja de vida a: talento@acme.co" })
    expect(a.method).toBe("plataforma")
    expect(a.emails).toEqual(["talento@acme.co"])
  })
  it("correo fuerte con fuente genérica es la vía principal y va primero", () => {
    const a = detectApply({ sourceUrl: "https://careers.acme.com/x", text: "Escríbenos a info@acme.com. Envía tu CV a rrhh@acme.com" })
    expect(a.method).toBe("correo")
    expect(a.emails?.[0]).toBe(a.email)
  })
  it("emailsOf cae a las vías de datos guardados antes de `emails`", () => {
    expect(emailsOf({ method: "plataforma", url: LI, alt: [{ method: "correo", email: "a@b.com", url: "mailto:a@b.com" }] })).toEqual(["a@b.com"])
    expect(emailsOf(null)).toEqual([])
  })
})

describe("syncEmails", () => {
  const mail = (email: string) => ({ method: "correo" as const, email, url: `mailto:${email}` })
  it("lo que el administrador cambia o quita sale de la lista; lo agregado entra primero; el resto se conserva", () => {
    const prev = { ...mail("a@x.com"), emails: ["a@x.com", "b@x.com"] }
    expect(syncEmails(prev, { ...prev, ...mail("c@x.com") }).emails).toEqual(["c@x.com", "b@x.com"])
    expect(syncEmails(prev, { ...prev, alt: [mail("d@x.com")] }).emails).toEqual(["a@x.com", "d@x.com", "b@x.com"])
    expect(syncEmails({ method: "plataforma", url: LI, alt: [mail("a@x.com")], emails: ["a@x.com"] }, { method: "plataforma", url: LI, emails: ["a@x.com"] })).not.toHaveProperty("emails")
  })
})
