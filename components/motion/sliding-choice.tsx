"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { MOTION } from "@/lib/motion"

/**
 * SlidingChoice — selector de una opción entre pocas (segmentado) con una píldora que se desliza hasta la opción activa. Es el «Tabs sliding»
 * de transitions.dev (https://transitions.dev/detail.html?t=tabs-sliding; la página invita a copiar su CSS/JS), reescrito con tokens del tema:
 * la píldora mide la opción activa (`offsetLeft`/`offsetWidth`) y se mueve con `transform` y `width` en 250 ms con la curva suave de la app;
 * en el primer pintado y al cambiar el tamaño se coloca SIN animación. Con «reducir movimiento» no anima. Semántica de grupo de radios
 * (flechas para cambiar, Tab entra a la opción activa).
 */
const DURATION_MS = 250

export type ChoiceOption = { value: string; label: string }

export function SlidingChoice({ value, onValueChange, options, label, className }: { value: string; onValueChange: (value: string) => void; options: readonly ChoiceOption[]; label: string; className?: string }) {
  const reduce = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const mounted = useRef(false)
  const [ready, setReady] = useState(false)
  const id = useId()
  const selected = Math.max(0, options.findIndex((o) => o.value === value))

  const place = (animate: boolean) => {
    const tab = refs.current[selected]
    const pill = pillRef.current
    if (!tab || !pill) return
    const prev = pill.style.transitionDuration
    if (!animate) pill.style.transitionDuration = "0ms"
    pill.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`
    pill.style.width = `${tab.offsetWidth}px`
    pill.style.height = `${tab.offsetHeight}px`
    if (!animate) {
      void pill.offsetWidth // fija la posición antes de devolver la transición
      pill.style.transitionDuration = prev
    }
  }

  // Al cambiar la opción: se desliza (salvo el primer pintado o «reducir movimiento»).
  useEffect(() => {
    place(mounted.current && !reduce)
    if (!mounted.current) {
      mounted.current = true
      setReady(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `place` depende solo de `selected`
  }, [selected])

  // Si cambia el ancho (ventana, fuentes, panel que termina de abrirse), la píldora se recoloca sin animar.
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => place(false))
    ro.observe(root)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (i + step + options.length) % options.length
    onValueChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div ref={rootRef} role="radiogroup" aria-label={label} className={cn("relative flex w-full items-center gap-1 rounded-full bg-muted p-1", className)}>
      <span
        ref={pillRef}
        aria-hidden
        className={cn("pointer-events-none absolute top-0 left-0 z-0 rounded-full border border-border/40 bg-background will-change-transform", ready ? "opacity-100" : "opacity-0")}
        style={{ transitionProperty: "transform, width, height", transitionDuration: reduce ? "0ms" : `${DURATION_MS}ms`, transitionTimingFunction: `cubic-bezier(${MOTION.ease.join(",")})` }}
      />
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el
          }}
          id={`${id}-${o.value}`}
          type="button"
          role="radio"
          aria-checked={i === selected}
          tabIndex={i === selected ? 0 : -1}
          onClick={() => onValueChange(o.value)}
          onKeyDown={(e) => onKeyDown(e, i)}
          className="relative z-10 flex h-8 min-w-0 flex-1 items-center justify-center rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors duration-250 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset aria-checked:text-foreground pointer-coarse:h-11"
        >
          <span className="truncate">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
