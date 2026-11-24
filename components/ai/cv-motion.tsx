"use client"

import { CheckIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { MOTION, TRANSITION_IN } from "@/lib/motion"

/**
 * CvMotion — un CV minimalista y monocromático (un solo color, el del tema, en varios tonos de opacidad) que «se escribe» mientras la IA
 * trabaja. Solo opacity y translate (regla de movimiento): una cubierta del color de la hoja se desliza sobre cada línea y la deja ver de
 * izquierda a derecha, con un retardo entre líneas, mientras una franja tenue baja por la hoja. En «done» las líneas quedan escritas y
 * aparece una marca. Decorativo (`aria-hidden`): el estado lo cuenta el texto del panel. Con «reducir movimiento», todo queda quieto.
 */
export type CvMotionState = "idle" | "working" | "done"

type Row = { width: string; tone: "strong" | "soft" }
const ROWS: Row[] = [
  { width: "w-1/3", tone: "strong" },
  { width: "w-full", tone: "soft" },
  { width: "w-5/6", tone: "soft" },
  { width: "w-full", tone: "soft" },
  { width: "w-1/3", tone: "strong" },
  { width: "w-full", tone: "soft" },
  { width: "w-2/3", tone: "soft" },
  { width: "w-1/3", tone: "strong" },
  { width: "w-3/4", tone: "soft" },
]

function Line({ row, index, working }: { row: Row; index: number; working: boolean }) {
  return (
    <span data-cv-line className={`relative block h-1 overflow-hidden rounded-full ${row.width} ${row.tone === "strong" ? "bg-primary/50" : "bg-primary/25"}`}>
      {working && (
        <motion.span
          data-cv-cover
          className="absolute inset-0 bg-card"
          animate={{ x: ["0%", "100%", "100%", "0%"] }}
          transition={{ duration: MOTION.cvCycle, times: [0, 0.4, 0.85, 1], ease: MOTION.ease, delay: index * MOTION.cvLine, repeat: Infinity }}
        />
      )}
    </span>
  )
}

export function CvMotion({ state = "idle", className }: { state?: CvMotionState; className?: string }) {
  const reduce = useReducedMotion()
  const working = state === "working" && !reduce
  return (
    <div aria-hidden data-cv-motion={state} className={`relative flex h-36 w-32 flex-col gap-2 overflow-hidden rounded-lg border bg-card p-3 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <span className="size-5 shrink-0 rounded-full bg-primary/30" />
        <span className="block h-1.5 w-10 rounded-full bg-primary/60" />
      </div>
      {ROWS.map((row, i) => (
        <Line key={i} row={row} index={i} working={working} />
      ))}
      {working && (
        <motion.span
          data-cv-sweep
          className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-primary/10 blur-md"
          animate={{ y: [0, 190] }}
          transition={{ duration: MOTION.cvSweep, ease: MOTION.ease, repeat: Infinity }}
        />
      )}
      {state === "done" && (
        <motion.span
          data-cv-check
          className="absolute right-2 bottom-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: MOTION.offset }}
          animate={{ opacity: 1, y: 0, transition: TRANSITION_IN }}
        >
          <CheckIcon className="size-3" />
        </motion.span>
      )}
    </div>
  )
}
