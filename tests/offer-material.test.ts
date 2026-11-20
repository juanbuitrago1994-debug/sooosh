import { existsSync, readFileSync, readdirSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { extractOffer } from "@/lib/offer/extract"
import { prefilterLines } from "@/lib/offer/clean"

/**
 * Ofertas reales de Juan: cualquier .txt, .md o .html que deje en ~/Projects/cv-tailor-material.
 * Si la carpeta está vacía, estas pruebas se omiten. (.html se pasa por la extracción por capas; .txt/.md por el prefiltro.)
 */
const DIR = path.join(os.homedir(), "Projects", "cv-tailor-material")
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => /\.(txt|md|html?)$/i.test(f)) : []

describe.skipIf(files.length === 0)(`ofertas de ~/Projects/cv-tailor-material (${files.length})`, () => {
  for (const f of files) {
    it(`${f}: se extrae contenido y no quedan líneas de ruido`, () => {
      const raw = readFileSync(path.join(DIR, f), "utf8")
      const text = /\.html?$/i.test(f) ? (extractOffer(raw, undefined)?.text ?? "") : raw
      const lines = prefilterLines(text)
      expect(lines.join("\n").length, "texto útil").toBeGreaterThan(200)
      for (const l of lines) expect(/^(me gusta|responder|ver más comentarios|\d+ (reacciones|comentarios))$/i.test(l), l).toBe(false)
    })
  }
})

describe("carpeta de ofertas de ejemplo", () => {
  it("existe o se omite sin error", () => {
    expect(files.length).toBeGreaterThanOrEqual(0)
  })
})
