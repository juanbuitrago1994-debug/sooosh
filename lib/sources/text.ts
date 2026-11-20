import { decodeEntities } from "@/lib/offer/html"

const clip = (s: string, n = 300) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s)

/** HTML (también el que viene con entidades escapadas, como en Greenhouse) → líneas de texto limpias. */
export function htmlToLines(html: string | null | undefined): string[] {
  if (!html) return []
  let h = html
  // Greenhouse entrega el HTML escapado («&lt;p&gt;…»): se decodifica primero.
  if (/&lt;\/?[a-z]/i.test(h)) h = decodeEntities(h)
  return h
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(li|p|div|h[1-6]|ul|ol|tr)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((l) => decodeEntities(l).replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 2 && !/^[•\-–]$/.test(l))
}

/** Solo los elementos de lista (<li>) de un bloque HTML, sin la viñeta. */
export function htmlListItems(html: string | null | undefined): string[] {
  return htmlToLines(html)
    .filter((l) => l.startsWith("• "))
    .map((l) => clip(l.slice(2)))
}

export const htmlToText = (html: string | null | undefined) => htmlToLines(html).map((l) => l.replace(/^• /, "- ")).join("\n")
export { clip }
