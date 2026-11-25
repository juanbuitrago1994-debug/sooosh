import { RANGE_RE } from "./dates"
import { looksLikeRole } from "./heads"

/**
 * Divide el texto de una sección de experiencia (o proyectos) en bloques: cada puesto = líneas de cabecera
 * (cargo, empresa, fechas) + viñetas. Todo determinista; el modelo solo interpreta la cabecera.
 */
export type Block = { head: string[]; bullets: string[] }

const BULLET = /^\s*(?:[-–—•·*+«»▪◦►➢✓●○■□>]|\d{1,2}[.)])\s+/

export const isBullet = (l: string) => BULLET.test(l)
export const stripBullet = (l: string) => l.replace(BULLET, "").trim()

export function splitBlocks(text: string): Block[] {
  const groups: Block[] = []
  let cur: Block | null = null
  let prevWasBullet = false
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    if (isBullet(line)) {
      if (!cur) cur = { head: [], bullets: [] }
      cur.bullets.push(stripBullet(line))
      prevWasBullet = true
      continue
    }
    // línea que continúa una viñeta partida en dos
    if (prevWasBullet && cur && /^[a-záéíóúñ(]/.test(line) && !RANGE_RE.test(line)) {
      cur.bullets[cur.bullets.length - 1] += " " + line
      continue
    }
    if (prevWasBullet || !cur) {
      cur = { head: [], bullets: [] }
      groups.push(cur)
    }
    cur.head.push(line)
    prevWasBullet = false
  }
  // las viñetas sin cabecera (primer grupo creado sin push) y los grupos vacíos
  return groups.filter((g) => g.bullets.length > 0 || g.head.some((l) => RANGE_RE.test(l)) || g.head.length >= 2)
}

/** ¿La línea es casi solo un rango de fechas («2018 - 2021», «Ene 2020 – Actualidad»)? */
const isPureRange = (l: string) => {
  const m = RANGE_RE.exec(l)
  return !!m && l.replace(m[0], " ").replace(/[^\p{L}]/gu, "").length < 4
}
/** Línea de rango + ubicación («Lima, Perú | Mar 2021 - Actual»): no abre un puesto nuevo, completa el anterior. */
const isRangeWithPlace = (l: string) => {
  const m = RANGE_RE.exec(l)
  if (!m) return false
  const rest = l.replace(m[0], " ").replace(/[|·•]/g, " ").trim()
  return rest.split(/\s+/).filter(Boolean).length <= 6 && !looksLikeRole(rest)
}

/**
 * Bloques de EXPERIENCIA. A diferencia de `splitBlocks` (que solo abre bloque tras unas viñetas), aquí cada línea
 * con un rango de fechas abre un puesto: así los CVs con varios puestos SIN viñetas, o con puestos anidados
 * (una empresa con dos cuentas), no se funden en uno. Si el rango va solo en su línea («Cargo — Empresa» ↑,
 * «2018 – 2021» ↓), se une al puesto de la línea anterior.
 */
export function splitExperienceBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let cur: Block | undefined
  let prevWasBullet = false
  const open = (): Block => {
    const b: Block = { head: [], bullets: [] }
    blocks.push(b)
    cur = b
    return b
  }
  const lines = text.split("\n").map((l) => l.trim())
  const explicitBullets = lines.some(isBullet)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const nextLine = lines.slice(i + 1).find(Boolean)
    if (isBullet(line)) {
      ;(cur ?? open()).bullets.push(stripBullet(line))
      prevWasBullet = true
      continue
    }
    if (prevWasBullet && cur && /^[a-záéíóúñ(]/.test(line) && !RANGE_RE.test(line)) {
      cur.bullets[cur.bullets.length - 1] += " " + line
      continue
    }
    const hasRange = RANGE_RE.test(line)
    // Word «en párrafos» (si el CV no usa viñetas en ningún lado): tras la cabecera del puesto, una frase completa (≥ 5 palabras que termina en punto) es un logro.
    // Con viñetas en otras partes, solo la frase que va JUSTO bajo la cabecera (antes de la primera viñeta) se conserva: es la descripción del puesto, no parte del título.
    if ((!explicitBullets || cur?.bullets.length === 0) && cur && !hasRange && cur.head.some((l) => RANGE_RE.test(l)) && /[.;]$/.test(line) && line.split(/\s+/).length >= 5) {
      cur.bullets.push(line)
      prevWasBullet = true
      continue
    }
    const curHasRange = !!cur && cur.head.some((l) => RANGE_RE.test(l))
    const attach = !!cur && !prevWasBullet && hasRange && isRangeWithPlace(line) && !curHasRange && cur.bullets.length === 0
    // «Cargo — Empresa» seguido de una línea que es solo el rango: el título abre el puesto (el rango se le une).
    const titleBeforeRange = !hasRange && !!nextLine && isPureRange(nextLine) && !isBullet(line) && line.split(/\s+/).length <= 10 && !/[.:;]$/.test(line)
    if (!cur || prevWasBullet || (hasRange && !attach) || titleBeforeRange) open()
    ;(cur as Block | undefined)!.head.push(line)
    prevWasBullet = false
  }
  return blocks.filter((g) => g.bullets.length > 0 || g.head.some((l) => RANGE_RE.test(l)) || g.head.length >= 2)
}

/** Viñetas de una sección como elementos completos (une las líneas partidas que continúan una viñeta). Para secciones donde cada viñeta es una entrada, p. ej. proyectos en un PDF. */
export function bulletItems(text: string): string[] {
  const items: string[] = []
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    if (isBullet(line)) items.push(stripBullet(line))
    else if (items.length && /^[a-záéíóúñ(]/.test(line)) items[items.length - 1] += " " + line
  }
  return items.filter(Boolean)
}
