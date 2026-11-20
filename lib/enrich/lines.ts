import { z } from "zod"
import { getProvider } from "@/lib/ai"
import { offerFromIndices } from "@/lib/ai/parse-offer-lines"
import type { Offer } from "@/lib/schemas/offer"

/**
 * Texto COMPACTO para el modelo. En esta máquina el modelo local lee ≈ 90 tokens por segundo, así que el tamaño del texto manda: una
 * oferta de 8 000 caracteres tardaba casi 3 minutos. Aquí cada línea se corta en frases de a lo sumo ~170 caracteres, se descartan las muy
 * cortas o sin letras y se limita a 60 fragmentos y ~3 000 caracteres. Los fragmentos son LITERALES: lo que el modelo señale es texto de la oferta.
 */
export const MAX_FRAGMENTS = 60
export const MAX_CHARS = 3000
const MAX_FRAGMENT = 170

export function compactLines(title: string, company: string | undefined, text: string): string[] {
  const head = company ? `${title} en ${company}` : title
  const out: string[] = [head]
  let chars = head.length
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    const bullet = line.startsWith("• ")
    const parts = bullet ? [line] : line.split(/(?<=[.!?:;])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
    for (const p of parts) {
      const f = p.replace(/\s+/g, " ").trim()
      if (f.length < 12 || !/\p{L}{3}/u.test(f)) continue
      const cut = f.length > MAX_FRAGMENT ? f.slice(0, MAX_FRAGMENT - 1).trimEnd() + "…" : f
      if (out.length >= MAX_FRAGMENTS || chars + cut.length > MAX_CHARS) return out
      out.push(cut)
      chars += cut.length
    }
  }
  return out
}

const idx = z.number().int().min(0)
// El modelo a veces señala más fragmentos de los que se usan: se aceptan hasta 60 y el código se queda con los primeros (en orden del texto).
const schema = z.object({ requirements: z.array(idx).max(60), niceToHave: z.array(idx).max(60), responsibilities: z.array(idx).max(60) })
const first = (xs: number[], n: number) => [...new Set(xs)].sort((a, b) => a - b).slice(0, n)

const PROMPT = `Recibes los fragmentos numerados de una oferta de trabajo (el 0 es el título). Devuelve los NÚMEROS de fragmento de cada parte:
{"requirements": [fragmentos que piden algo al candidato: experiencia, conocimientos, herramientas, estudios, idiomas], "niceToHave": [fragmentos de lo deseable o que "se valora"], "responsibilities": [fragmentos de lo que hará la persona en el puesto]}
No incluyas títulos de sección, descripción de la empresa, beneficios ni cómo postular. Si no hay nada de una parte, deja la lista vacía. Responde únicamente con el JSON.`

export type LabelResult = { offer: Offer | null; fragments: number; chars: number; ms: number }

/** El modelo señala fragmentos por número; el código arma la oferta con fragmentos literales (más lo que se deriva sin IA: herramientas, idiomas, años, nivel). */
export async function labelCompact(title: string, company: string | undefined, text: string, signal?: AbortSignal): Promise<LabelResult> {
  const lines = compactLines(title, company, text)
  const chars = lines.reduce((a, l) => a + l.length, 0)
  const t0 = Date.now()
  if (lines.length < 4) return { offer: null, fragments: lines.length, chars, ms: 0 }
  const numbered = lines.map((l, i) => `${i}: ${l}`).join("\n")
  const { data } = await getProvider().generateStructured({ system: PROMPT, user: `Fragmentos:\n${numbered}`, schema, signal, options: { numPredict: 160 } })
  const offer = offerFromIndices(lines, { title: 0, company: null, requirements: first(data.requirements, 12), niceToHave: first(data.niceToHave, 8), responsibilities: first(data.responsibilities, 12) })
  return { offer, fragments: lines.length, chars, ms: Date.now() - t0 }
}
