"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { animate, useReducedMotion } from "motion/react"

/**
 * Entrada del login: al cargar o recargar, la pantalla se «dibuja» con un efecto de lupa que baja de arriba a abajo (WebGL con OGL, ver `lib/lens/` y `docs/PLAN-LOGIN-LUPA.md`).
 * El contenido real existe desde el principio (lectores de pantalla, teclado) pero invisible hasta que termina el efecto; un clic o una tecla lo saltan. Sin WebGL o con «reducir
 * movimiento» no hay lupa: aparece con un fundido suave (o al instante). Excepción documentada a «nunca distorsionar» (CLAUDE.md): solo en `/login`.
 */
export function LoginLens({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let alive = true
    let run: { canvas: HTMLCanvasElement; finished: Promise<void>; skip: () => void; destroy: () => void } | null = null
    const reveal = (seconds: number) => void animate(el, { opacity: 1 }, { duration: seconds, ease: "easeOut" })
    // Seguro: pase lo que pase, la página nunca queda invisible.
    const safety = setTimeout(() => reveal(0.3), 7000)
    const skip = () => run?.skip()

    void (async () => {
      if (reduce) return reveal(0)
      try {
        await document.fonts?.ready
        const { runLens } = await import("@/lib/lens/run")
        if (!alive) return
        run = await runLens(el)
        if (!alive) return run.destroy()
        window.addEventListener("pointerdown", skip, { once: true })
        window.addEventListener("keydown", skip, { once: true })
        await run.finished
        if (!alive) return
        // La página real ya está debajo (idéntica a la última imagen): se enciende y el lienzo se funde.
        el.style.opacity = "1"
        const canvas = run.canvas
        await animate(canvas, { opacity: 0 }, { duration: 0.35, ease: "easeOut" })
        run.destroy()
      } catch (e) {
        console.warn("[login] sin efecto lupa:", e)
        run?.destroy()
        reveal(0.6)
      }
    })()

    return () => {
      alive = false
      clearTimeout(safety)
      window.removeEventListener("pointerdown", skip)
      window.removeEventListener("keydown", skip)
      run?.destroy()
    }
  }, [reduce])

  return (
    <div ref={ref} className="flex flex-1 flex-col" style={{ opacity: 0 }}>
      {children}
    </div>
  )
}
