import { Mesh, Program, Renderer, Texture, Triangle } from "ogl"
import { animate } from "motion/react"
import { DEFAULT_LENS, lensFrame, type LensParams } from "./frame"
import { rasterize } from "./rasterize"
import { FRAGMENT, VERTEX } from "./shaders"

/** `canvas`: el lienzo que cubre la pantalla (para fundirlo al terminar). `finished`: termina cuando la lente salió. `skip`: salta al final. `destroy`: lo retira y libera WebGL. */
export type LensRun = { canvas: HTMLCanvasElement; finished: Promise<void>; skip: () => void; destroy: () => void }

/**
 * Efecto lupa de entrada: dibuja una «foto» de `root` en una textura, la pone en un canvas a pantalla completa y pasa por encima una lente que baja de arriba a abajo
 * deformando y descubriendo el contenido. Al terminar, la imagen es idéntica a la página real. El canvas es decorativo (`aria-hidden`, no recibe clics). Lanza un error si
 * no hay WebGL: quien lo llama debe mostrar la página sin efecto.
 */
export async function runLens(root: HTMLElement, params: LensParams = DEFAULT_LENS, opts: { onNearEnd?: () => void } = {}): Promise<LensRun> {
  const width = window.innerWidth
  const height = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  // La «foto» se hace a resolución completa (nítida); el lienzo se anima a menos resolución (más fluido) TODO el efecto: cambiarla a medio camino provocaba un tirón justo al final.
  const { canvas: photo, bg } = await rasterize(root, width, height, dpr)
  const animDpr = Math.max(0.3, dpr * params.renderScale)

  const canvas = document.createElement("canvas")
  canvas.setAttribute("aria-hidden", "true")
  canvas.className = "pointer-events-none fixed inset-0 z-50 size-full"
  document.body.appendChild(canvas)
  let renderer: Renderer
  try {
    // `preserveDrawingBuffer`: solo en desarrollo, para poder comprobar en las pruebas que el lienzo tiene contenido (en producción cuesta una copia por fotograma).
    renderer = new Renderer({ canvas, dpr: animDpr, width, height, alpha: false, antialias: false, preserveDrawingBuffer: process.env.NODE_ENV !== "production" })
  } catch (e) {
    canvas.remove()
    throw e
  }
  const gl = renderer.gl
  if (!gl) {
    canvas.remove()
    throw new Error("sin WebGL")
  }
  gl.clearColor(bg[0], bg[1], bg[2], 1)
  const texture = new Texture(gl, { image: photo, generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR })
  const program = new Program(gl, {
    vertex: VERTEX,
    fragment: FRAGMENT,
    uniforms: {
      uTexture: { value: texture },
      uBg: { value: bg },
      uCenter: { value: [params.x, params.startY] },
      uAspect: { value: width / height },
      uRadius: { value: params.radius },
      uWidth: { value: params.widthFactor },
      uStrength: { value: params.strength },
      uBulge: { value: 0 },
      uBand: { value: params.band },
      uDispersion: { value: params.dispersion },
      uPrism: { value: params.prism },
      uBlur: { value: params.blur },
      uRim: { value: params.rim },
      uColor: { value: 0 },
      uCurve: { value: params.curve },
      uAxis: { value: params.axis },
    },
  })
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program })

  let destroyed = false
  let nearEnd = false
  const draw = (p: number) => {
    const f = lensFrame(p, params)
    program.uniforms.uCenter.value = [params.x, f.lensY]
    program.uniforms.uBulge.value = f.bulge
    program.uniforms.uColor.value = f.color
    // Poco antes del final se avisa para encender la página real DEBAJO del lienzo (que la tapa por completo): así el coste de pintarla no cae sobre el último fotograma.
    if (!nearEnd && p >= 0.85) {
      nearEnd = true
      opts.onNearEnd?.()
    }
    renderer.render({ scene: mesh })
  }
  draw(0)

  let done!: () => void
  const finished = new Promise<void>((resolve) => (done = resolve))
  const controls = animate(0, 1, { duration: params.durationMs / 1000, ease: "linear", onUpdate: (p) => !destroyed && draw(p) })

  // Solo en desarrollo: permite a las pruebas dibujar el fotograma exacto de un avance `p` (sin depender del ritmo de fotogramas del navegador) y leer sus píxeles.
  if (process.env.NODE_ENV !== "production") (window as unknown as { __lensRenderAt?: (p: number) => void }).__lensRenderAt = (p) => (controls.pause(), draw(p))

  const destroy = () => {
    if (destroyed) return
    destroyed = true
    controls.stop()
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    canvas.remove()
  }
  const skip = () => {
    if (destroyed) return
    controls.complete()
  }
  controls.then(() => {
    if (!destroyed) draw(1)
    done()
  })
  return { canvas, finished, skip, destroy }
}
