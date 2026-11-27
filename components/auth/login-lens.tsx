"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { animate, useReducedMotion } from "motion/react"
import { LensTuner } from "@/components/auth/lens-tuner"
import { DEFAULT_LENS, type LensParams } from "@/lib/lens/frame"

type Run = { canvas: HTMLCanvasElement; finished: Promise<void>; skip: () => void; destroy: () => void }

/** El panel de ajuste solo existe en desarrollo y con `?afinar=1` (en el servidor siempre es falso: sin diferencias de hidratación). */
const tunerFlag = () => process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("afinar")
const subscribeNothing = () => () => {}

/**
 * Entrada del login: al cargar o recargar, la pantalla se «dibuja» con un efecto de lupa con prisma que baja de arriba a abajo (WebGL con OGL, ver `lib/lens/` y `docs/PLAN-LOGIN-LUPA.md`).
 * El contenido real existe desde el principio (lectores de pantalla, teclado) pero invisible hasta que termina el efecto; un clic o una tecla lo saltan. Sin WebGL o con «reducir
 * movimiento» no hay lupa: aparece con un fundido suave (o al instante). Excepción documentada a «nunca distorsionar» (CLAUDE.md): solo en `/login`.
 */
export function LoginLens({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const runRef = useRef<Run | null>(null)
  /** Cada ejecución lleva un número; si mientras espera (módulo, foto, lienzo) llega otra o se desmonta, la vieja se destruye en vez de quedar huérfana (React en desarrollo ejecuta los efectos dos veces). */
  const genRef = useRef(0)
  // En desarrollo, `window.__LENS_OVERRIDE` permite probar valores desde un script de pruebas sin tocar el código (no existe en producción).
  const initial = (): LensParams => ({ ...DEFAULT_LENS, ...(process.env.NODE_ENV !== "production" ? (window as unknown as { __LENS_OVERRIDE?: Partial<LensParams> }).__LENS_OVERRIDE : undefined) })
  const paramsRef = useRef<LensParams>(DEFAULT_LENS)
  const [params, setParams] = useState<LensParams>(DEFAULT_LENS)
  const tuning = useSyncExternalStore(subscribeNothing, tunerFlag, () => false)
  const reduce = useReducedMotion()

  /** Corre la lupa una vez con los parámetros actuales. `first`: es la entrada de la página (la real está invisible debajo); si no, es una repetición del panel de ajuste. */
  const play = useCallback(async (first: boolean) => {
    const el = ref.current
    if (!el) return
    runRef.current?.destroy()
    const gen = ++genRef.current
    const { runLens } = await import("@/lib/lens/run")
    const run = await runLens(el, paramsRef.current)
    if (genRef.current !== gen) return run.destroy() // se canceló mientras se preparaba
    runRef.current = run
    await run.finished
    if (runRef.current !== run) return
    // La página real ya está debajo (idéntica a la última imagen): se enciende y el lienzo se funde.
    if (first) el.style.opacity = "1"
    await animate(run.canvas, { opacity: 0 }, { duration: 0.35, ease: "easeOut" })
    run.destroy()
    if (runRef.current === run) runRef.current = null
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const start = initial()
    paramsRef.current = start
    queueMicrotask(() => setParams(start))
    let alive = true
    const reveal = (seconds: number) => void animate(el, { opacity: 1 }, { duration: seconds, ease: "easeOut" })
    // Seguro: pase lo que pase, la página nunca queda invisible.
    const safety = setTimeout(() => reveal(0.3), 7000)
    const skip = () => runRef.current?.skip()

    void (async () => {
      if (reduce) return reveal(0)
      try {
        await document.fonts?.ready
        if (!alive) return
        window.addEventListener("pointerdown", skip, { once: true })
        window.addEventListener("keydown", skip, { once: true })
        await play(true)
      } catch (e) {
        console.warn("[login] sin efecto lupa:", e)
        runRef.current?.destroy()
        reveal(0.6)
      }
    })()

    return () => {
      alive = false
      genRef.current++
      clearTimeout(safety)
      window.removeEventListener("pointerdown", skip)
      window.removeEventListener("keydown", skip)
      runRef.current?.destroy()
      runRef.current = null
    }
  }, [reduce, play])

  const change = (p: LensParams) => {
    paramsRef.current = p
    setParams(p)
  }

  return (
    <>
      {tuning && <LensTuner params={params} onChange={change} onReplay={() => void play(false).catch((e) => console.warn("[login] repetición:", e))} />}
      <div ref={ref} className="flex flex-1 flex-col" style={{ opacity: 0 }}>
        {children}
      </div>
    </>
  )
}
