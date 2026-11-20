import { z } from "zod"
import { getProvider } from "@/lib/ai"
import { OFFER_MAX_CHARS } from "@/lib/schemas/offer"

/**
 * Capa 2: limpieza. Deja SOLO el contenido propio de la oferta (sin comentarios, reacciones, navegación ni publicidad).
 * 1) Prefiltro determinista de líneas basura. 2) LLM local con salida estructurada que devuelve los NÚMEROS de línea
 * que pertenecen a la oferta: el texto resultante son líneas del original, tal cual → no puede inventar nada.
 */

/** Líneas que nunca son parte de una oferta. */
const NOISE_LINES: RegExp[] = [
  /^(me gusta|like|likes?|responder|reply|compartir|share|denunciar|report|seguir|follow|guardar|save|enviar|send|comentar|comment|repost|recomendar|celebrar|apoyar|curioso|divertido|genial|perspicaz)$/i,
  /^\d+([.,]\d+)?\s*(k|mil)?\s*(me gusta|reacciones|reactions|likes?|comentarios|comments?|veces compartido|shares?|reposts?|visualizaciones|views|impresiones)\b/i,
  /^(ver|show|load|cargar)\s+(más|more|\d+)?\s*(comentarios|respuestas|replies|comments|resultados)/i,
  /^(\d+\s*)?(comentarios?|comments?|respuestas?|replies)$/i,
  /^(iniciar sesión|inicia sesión|sign in|log in|join now|unirse ahora|regístrate|únete|crear cuenta)/i,
  /^(aceptar|rechazar|accept|reject|decline)\s+(todas?|all)?\s*(las\s+)?(cookies)?/i,
  /(política de (cookies|privacidad)|privacy policy|cookie policy|términos (y condiciones|de uso)|terms of (use|service)|todos los derechos reservados|all rights reserved)/i,
  /^(ofertas? (de empleo )?(similares|relacionadas)|similar jobs|related jobs|más ofertas|people also viewed|otras personas también)/i,
  /^(promocionado|promoted|publicidad|sponsored|anuncio|ad)$/i,
  /^(hace|ago|\d+\s*(s|min|h|d|sem|mes|a|w|mo|y)\b)\s*\w*\s*(•|·)?\s*(editado|edited)?$/i,
  /^•\s*(1\.er|2\.º|3\.er|\d+(st|nd|rd|th)|\w+)\s*$/i,
]

export const isNoiseLine = (line: string) => NOISE_LINES.some((re) => re.test(line.trim()))

/** Prefiltro: quita líneas basura y repeticiones consecutivas. */
export function prefilterLines(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line || isNoiseLine(line)) continue
    if (out[out.length - 1] === line) continue
    out.push(line)
  }
  return out
}

export const keepSchema = z.object({ keep: z.array(z.number().int().min(0)) })

/**
 * El modelo a veces descarta una línea suelta de la oferta (un requisito entre dos requisitos). Si UNA sola línea quedó fuera entre dos que se
 * conservaron, se recupera: un comentario ajeno suele venir en bloque al final, no aislado en medio de la oferta. Huecos de dos o más líneas se respetan.
 */
export function fillSingleGaps(keep: ReadonlySet<number>, total: number): Set<number> {
  const out = new Set(keep)
  for (let i = 1; i < total - 1; i++) if (!keep.has(i) && keep.has(i - 1) && keep.has(i + 1)) out.add(i)
  return out
}

export const CLEAN_SYSTEM_PROMPT = `Eres un filtro de contenido. Recibes las líneas NUMERADAS de una publicación o página de empleo (a veces con ruido alrededor).
Devuelve los números de las líneas que son contenido PROPIO de la oferta: título, empresa, ubicación, modalidad, descripción, funciones, requisitos, deseables, herramientas, beneficios, salario, condiciones y cómo postular.
EXCLUYE: comentarios y respuestas de otras personas (aunque hablen de la oferta o pidan información), reacciones y contadores, nombres y titulares de otros usuarios, navegación y menús, avisos de cookies, publicidad, ofertas relacionadas o similares, texto de inicio de sesión.
Si una línea es un comentario o la respuesta a un comentario, NO la incluyas. Responde únicamente con el JSON {"keep": [números]}.`

const CHUNK_CHARS = 5000

export type CleanResult = {
  text: string
  /** líneas del texto de entrada que se descartaron */
  removed: number
  /** se usó el LLM (false = solo prefiltro, p. ej. si Ollama no estaba disponible) */
  llm: boolean
  warning?: string
}

/**
 * Limpia el texto de una oferta. `useLlm: false` aplica solo el prefiltro determinista.
 * Si el LLM falla o devuelve algo sospechoso (casi nada), se conserva el resultado del prefiltro.
 */
export async function cleanOfferText(text: string, opts: { signal?: AbortSignal; useLlm?: boolean } = {}): Promise<CleanResult> {
  const lines = prefilterLines(text)
  const before = text.split("\n").filter((l) => l.trim()).length
  const done = (kept: string[], llm: boolean, warning?: string): CleanResult => ({
    text: kept.join("\n").slice(0, OFFER_MAX_CHARS),
    removed: Math.max(0, before - kept.length),
    llm,
    warning,
  })
  if (lines.length === 0 || opts.useLlm === false) return done(lines, false)

  try {
    const keep = new Set<number>()
    // Trozos con numeración global para que el modelo vea siempre los mismos números.
    let start = 0
    while (start < lines.length) {
      let end = start
      let size = 0
      while (end < lines.length && (size + lines[end].length < CHUNK_CHARS || end === start)) size += lines[end++].length + 8
      const numbered = lines.slice(start, end).map((l, i) => `${start + i}: ${l}`).join("\n")
      const { data } = await getProvider().generateStructured({
        system: CLEAN_SYSTEM_PROMPT,
        user: `Líneas:\n${numbered}`,
        schema: keepSchema,
        signal: opts.signal,
      })
      for (const n of data.keep) if (n >= start && n < end) keep.add(n)
      start = end
    }
    const filled = fillSingleGaps(keep, lines.length)
    const kept = lines.filter((_, i) => filled.has(i))
    // Salvaguarda: si el modelo no dejó casi nada, probablemente se equivocó → no tirar la oferta.
    if (kept.length === 0 || kept.join("\n").length < Math.min(200, text.length * 0.1)) {
      return done(lines, false, "La limpieza con el modelo dejó muy poco texto; se conservó el texto sin ese paso.")
    }
    return done(kept, true)
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e
    return done(lines, false, "No se pudo usar el modelo para limpiar la oferta; solo se quitó el ruido evidente.")
  }
}
