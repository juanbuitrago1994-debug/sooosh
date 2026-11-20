import { SOURCE_HEADERS } from "../types"

/**
 * Lector de robots.txt para los portales sin API. Reglas de Sooosh (acordadas con Juan, 19-nov-2026): lo que un sitio prohíbe NO se lee;
 * si el sitio no deja ni mirar su robots.txt (403, 401…) se interpreta como «no quieren robots» y NO se entra; y nunca se finge ser un navegador.
 */
export const BOT_TOKEN = "soooshbot"

type Rule = { allow: boolean; pattern: string }
export type Robots = { rules: Rule[]; sitemaps: string[]; blocked: boolean; reason?: string }

const escape = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
/** Patrón de robots.txt (`*` cualquier cosa, `$` fin) → expresión regular anclada al inicio de la ruta. */
const toRegex = (pattern: string) => new RegExp("^" + escape(pattern).replace(/\\\*/g, ".*").replace(/\*/g, ".*").replace(/\$$/, "$"))

/** Interpreta el texto de un robots.txt para nuestro identificador (o, si no hay grupo propio, para `*`). */
export function parseRobots(text: string): Robots {
  const groups: { agents: string[]; rules: Rule[] }[] = []
  const sitemaps: string[] = []
  let cur: { agents: string[]; rules: Rule[] } | null = null
  let lastWasAgent = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim()
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const val = m[2].trim()
    if (key === "sitemap") {
      if (val) sitemaps.push(val)
      continue
    }
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] }
        groups.push(cur)
      }
      cur.agents.push(val.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!cur) continue
    if (key === "allow" || key === "disallow") cur.rules.push({ allow: key === "allow", pattern: val })
  }
  const own = groups.filter((g) => g.agents.some((a) => a !== "*" && a.startsWith(BOT_TOKEN)))
  const star = groups.filter((g) => g.agents.includes("*"))
  const chosen = own.length ? own : star
  return { rules: chosen.flatMap((g) => g.rules).filter((r) => r.pattern !== ""), sitemaps, blocked: false }
}

/** ¿Puede Sooosh leer esta ruta? Gana la regla más específica (patrón más largo); a igualdad, «allow». */
export function isAllowed(robots: Robots, pathAndQuery: string): boolean {
  if (robots.blocked) return false
  let best: Rule | null = null
  for (const r of robots.rules) {
    if (!toRegex(r.pattern).test(pathAndQuery)) continue
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r
  }
  return best ? best.allow : true
}

/** Descarga y entiende el robots.txt de un sitio. 404 = sin restricciones; 401/403/429/5xx o sin respuesta = NO se entra. */
export async function loadRobots(origin: string, fetchImpl: typeof fetch = fetch): Promise<Robots> {
  try {
    const res = await fetchImpl(`${origin}/robots.txt`, { headers: { ...SOURCE_HEADERS, Accept: "text/plain,*/*;q=0.5" }, signal: AbortSignal.timeout(15_000) })
    if (res.status === 404 || res.status === 410) return { rules: [], sitemaps: [], blocked: false }
    if (!res.ok) return { rules: [], sitemaps: [], blocked: true, reason: `${origin} no deja leer su robots.txt (HTTP ${res.status}): se interpreta como que no quiere robots` }
    return parseRobots(await res.text())
  } catch {
    return { rules: [], sitemaps: [], blocked: true, reason: `No se pudo leer el robots.txt de ${origin}` }
  }
}
