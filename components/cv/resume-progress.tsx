"use client"

import { useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import { useWatch } from "react-hook-form"
import { CheckIcon, ChevronRightIcon } from "lucide-react"
import { GlassPanel } from "@/components/glass-panel"
import { SwapText } from "@/components/motion/swap-text"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { completeness, nextMissing } from "@/lib/cv/completeness"
import type { CV } from "@/lib/schemas/cv"

const FOCUSABLE = "input:not([type=hidden]), textarea, select, button"

/**
 * Tarjeta de avance de «Your resume» (esquina inferior derecha, fija): cuánto del perfil está lleno, qué falta y un botón que LLEVA a la siguiente cosa
 * pendiente con un desplazamiento suave (y enfoca el campo al llegar). Cada pulsación va al siguiente pendiente; al final da la vuelta.
 * Con «reducir movimiento» el salto es directo. Pedida por Juan el 27-nov-2026.

 */
export function ResumeProgress() {
  // Lee el formulario por su cuenta: así solo esta tarjeta se vuelve a pintar al teclear, no toda la pantalla.
  const cv = useWatch() as unknown as Partial<CV>
  const reduce = useReducedMotion()
  const { done, total, percent, missing } = completeness(cv)
  const [lastId, setLastId] = useState<string | undefined>(undefined)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const next = nextMissing(missing, lastId)

  function go() {
    const item = nextMissing(missing, lastId)
    if (!item) return
    setLastId(item.id)
    const el = document.getElementById(item.target)
    if (!el) return
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" })
    // Se enfoca al terminar el desplazamiento (sin `preventScroll` el navegador daría un salto brusco a mitad del movimiento).
    clearTimeout(timer.current)
    timer.current = setTimeout(
      () => {
        const target = el.matches(FOCUSABLE) ? el : el.querySelector<HTMLElement>(FOCUSABLE)
        target?.focus({ preventScroll: true })
      },
      reduce ? 0 : 450,
    )
  }

  const complete = missing.length === 0
  const falta = complete || !next ? "Ya tienes todo lo esencial." : `Continúa con ${next.label}${missing.length > 1 ? ` y ${missing.length - 1} más` : ""}`
  return (
    // Ancho fijo (14 rem en pantallas anchas; en móvil, de margen a margen): el contenido cambia, la tarjeta no.
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-20 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-56">
      <GlassPanel className="pointer-events-auto flex w-full flex-col gap-3 bg-background p-3 motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <SwapText id={complete ? "listo" : "pendiente"} className="h-5 min-w-0">
              <h2 className="truncate text-sm font-medium">{complete ? "Tu perfil está completo" : "Completa tu perfil"}</h2>
            </SwapText>
            <SwapText id={falta} className="h-4 min-w-0">
              <p className="truncate text-xs text-muted-foreground" aria-live="polite">
                {falta}
              </p>
            </SwapText>
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {complete && <CheckIcon data-icon="inline-start" aria-hidden />}
            <SwapText id={percent}>{percent} %</SwapText>
          </Badge>
        </div>
        <Progress value={percent} aria-label="Avance de tu perfil" className="gap-2">
          <ProgressLabel className="text-xs text-muted-foreground">Progreso</ProgressLabel>
          <ProgressValue className="text-xs">{() => <SwapText id={`${done}/${total}`}>{`${done}/${total}`}</SwapText>}</ProgressValue>
        </Progress>
        <div className="flex h-5 items-center justify-start">
          <SwapText id={next ? "continuar" : "sin-pendientes"} className="min-w-0">
            {next ? (
              <Button type="button" variant="link" size="sm" className="h-5 max-w-full px-0 text-muted-foreground hover:text-foreground" onClick={go}>
                <span className="truncate">Continuar</span>
                <ChevronRightIcon data-icon="inline-end" aria-hidden />
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Sin pendientes</span>
            )}
          </SwapText>
        </div>
      </GlassPanel>
    </div>
  )
}
