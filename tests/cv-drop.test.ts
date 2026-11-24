import { describe, expect, it } from "vitest"
import { dragHasFiles, friendlyReadError, pickCvFile } from "@/lib/profile/cv-drop"

const f = (name: string, size = 1000) => new File([new Uint8Array(size)], name)

describe("pickCvFile (soltar o elegir el CV)", () => {
  it("acepta un archivo válido", () => {
    const r = pickCvFile([f("cv.pdf")])
    expect(r.file?.name).toBe("cv.pdf")
    expect(r.error).toBeUndefined()
  })
  it("ninguno, varios, vacío, sin extensión, formato raro y demasiado pesado: cada caso dice qué hacer", () => {
    expect(pickCvFile([]).error).toMatch(/ningún archivo/)
    expect(pickCvFile(null).error).toMatch(/ningún archivo/)
    expect(pickCvFile([f("a.pdf"), f("b.pdf")]).error).toMatch(/un solo archivo/)
    expect(pickCvFile([f("cv.pdf", 0)]).error).toMatch(/está vacío/)
    expect(pickCvFile([f("carpeta")]).error).toMatch(/carpeta/)
    expect(pickCvFile([f("cv.exe")]).error).toMatch(/\.exe/)
    expect(pickCvFile([f("cv.pdf", 11 * 1024 * 1024)]).error).toMatch(/pesa 11\.0 MB.*máximo es 10\.0 MB/)
  })
  it("solo reacciona a arrastres con archivos", () => {
    expect(dragHasFiles(["Files"])).toBe(true)
    expect(dragHasFiles(["text/plain"])).toBe(false)
    expect(dragHasFiles(undefined)).toBe(false)
  })
  it("los errores de lectura dicen qué hacer", () => {
    expect(friendlyReadError("Ollama no responde")).toMatch(/IA local/)
    expect(friendlyReadError("Failed to fetch")).toMatch(/conectar/)
    expect(friendlyReadError("Lectura cancelada.")).toMatch(/canceló/)
    expect(friendlyReadError("El PDF es un escaneo sin texto.")).toMatch(/otra copia/)
    expect(friendlyReadError("Algo raro")).toBe("Algo raro")
  })
})
