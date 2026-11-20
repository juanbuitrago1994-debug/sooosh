import { isBullet, stripBullet } from "./blocks"

/** Habilidades e idiomas: parseo determinista (sin IA). */
export type SkillGroup = { category?: string; items: string[] }

const SPLIT = /\s*(?:,|;|\||•|·|\/(?=\s)|\s{2,})\s*/

export function parseSkills(text: string): SkillGroup[] {
  const groups: SkillGroup[] = []
  const loose: string[] = []
  for (const raw of text.split("\n")) {
    const line = (isBullet(raw) ? stripBullet(raw) : raw).trim()
    if (!line) continue
    const m = line.match(/^([^:]{2,40}):\s*(.+)$/)
    const body = m ? m[2] : line
    const items = body.split(SPLIT).map((s) => s.replace(/^[-–]\s*/, "").trim()).filter((s) => s && s.length <= 60)
    if (items.length === 0) continue
    if (m) groups.push({ category: m[1].trim(), items })
    else loose.push(...items)
  }
  if (loose.length) groups.unshift({ items: loose })
  return groups
}

export type LanguageItem = { name: string; level?: string }

export function parseLanguages(text: string): LanguageItem[] {
  const out: LanguageItem[] = []
  for (const raw of text.split(/\n|,|;|\|/)) {
    const line = (isBullet(raw) ? stripBullet(raw) : raw).trim()
    if (!line) continue
    const paren = line.match(/^([\p{L} ]{2,30})\s*[(\[]\s*([^)\]]+)[)\]]/u)
    const dash = line.match(/^([\p{L} ]{2,30}?)\s*(?:[-–—:])\s*(.+)$/u)
    if (paren) out.push({ name: paren[1].trim(), level: paren[2].trim() })
    else if (dash) out.push({ name: dash[1].trim(), level: dash[2].trim() })
    else if (/^[\p{L} ]{2,30}$/u.test(line)) out.push({ name: line })
  }
  return out
}
