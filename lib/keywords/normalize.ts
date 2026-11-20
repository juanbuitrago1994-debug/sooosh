import { CEFR, GENERIC, HARD, SOFT } from "./words"

export type TokenClass = "content" | "soft" | "hard" | "generic"
export type Token = { raw: string; key: string; cls: TokenClass }

/** Minúsculas y sin tildes (ñ→n también: "español" = "espanol"). */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

/**
 * Raíz simple para comparar singular/plural (es/en): quita la "s" final y luego la "e" final.
 * Solo se usa para comparar, no para mostrar. Los términos con . + # / - se dejan tal cual.
 */
export function stem(word: string): string {
  if (!/^[a-z0-9]+$/.test(word) || /^\d+$/.test(word)) return word
  let w = word
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1)
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1)
  return w
}

// Palabras con signos propios: C++, C#, Node.js, .NET, CI/CD, front-end.
const TOKEN_RE = /\.?[\p{L}\p{N}]+(?:[.+#/_-][\p{L}\p{N}]+)*[+#]*/gu
// Separadores de frase: puntuación, saltos de línea, viñetas y guiones largos.
const CHUNK_RE = /[\n\r;:,()[\]{}!?¿¡"“”«»•·|–—]|\.(?=\s|$)|\s-\s/u

function classify(key: string, raw: string): TokenClass {
  if (SOFT.has(key)) return "soft"
  if (HARD.has(key) || /^\d+$/.test(key) || CEFR.test(key)) return "hard"
  if (GENERIC.has(key)) return "generic"
  if (key.length < 2 && !/^[CR]$/.test(raw)) return "hard"
  return "content"
}

/** Texto → trozos (separados por puntuación) de tokens clasificados. */
export function tokenize(text: string): Token[][] {
  return text
    .split(CHUNK_RE)
    .map((chunk) =>
      [...chunk.matchAll(TOKEN_RE)].map((m) => {
        const raw = m[0]
        const folded = fold(raw)
        const key = stem(folded)
        return { raw, key, cls: classify(folded, raw) } as Token
      }),
    )
    .filter((t) => t.length > 0)
}
