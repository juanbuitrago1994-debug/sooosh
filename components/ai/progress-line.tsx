"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Spinner } from "@/components/ui/spinner"
import { MOTION, TRANSITION_IN, TRANSITION_OUT, TRANSITION_SOFT } from "@/lib/motion"

/**
 * ProgressLine — el patrón de carga de la app en UNA línea: spinner de shadcn + frase que cambia sola cada 2,4 s + porcentaje, centrado. Lo usan el panel
 * «Mi CV» (mientras se lee el CV) y la lista de ofertas (mientras se busca). Las frases van sin puntos suspensivos. Solo opacity, blur y translate.
 * `soft`: las tres piezas entran una tras otra (spinner → frase → porcentaje) con la entrada MUY suave (`TRANSITION_SOFT`), en vez de aparecer de golpe.
 * Con «reducir movimiento» no se anima nada. El porcentaje lo calcula quien la usa: aquí solo se muestra (`role="progressbar"`).
 */
const noDots = (t: string) => t.replace(/[\s….]+$/u, "")

function Part({ index, soft, children }: { index: number; soft: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion()
  if (!soft || reduce) return <span className="inline-flex items-center">{children}</span>
  return (
    <motion.span
      className="inline-flex items-center"
      initial={{ opacity: 0, y: MOTION.offset, filter: `blur(${MOTION.blur}px)` }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { ...TRANSITION_SOFT, delay: index * MOTION.softStagger } }}
    >
      {children}
    </motion.span>
  )
}

function Phrase({ messages }: { messages: string[] }) {
  const reduce = useReducedMotion()
  const list = messages.map(noDots)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (list.length < 2) return
    const t = setInterval(() => setI((n) => (n + 1) % list.length), 2400)
    return () => clearInterval(t)
  }, [list.length])
  const text = list[i % list.length] ?? ""
  return (
    <span className="relative flex h-6 items-center justify-center text-muted-foreground">
      {reduce ? (
        <span>{text}</span>
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            className="whitespace-nowrap"
            initial={{ opacity: 0, y: MOTION.offset, filter: `blur(${MOTION.blur}px)` }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: TRANSITION_IN }}
            exit={{ opacity: 0, y: -MOTION.offset, filter: `blur(${MOTION.blur}px)`, transition: TRANSITION_OUT }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      )}
    </span>
  )
}

export function ProgressLine({ messages, percent, label, soft = false, className }: { messages: string[]; percent: number; /** nombre accesible del porcentaje */ label: string; soft?: boolean; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center gap-2 text-sm ${className ?? ""}`}>
      <Part index={0} soft={soft}>
        <Spinner aria-hidden role="presentation" />
      </Part>
      <Part index={1} soft={soft}>
        <Phrase messages={messages} />
      </Part>
      <Part index={2} soft={soft}>
        <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="text-muted-foreground tabular-nums">
          {percent} %
        </span>
      </Part>
    </div>
  )
}
