/**
 * «Foto» de la pantalla de login para el efecto lupa: dibuja en un canvas 2D lo que HOY muestra el DOM (rectángulos con su color y su radio, textos línea por línea con su
 * fuente y su color reales, y los SVG). No duplica el diseño: lee los estilos calculados, así que si cambia el login, la foto cambia sola. No usa `foreignObject` (que falla
 * en Safari). Lo que no se puede copiar (sombras, pseudoelementos como el borde del avatar) se pierde; el efecto termina fundiéndose con la página real, así que no se nota.
 */

export type TextLine = { text: string; left: number; top: number; height: number }

/** Radio de esquina en px: `border-radius: 9999px` llega como un número enorme; se limita a la mitad del lado menor. */
export function cornerRadius(raw: string, w: number, h: number): number {
  const r = parseFloat(raw)
  if (!Number.isFinite(r) || r <= 0) return 0
  return Math.min(r, w / 2, h / 2)
}

/** Parte los caracteres de un texto en líneas según su posición: un salto de línea es un cambio de `top` mayor que media altura. Ignora los blancos colapsados (sin caja). */
export function groupLines(chars: { ch: string; left: number; top: number; width: number; height: number }[]): TextLine[] {
  const lines: TextLine[] = []
  let cur: TextLine | null = null
  for (const c of chars) {
    if (c.width <= 0 || c.height <= 0) continue
    if (!cur || Math.abs(c.top - cur.top) > c.height / 2) {
      cur = { text: "", left: c.left, top: c.top, height: c.height }
      lines.push(cur)
    }
    cur.text += c.ch
  }
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+$/, "") })).filter((l) => l.text.length > 0)
}

function textLines(node: Text): TextLine[] {
  const range = document.createRange()
  const chars: { ch: string; left: number; top: number; width: number; height: number }[] = []
  const data = node.data
  for (let i = 0; i < data.length; i++) {
    range.setStart(node, i)
    range.setEnd(node, i + 1)
    const r = range.getClientRects()[0]
    if (r) chars.push({ ch: data[i], left: r.left, top: r.top, width: r.width, height: r.height })
  }
  range.detach?.()
  return groupLines(chars)
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r)
  else {
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }
}

const transparent = (c: string) => c === "transparent" || /rgba?\([^)]*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c)

async function drawSvg(ctx: CanvasRenderingContext2D, svg: SVGSVGElement, rect: DOMRect, color: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  clone.setAttribute("width", String(rect.width))
  clone.setAttribute("height", String(rect.height))
  const xml = new XMLSerializer().serializeToString(clone).replace(/currentColor/g, color)
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Dibuja `root` (y todo lo que contiene) sobre un canvas del tamaño de la ventana, con el fondo de la app. Devuelve el canvas y el color de fondo (para el shader). */
export async function rasterize(root: HTMLElement, width: number, height: number, dpr: number): Promise<{ canvas: HTMLCanvasElement; bg: [number, number, number] }> {
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("sin canvas 2D")
  ctx.scale(dpr, dpr)
  const bgColor = getComputedStyle(document.body).backgroundColor
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, width, height)
  // Los colores del tema llegan en sintaxis moderna (`lab(...)`, `oklch(...)`): no se leen con una expresión regular, se le pregunta al propio canvas qué píxel salió.
  const px = ctx.getImageData(0, 0, 1, 1).data
  const svgJobs: Promise<void>[] = []

  const visit = (el: Element) => {
    const cs = getComputedStyle(el)
    if (cs.display === "none" || cs.visibility === "hidden") return
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      if (el instanceof SVGSVGElement) {
        svgJobs.push(drawSvg(ctx, el, rect, cs.color).catch(() => {}))
        return
      }
      const r = cornerRadius(cs.borderTopLeftRadius, rect.width, rect.height)
      if (!transparent(cs.backgroundColor)) {
        ctx.fillStyle = cs.backgroundColor
        roundRectPath(ctx, rect.left, rect.top, rect.width, rect.height, r)
        ctx.fill()
      }
      const bw = parseFloat(cs.borderTopWidth)
      if (bw > 0 && cs.borderTopStyle !== "none" && !transparent(cs.borderTopColor)) {
        ctx.strokeStyle = cs.borderTopColor
        ctx.lineWidth = bw
        roundRectPath(ctx, rect.left + bw / 2, rect.top + bw / 2, rect.width - bw, rect.height - bw, Math.max(0, r - bw / 2))
        ctx.stroke()
      }
    }
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) visit(child as Element)
      else if (child.nodeType === Node.TEXT_NODE && (child as Text).data.trim()) {
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
        ctx.fillStyle = cs.color
        ctx.textBaseline = "alphabetic"
        ;(ctx as unknown as { letterSpacing: string }).letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing
        for (const line of textLines(child as Text)) {
          const metrics = ctx.measureText(line.text)
          const ascent = metrics.fontBoundingBoxAscent ?? line.height * 0.8
          ctx.fillText(line.text, line.left, line.top + ascent)
        }
      }
    }
  }
  visit(root)
  await Promise.all(svgJobs)
  return { canvas, bg: [px[0] / 255, px[1] / 255, px[2] / 255] }
}
