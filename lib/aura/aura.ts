import { Mesh, Program, Renderer, Triangle } from "ogl"
import { EFFECT_COLORS as C } from "@/lib/design-tokens"
import { oklchToRgb } from "./color"
import { AURA_FRAGMENT } from "./aura-shader"
import { VERTEX } from "@/lib/lens/shaders"

/**
 * Parámetros del aura (para ajustarla a ojo, como `LENS` en el login). Las distancias van en ALTOS de pantalla y los tiempos en segundos.
 * Halo: `radius` = radio del anillo de luz; `width` = su ancho; `hole` = cuánto se atenúa el centro (0 = halo lleno, 1 = centro vacío; así el mensaje se lee); `intensity` = brillo en calma;
 * `warp` = cuánto deforma el ruido el contorno (orgánico); `scale` = tamaño de las manchas de ruido; `flow` = velocidad a la que fluye el color.
 * Respiración (bucle): `breathHz` = respiraciones por segundo; `breathRadius` y `breathLight` = cuánto cambian el radio y el brillo.
 * GOLPE (primer contacto, una vez): `hit` = brillo extra del golpe; `hitDecayS` = cuánto tarda en calmarse; `swell` = cuánto se hincha el halo (múltiplo del radio, decae igual);
 * `shockS` = segundos que tarda la onda de luz en llegar al borde; `shockPower` = qué tan brusca es su salida (mayor = más rápida al inicio y más calmada al final); `shockWidth` = su ancho.
 * PULSOS (bucle): empiezan a los `pulseStartS`; uno cada `pulseEveryS`; `pulseAmp` = fuerza (mucho menor que el golpe).
 * `reach` = radio al que llega la onda. `fadeInMs`/`fadeOutMs`: fundido del lienzo al aparecer (rápido, para que el golpe no quede tapado) y al irse. `renderScale`: resolución (el aura es suave).
 */
export const AURA = {
  radius: 0.27,
  width: 0.15,
  hole: 0.6,
  intensity: 0.42,
  warp: 0.8,
  scale: 1.7,
  flow: 0.06,
  breathHz: 0.28,
  breathRadius: 0.06,
  breathLight: 0.2,
  hit: 1.1,
  hitDecayS: 0.9,
  swell: 0.45,
  shockS: 1.8,
  shockPower: 3.5,
  shockWidth: 0.1,
  pulseStartS: 2.2,
  pulseEveryS: 3.8,
  pulseAmp: 0.32,
  reach: 1.25,
  fadeInMs: 120,
  fadeOutMs: 600,
  renderScale: 0.5,
} as const
export type AuraParams = { [K in keyof typeof AURA]: number }

/** La paleta: los 5 tonos fríos documentados del haz (`flow-*` en `lib/design-tokens.ts`), en el orden en que giran alrededor del halo. */
export const AURA_PALETTE = [C["flow-slate"], C["flow-blue"], C["flow-ice"], C["flow-sky"], C["flow-gray"]] as const

/**
 * Lo que valen el golpe y la hinchazón a los `t` segundos desde que empezó: arrancan al máximo y decaen de forma exponencial (fuerte de golpe, luego calma). `shock` es el avance
 * (0 a 1; después de 1, apagado) de la onda de luz del golpe. Función pura para probarla.
 */
export function auraHit(t: number, p: AuraParams = AURA): { hit: number; swell: number; shock: number } {
  const decay = Math.exp(-Math.max(0, t) / p.hitDecayS)
  return { hit: p.hit * decay, swell: p.swell * decay, shock: Math.max(0, t) / p.shockS }
}

/** `stop`: funde el lienzo y lo retira. `destroy`: lo retira ya. */
export type AuraRun = { canvas: HTMLCanvasElement; stop: () => Promise<void>; destroy: () => void }

/**
 * Aura de luz sobre un lienzo transparente a pantalla completa colocado dentro de `mount` (un contenedor fijo). Es decorativo (`aria-hidden`, no recibe clics) y se funde al entrar
 * (rápido) y al salir. El golpe empieza en el primer cuadro dibujado y la respiración y los pulsos siguen en bucle. Lanza un error si no hay WebGL: quien lo llama simplemente no muestra aura.
 */
export function runAura(mount: HTMLElement, params: AuraParams = AURA): AuraRun {
  const width = window.innerWidth
  const height = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const canvas = document.createElement("canvas")
  canvas.setAttribute("aria-hidden", "true")
  canvas.className = "absolute inset-0 size-full opacity-0 transition-opacity duration-150"
  mount.appendChild(canvas)
  let renderer: Renderer
  try {
    renderer = new Renderer({ canvas, dpr: Math.max(0.3, dpr * params.renderScale), width, height, alpha: true, premultipliedAlpha: true, antialias: false })
  } catch (e) {
    canvas.remove()
    throw e
  }
  const gl = renderer.gl
  if (!gl) {
    canvas.remove()
    throw new Error("sin WebGL")
  }
  gl.clearColor(0, 0, 0, 0)
  const [c0, c1, c2, c3, c4] = AURA_PALETTE.map(oklchToRgb)
  const program = new Program(gl, {
    vertex: VERTEX,
    fragment: AURA_FRAGMENT,
    transparent: true,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: width / height },
      uRadius: { value: params.radius },
      uWidth: { value: params.width },
      uHole: { value: params.hole },
      uIntensity: { value: params.intensity },
      uWarp: { value: params.warp },
      uScale: { value: params.scale },
      uFlow: { value: params.flow },
      uBreathHz: { value: params.breathHz },
      uBreathRadius: { value: params.breathRadius },
      uBreathLight: { value: params.breathLight },
      uHit: { value: params.hit },
      uSwell: { value: params.swell },
      uShock: { value: 0 },
      uShockWidth: { value: params.shockWidth },
      uShockPower: { value: params.shockPower },
      uPulseStart: { value: params.pulseStartS },
      uPulseEvery: { value: params.pulseEveryS },
      uPulseAmp: { value: params.pulseAmp },
      uReach: { value: params.reach },
      uC0: { value: c0 },
      uC1: { value: c1 },
      uC2: { value: c2 },
      uC3: { value: c3 },
      uC4: { value: c4 },
    },
  })
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program })

  let destroyed = false
  let raf = 0
  // El reloj arranca en el PRIMER cuadro que se dibuja: el golpe se ve completo.
  let t0 = -1
  const frame = (now: number) => {
    if (destroyed) return
    raf = requestAnimationFrame(frame)
    if (document.hidden) return // pestaña oculta: no se gasta GPU
    if (t0 < 0) t0 = now
    const t = (now - t0) / 1000
    const h = auraHit(t, params)
    program.uniforms.uTime.value = t
    program.uniforms.uHit.value = h.hit
    program.uniforms.uSwell.value = h.swell
    program.uniforms.uShock.value = h.shock
    renderer.render({ scene: mesh })
  }
  raf = requestAnimationFrame(frame)
  // El lienzo se enciende tras dibujar el primer cuadro (fundido corto): el golpe empieza justo cuando se ve.
  requestAnimationFrame(() => requestAnimationFrame(() => canvas.classList.replace("opacity-0", "opacity-100")))

  const destroy = () => {
    if (destroyed) return
    destroyed = true
    cancelAnimationFrame(raf)
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    canvas.remove()
  }
  const stop = async () => {
    if (destroyed) return
    canvas.classList.replace("duration-150", "duration-500")
    canvas.classList.replace("opacity-100", "opacity-0")
    await new Promise((r) => setTimeout(r, params.fadeOutMs))
    destroy()
  }
  return { canvas, stop, destroy }
}
