import { Mesh, Program, Renderer, Texture, Triangle } from "ogl"
import { animate } from "motion/react"
import { LENS, lensFrame } from "./frame"
import { rasterize } from "./rasterize"
import { FRAGMENT, VERTEX } from "./shaders"

/** `canvas`: el lienzo que cubre la pantalla (para fundirlo al terminar). `finished`: termina cuando la lente salió. `skip`: salta al final. `destroy`: lo retira y libera WebGL. */
export type LensRun = { canvas: HTMLCanvasElement; finished: Promise<void>; skip: () => void; destroy: () => void }

/**
 * Efecto lupa de entrada: dibuja una «foto» de `root` en una textura, la pone en un canvas a pantalla completa y pasa por encima una lente que baja de arriba a abajo
 * deformando y descubriendo el contenido. Al terminar, la imagen es idéntica a la página real. El canvas es decorativo (`aria-hidden`, no recibe clics). Lanza un error si
 * no hay WebGL: quien lo llama debe mostrar la página sin efecto.
 */
export async function runLens(root: HTMLElement): Promise<LensRun> {
  const width = window.innerWidth
  const height = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const { canvas: photo, bg } = await rasterize(root, width, height, dpr)

  const canvas = document.createElement("canvas")
  canvas.setAttribute("aria-hidden", "true")
  canvas.className = "pointer-events-none fixed inset-0 z-50 size-full"
  document.body.appendChild(canvas)
  let renderer: Renderer
  try {
    // `preserveDrawingBuffer`: solo para poder comprobar en las pruebas que el canvas tiene contenido; en un efecto de 2 s no cuesta nada.
    renderer = new Renderer({ canvas, dpr, width, height, alpha: false, antialias: false, preserveDrawingBuffer: true })
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
      uCenter: { value: [LENS.x, LENS.startY] },
      uAspect: { value: width / height },
      uRadius: { value: LENS.radius },
      uStrength: { value: LENS.strength },
      uBulge: { value: 0 },
      uBand: { value: LENS.band },
    },
  })
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program })

  let destroyed = false
  const draw = (p: number) => {
    const f = lensFrame(p)
    program.uniforms.uCenter.value = [LENS.x, f.lensY]
    program.uniforms.uBulge.value = f.bulge
    renderer.render({ scene: mesh })
  }
  draw(0)

  let done!: () => void
  const finished = new Promise<void>((resolve) => (done = resolve))
  const controls = animate(0, 1, { duration: LENS.durationMs / 1000, ease: "linear", onUpdate: (p) => !destroyed && draw(p) })

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
