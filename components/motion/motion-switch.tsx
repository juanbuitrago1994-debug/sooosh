"use client"

import { useState } from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "cn"

/**
 * Interruptor de toda la app: el `Switch` de shadcn (misma pista, mismo foco, mismo teclado) con el movimiento de la bolita del
 * «Toggle» de transitions.dev: viaja con doble rebote (pasa 1 px del final, vuelve y se asienta) en 350 ms, y no se anima al
 * montar. Con `prefers-reduced-motion` cambia de lado al instante. El movimiento va con `motion` (ya aprobada), sin CSS propio.
 */
const DUR = 0.35
const EASE = [0.34, 1.35, 0.64, 1] as const
const OVERSHOOT = 1
/** recorrido libre de la bolita: ancho de la pista − bolita − bordes (default 32−16−2, sm 24−12−2) */
const TRAVEL = { default: 14, sm: 10 } as const

type Props = Omit<SwitchPrimitive.Root.Props, "children"> & { size?: "sm" | "default" }

function MotionSwitch({ className, size = "default", checked, defaultChecked, onCheckedChange, ...props }: Props) {
  const reduce = useReducedMotion()
  const [inner, setInner] = useState(!!defaultChecked)
  const on = checked ?? inner
  const travel = TRAVEL[size]
  // La primera vez solo se coloca la bolita; la animación llega con el primer cambio (ajuste de estado durante el render).
  const [prev, setPrev] = useState(on)
  const [settled, setSettled] = useState(false)
  if (prev !== on) {
    setPrev(on)
    setSettled(true)
  }
  const to = on ? travel : 0
  const from = on ? 0 : travel
  const bounce = !reduce && settled
  const animate = bounce ? { x: [from, to + (on ? OVERSHOOT : -OVERSHOOT), to, to] } : { x: to }

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      checked={on}
      onCheckedChange={(v, e) => {
        setInner(v)
        onCheckedChange?.(v, e)
      }}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors outline-none group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        render={<motion.span initial={false} animate={animate} transition={bounce ? { duration: DUR, ease: EASE, times: [0, 0.55, 0.8, 1] } : { duration: 0 }} />}
        className="pointer-events-none block rounded-full bg-background ring-0 group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { MotionSwitch as Switch }
