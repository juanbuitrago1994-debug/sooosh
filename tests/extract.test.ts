import path from "node:path"
import { describe, expect, it } from "vitest"
import { ExtractError, extractTextFromFile } from "@/lib/extract"

const fx = (name: string) => path.join(__dirname, "fixtures", name)

describe("extractTextFromFile", () => {
  for (const ext of ["txt", "md", "docx", "odt", "rtf", "pdf"]) {
    it(`lee .${ext}`, async () => {
      const { text } = await extractTextFromFile(fx(`sample.${ext}`), ext)
      expect(text).toContain("Ana Torres")
      expect(text).toContain("Acme S.A.")
      expect(text).toContain("TypeScript")
    })
  }

  it("usa el método de texto directo para el PDF con texto", async () => {
    expect((await extractTextFromFile(fx("sample.pdf"), "pdf")).method).toBe("pdf")
  })

  // OCR: la primera ejecución descarga los datos de idioma (necesita internet); después va desde data/tessdata.
  it("aplica OCR a una imagen", { timeout: 180_000 }, async () => {
    const { text, method } = await extractTextFromFile(fx("sample.png"), "png")
    expect(method).toBe("image-ocr")
    expect(text).toContain("Torres")
  })

  it("aplica OCR a un PDF escaneado (sin texto)", { timeout: 180_000 }, async () => {
    const { text, method } = await extractTextFromFile(fx("scanned.pdf"), "pdf")
    expect(method).toBe("pdf-ocr")
    expect(text).toContain("Torres")
  })

  it("pide guardar como DOCX/PDF para .doc y .heic", async () => {
    for (const ext of ["doc", "heic"]) {
      const err = await extractTextFromFile(fx(`legacy.doc`), ext).catch((e) => e)
      expect(err).toBeInstanceOf(ExtractError)
      expect(err.code).toBe("unsupported_format")
      expect(err.message).toMatch(/DOCX|PDF|JPG/)
    }
  })

  it("rechaza extensiones desconocidas", async () => {
    await expect(extractTextFromFile(fx("sample.txt"), "xyz")).rejects.toMatchObject({ code: "unsupported_format" })
  })
})
