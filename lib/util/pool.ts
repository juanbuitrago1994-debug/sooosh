/** Ejecuta `fn` sobre cada elemento con como máximo `limit` en paralelo, conservando el orden de los resultados. */
export async function mapWithLimit<I, O>(items: I[], limit: number, fn: (item: I, index: number) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i], i)
      }
    }),
  )
  return out
}
