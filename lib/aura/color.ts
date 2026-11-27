/**
 * Convierte un color `oklch(L C H)` (la sintaxis de los tokens de `lib/design-tokens.ts`) a sRGB (0 a 1) para pasarlo a un shader. Los tokens del tema están en OKLCH y WebGL necesita
 * componentes RGB: se usa la matriz estándar de Björn Ottosson (OKLab → sRGB lineal → gamma sRGB). Un valor fuera de gama se recorta.
 */
export function oklchToRgb(css: string): [number, number, number] {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(css)
  if (!m) throw new Error(`Color OKLCH no válido: ${css}`)
  const L = parseFloat(m[1])
  const C = parseFloat(m[2])
  const h = (parseFloat(m[3]) * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const mm = m_ ** 3
  const s = s_ ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s]
  const gamma = (v: number) => {
    const c = Math.min(1, Math.max(0, v))
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
  }
  return [gamma(lin[0]), gamma(lin[1]), gamma(lin[2])]
}
