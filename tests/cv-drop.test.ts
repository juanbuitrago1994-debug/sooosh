import { describe, expect, it } from "vitest"
import { describeDrag, dragHasFiles, dropCopy, fileSummary, friendlyReadError, pickCvFile } from "@/lib/profile/cv-drop"

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

describe("lo que se ve mientras se arrastra (antes de soltar)", () => {
  const item = (type: string, kind = "file") => ({ kind, type })
  it("un PDF: dice el tipo; sin nombre ni peso (el navegador no los da hasta soltar)", () => {
    const i = describeDrag([item("application/pdf")])
    expect(i).toEqual({ count: 1, label: "PDF", unsupported: false })
    expect(dropCopy(i)).toEqual({ title: "Suelta tu CV aquí", description: "PDF · un solo archivo" })
  })
  it("Word, imagen y texto se reconocen por su tipo", () => {
    expect(describeDrag([item("application/vnd.openxmlformats-officedocument.wordprocessingml.document")])?.label).toBe("Word")
    expect(describeDrag([item("image/png")])?.label).toBe("Imagen")
    expect(describeDrag([item("text/markdown")])?.label).toBe("Markdown")
  })
  it("varios archivos: avisa cuántos y pide uno solo", () => {
    const i = describeDrag([item("application/pdf"), item("application/pdf"), item("image/png")])
    expect(i?.count).toBe(3)
    expect(dropCopy(i)).toEqual({ title: "Suelta un solo archivo", description: "Traes 3 archivos" })
  })
  it("un formato que no leemos se avisa antes de soltar", () => {
    const i = describeDrag([item("application/x-msdownload")])
    expect(i).toEqual({ count: 1, unsupported: true })
    expect(dropCopy(i).title).toBe("Ese formato no lo leemos")
    expect(describeDrag([item("image/gif")])?.unsupported).toBe(true)
  })
  it("tipo vacío (algunos .md, .heic, .docx): no afirma nada; texto, enlaces y nada: sin aviso especial", () => {
    expect(describeDrag([item("")])).toEqual({ count: 1, unsupported: false })
    expect(dropCopy(describeDrag([item("")]))).toEqual({ title: "Suelta tu CV aquí", description: "Un solo archivo" })
    expect(describeDrag([item("text/uri-list", "string")])).toBeNull()
    expect(describeDrag(undefined)).toBeNull()
    expect(dropCopy(null).description).toBe("Un solo archivo")
  })
  it("ya soltado: una línea con nombre, peso y tipo", () => {
    expect(fileSummary({ name: "cv.pdf", size: 1_258_291, type: "application/pdf" })).toBe("cv.pdf · 1.2 MB · PDF")
    expect(fileSummary({ name: "cv.md", size: 2048, type: "" })).toBe("cv.md · 2 KB · MD")
    expect(fileSummary({ name: "reabierto.pdf", size: 0 })).toBe("reabierto.pdf · PDF")
  })
})

import { ENTRY_IDLE, entryDropCopy } from "@/lib/profile/cv-drop"

describe("textos de la pantalla inicial", () => {
  it("en reposo explica qué subir y qué pasará, sin prometer clic", () => {
    expect(ENTRY_IDLE.title).toBe("Sube tu CV para empezar")
    expect(ENTRY_IDLE.description).toContain("Arrastra el archivo hasta aquí")
    expect(ENTRY_IDLE.description).not.toMatch(/clic|toca/i)
  })
  it("al arrastrar dice qué va a pasar; con un formato conocido lo menciona", () => {
    expect(entryDropCopy(null).title).toBe("Suéltalo aquí, ya casi está")
    expect(entryDropCopy(describeDrag([{ kind: "file", type: "application/pdf" }])).description).toBe("Formato PDF: lo leeremos por ti y revisarás cada dato.")
  })
  it("varios archivos y formatos que no leemos dicen qué hacer", () => {
    const many = describeDrag([{ kind: "file", type: "application/pdf" }, { kind: "file", type: "application/pdf" }, { kind: "file", type: "application/pdf" }])
    expect(entryDropCopy(many)).toEqual({ title: "Un solo archivo a la vez", description: "Traes 3 archivos. Suelta solo tu CV más reciente." })
    const bad = describeDrag([{ kind: "file", type: "application/zip" }])
    expect(entryDropCopy(bad).title).toBe("Ese tipo de archivo no lo podemos leer")
    expect(entryDropCopy(bad).description).toContain("PDF")
  })
  it("el panel «Mi CV» conserva sus textos de siempre", () => {
    expect(dropCopy(null)).toEqual({ title: "Suelta tu CV aquí", description: "Un solo archivo" })
  })
})
