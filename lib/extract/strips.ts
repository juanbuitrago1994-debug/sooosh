/**
 * Parte una página renderizada (PNG) en franjas horizontales para el OCR.
 * Tesseract pierde líneas cuando una decoración (banner, degradado, íconos) confunde el análisis de la
 * página; con franjas más bajas cada región se analiza por separado. Los cortes se hacen en la fila
 * más "vacía" (menor contraste) cerca del objetivo, para no partir una línea de texto por la mitad.
 */
export const STRIP_HEIGHT = 800
/** Cuánto se busca el mejor corte alrededor del objetivo (px). */
const SEARCH = 150

export async function sliceIntoStrips(png: Uint8Array, targetHeight = STRIP_HEIGHT): Promise<Uint8Array[]> {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas")
  const img = await loadImage(Buffer.from(png))
  const { width, height } = img
  if (height <= targetHeight * 1.25) return [png]

  const full = createCanvas(width, height)
  const g = full.getContext("2d")
  g.drawImage(img, 0, 0)
  const data = g.getImageData(0, 0, width, height).data

  /** Contraste de una fila (máx − mín de luminancia, muestreada). Bajo = fila sin texto. */
  const rowContrast = (y: number) => {
    let min = 255
    let max = 0
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * 4
      const l = (data[i] * 3 + data[i + 1] * 6 + data[i + 2]) / 10
      if (l < min) min = l
      if (l > max) max = l
    }
    return max - min
  }

  const cuts: number[] = [0]
  while (height - cuts[cuts.length - 1] > targetHeight * 1.25) {
    const goal = cuts[cuts.length - 1] + targetHeight
    let best = goal
    let bestScore = Infinity
    for (let y = goal - SEARCH; y <= Math.min(goal + SEARCH, height - 1); y++) {
      const s = rowContrast(y)
      if (s < bestScore) {
        bestScore = s
        best = y
      }
    }
    cuts.push(best)
  }
  cuts.push(height)

  return cuts.slice(0, -1).map((y0, i) => {
    const h = cuts[i + 1] - y0
    const c = createCanvas(width, h)
    c.getContext("2d").drawImage(full, 0, y0, width, h, 0, 0, width, h)
    return new Uint8Array(c.toBuffer("image/png"))
  })
}
