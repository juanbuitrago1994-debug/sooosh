import type { AtsDoc } from "./model"

/** Texto plano canónico del documento ATS, en el orden de lectura. Es lo que debería recuperar cualquier lector del archivo (regla ATS-F1) y la base de comparación del verificador. */
export function atsLines(doc: AtsDoc): string[] {
  const out: string[] = [doc.name, ...(doc.headline ? [doc.headline] : []), ...(doc.contact ? [doc.contact] : [])]
  for (const s of doc.sections) {
    out.push("", s.title)
    for (const b of s.blocks) {
      if (b.kind === "para") out.push(b.text)
      else out.push(b.head, ...b.lines, ...b.bullets.map((x) => `• ${x}`))
    }
  }
  return out
}

export const atsToText = (doc: AtsDoc): string => atsLines(doc).join("\n") + "\n"
