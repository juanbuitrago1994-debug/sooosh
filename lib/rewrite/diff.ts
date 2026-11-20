export type DiffPart = { text: string; type: "same" | "add" | "del" }

/** Diff por palabras (subsecuencia común más larga). */
export function wordDiff(a: string, b: string): DiffPart[] {
  const x = a.split(/\s+/).filter(Boolean)
  const y = b.split(/\s+/).filter(Boolean)
  const lcs: number[][] = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0))
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) {
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const parts: DiffPart[] = []
  const push = (text: string, type: DiffPart["type"]) => {
    const last = parts[parts.length - 1]
    if (last?.type === type) last.text += " " + text
    else parts.push({ text, type })
  }
  let i = 0
  let j = 0
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      push(x[i], "same")
      i++
      j++
    }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) push(x[i++], "del")
    else push(y[j++], "add")
  }
  while (i < x.length) push(x[i++], "del")
  while (j < y.length) push(y[j++], "add")
  return parts
}
