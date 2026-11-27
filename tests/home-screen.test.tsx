import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { ValidatedCv } from "@/components/cv/validated-cv"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const file = { name: "Juan_Buitrago_CV_ATS.docx", detail: "DOCX · 14 KB · leído en 1 s", notes: [] }

describe("pantalla de inicio con el CV adjunto", () => {
  it("CV sin validar: dice que está adjunto y ofrece validarlo o seguir sin validar", () => {
    const html = renderToStaticMarkup(<ValidatedCv file={file} onChangeFile={() => {}} onContinue={() => {}} validated={false} onValidate={() => {}} />)
    expect(html).toContain("Tu CV está adjunto")
    expect(html).toContain("Validar mis datos")
    expect(html).toContain("Continuar sin validar")
    expect(html).toContain("Juan_Buitrago_CV_ATS.docx")
    expect(html).not.toContain("Continuar a Oferta")
  })
  it("CV validado: el inicio de siempre", () => {
    const html = renderToStaticMarkup(<ValidatedCv file={file} onChangeFile={() => {}} onContinue={() => {}} />)
    expect(html).toContain("Tu CV se subió y se analizó sin problemas")
    expect(html).toContain("Continuar a Oferta")
    expect(html).not.toContain("Validar mis datos")
  })
})
