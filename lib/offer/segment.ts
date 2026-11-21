import { fold } from "@/lib/keywords/normalize"
import type { Offer } from "@/lib/schemas/offer"
import { isBareHeading, isSectionHeading } from "./identity"

/**
 * Segmenta el texto de una oferta en bloques con sentido (gancho, requisitos, funciones, se valora, beneficios, contacto, hashtags…) con REGLAS,
 * sin IA: una publicación de LinkedIn suele traer encabezados («🔹 Requisitos», «Se valora:») que dicen qué es cada línea. El modelo local
 * decide qué líneas son requisitos/funciones, pero se equivoca de lista o mete el correo de contacto; los bloques corrigen eso.
 * Cada línea sigue siendo una línea literal del texto: nada se inventa.
 */
export type BlockKind = "gancho" | "requisitos" | "funciones" | "deseables" | "beneficios" | "contacto" | "hashtags" | "otro"
export type Block = { kind: BlockKind; heading?: string; lines: string[] }

const KIND_RE: [BlockKind, RegExp][] = [
  ["deseables", /^(se valora|valorable|deseable|deseables|plus|nice to have|preferred|bonus)\b/],
  ["funciones", /^(funciones|responsabilidades|actividades|que haras|tu rol|el rol|tus retos|responsibilities|what you.?ll do|the role)\b/],
  ["beneficios", /^(ofrecemos|beneficios|que ofrecemos|condiciones|compensacion|benefits|we offer|perks|what we offer)\b/],
  ["contacto", /^(postulacion|como (aplicar|postular)|aplica|contacto|how to apply|apply|interesad[oa]s)\b/],
  ["requisitos", /^(?:(?:requisitos?|requerimientos?|lo que buscamos|requirements|qualifications|what you bring|must have)\b|(?:perfil(?: del candidato| buscado)?|experiencia(?: comprobable| requerida| laboral)?|conocimientos|habilidades|formacion|educacion)$)/],
]

export const CONTACT_LINE = /(@[\w-]+\.[\w.-]+|https?:\/\/|www\.|\b(env[ií]a(?:r|nos)?|escr[ií]be(?:nos)?|postula(?:te)?|aplica(?:r)?|m[aá]ndanos|cont[aá]ctanos|send (?:us )?your|apply (?:here|now|at|via)|dm me)\b)/i
/** Frase que abre la lista de requisitos sin ser un encabezado: «¿Qué buscamos?», «¿Qué pedimos?», «What we're looking for». */
const ASKS_FOR = /(?:¿\s*qu[eé]\s+(?:buscamos|necesitamos|pedimos|esperamos|requerimos)\s*\??|what\s+(?:we(?:'|’)?re|we\s+are|you(?:'|’)?ll)\s+(?:looking\s+for|need))\s*[:.]?\s*$/i
/** «Modalidad: Remoto», «Horario: …»: son datos de la oferta (ya tienen su campo), no requisitos ni funciones. */
const META_LINE = /^\s*(?:modalidad|ubicaci[oó]n|horario|jornada|contrato|tipo de contrato|salario|sueldo|remuneraci[oó]n|lugar(?: de trabajo)?|location|schedule|salary|contract)\s*[:：]/i
const stripBullet = (l: string) => l.replace(/^\s*(?:[-–—•·*▪◦►✓●○■□>🔹🔸🔶🔷✅☑️➡️👉]|\d{1,2}[.)])+\s*/u, "").trim()
const words = (s: string) => s.split(/\s+/).filter(Boolean)

const isHashtagLine = (l: string) => {
  const w = words(l)
  return w.length > 0 && w.filter((x) => x.startsWith("#")).length / w.length >= 0.5
}

/** Tipo de un encabezado («🔹 Requisitos», «Se valora»), o `undefined` si no es uno conocido. */
export function headingKind(line: string): BlockKind | undefined {
  const t = fold(stripBullet(line)).replace(/[:：]\s*$/, "").trim()
  return KIND_RE.find(([, re]) => re.test(t))?.[0]
}

/** «Se valora: Python» → { kind: "deseables", rest: "Python" }; sin contenido tras los dos puntos, `rest` queda vacío. */
function inlineHeading(line: string): { kind: BlockKind; rest: string } | undefined {
  const m = line.match(/^\s*[^\p{L}\p{N}]*([^:：]{2,40})[:：]\s*(.*)$/u)
  if (!m) return undefined
  const kind = headingKind(m[1])
  return kind ? { kind, rest: m[2].trim() } : undefined
}

export function segmentOffer(text: string): Block[] {
  const blocks: Block[] = []
  let cur: Block = { kind: "gancho", lines: [] }
  const push = () => {
    if (cur.lines.length || cur.heading) blocks.push(cur)
  }
  const add = (kind: BlockKind, line: string) => {
    if (cur.kind !== kind) {
      push()
      cur = { kind, lines: [] }
    }
    cur.lines.push(line)
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    if (isHashtagLine(line)) {
      add("hashtags", line)
      continue
    }
    const inline = inlineHeading(line)
    const headKind = headingKind(line)
    if (inline || (isSectionHeading(line) && headKind)) {
      push()
      cur = { kind: (inline?.kind ?? headKind)!, heading: line, lines: [] }
      if (inline?.rest) cur.lines.push(inline.rest)
      continue
    }
    // Encabezado de sección que no conocemos («🔹 Sobre el equipo»): abre un bloque «otro» para no pegar sus líneas a la sección anterior.
    if (isSectionHeading(line)) {
      push()
      cur = { kind: "otro", heading: line, lines: [] }
      continue
    }
    if (CONTACT_LINE.test(line)) {
      add("contacto", line)
      continue
    }
    if (cur.kind === "contacto" || cur.kind === "hashtags") {
      // tras un contacto o hashtags la oferta ya terminó; lo que siga es ruido de cierre, no una sección nueva
      add("otro", line)
      continue
    }
    cur.lines.push(line)
    // «… ¿Qué buscamos?» al final de la frase de apertura: lo que sigue (viñetas sin encabezado) son los requisitos.
    if (cur.kind === "gancho" && ASKS_FOR.test(line)) {
      push()
      cur = { kind: "requisitos", lines: [] }
    }
  }
  push()
  return blocks
}

const LIST_KIND: Partial<Record<BlockKind, keyof Pick<Offer, "requirements" | "responsibilities" | "niceToHave">>> = {
  requisitos: "requirements",
  funciones: "responsibilities",
  deseables: "niceToHave",
}
const key = (s: string) => fold(stripBullet(s)).replace(/[^\p{L}\p{N}]+/gu, " ").trim()

/**
 * Concilia las listas que armó el modelo con los bloques del texto:
 *  - una línea dentro de «Requisitos» / «Funciones» / «Se valora» va a ESA lista (el modelo a veces las mezcla);
 *  - una línea de contacto, beneficios o hashtags sale de las listas;
 *  - las líneas de esas secciones que el modelo omitió se agregan (con un mínimo de 3 y un máximo de 240 caracteres).
 * Devuelve cuántas líneas movió, quitó y agregó, para medirlo.
 */
export function reconcileOffer(offer: Offer, text: string): { offer: Offer; moved: number; removed: number; added: number } {
  const blocks = segmentOffer(text)
  const where = new Map<string, BlockKind>()
  const original = new Map<string, string>()
  for (const b of blocks) for (const l of b.lines) {
    where.set(key(l), b.kind)
    original.set(key(l), stripBullet(l))
  }
  const out: Pick<Offer, "requirements" | "responsibilities" | "niceToHave"> = { requirements: [], responsibilities: [], niceToHave: [] }
  const seen = new Set<string>()
  let moved = 0
  let removed = 0
  let added = 0
  for (const list of ["requirements", "responsibilities", "niceToHave"] as const) {
    for (const item of offer[list]) {
      const k = key(item)
      const kind = where.get(k)
      const target = kind ? LIST_KIND[kind] : undefined
      // un encabezado que el modelo metió como si fuera un dato («What you'll do») no es parte de ninguna lista
      if (isBareHeading(item) || META_LINE.test(stripBullet(item)) || (kind && !target && ["contacto", "beneficios", "hashtags"].includes(kind))) {
        removed++
        continue
      }
      const dest = target ?? list
      if (dest !== list) moved++
      if (seen.has(k)) continue
      seen.add(k)
      out[dest].push(item)
    }
  }
  for (const b of blocks) {
    const dest = LIST_KIND[b.kind]
    if (!dest) continue
    for (const l of b.lines) {
      const k = key(l)
      const text1 = original.get(k) ?? stripBullet(l)
      if (seen.has(k) || text1.length < 3 || text1.length > 240 || CONTACT_LINE.test(text1) || META_LINE.test(text1)) continue
      seen.add(k)
      out[dest].push(text1)
      added++
    }
  }
  return { offer: { ...offer, ...out }, moved, removed, added }
}
