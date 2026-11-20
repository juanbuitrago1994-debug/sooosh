"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

export type AiWork = { messages: string[]; step: number; onCancel?: () => void } | null

type Api = {
  work: AiWork
  /** La IA empieza a trabajar. `messages` son los pasos REALES del pipeline, en orden. */
  start: (messages: string[], onCancel?: () => void) => void
  /** El pipeline avanzó de verdad al paso `step` (0-based). */
  advance: (step: number) => void
  stop: () => void
}

const Ctx = createContext<Api | null>(null)

/** Estado compartido "la IA está trabajando": lo lee el AiStage del shell y lo escriben los pasos. */
export function AiWorkProvider({ children }: { children: ReactNode }) {
  const [work, setWork] = useState<AiWork>(null)
  const api = useMemo<Api>(
    () => ({
      work,
      start: (messages, onCancel) => setWork({ messages, step: 0, onCancel }),
      advance: (step) => setWork((w) => (w ? { ...w, step } : w)),
      stop: () => setWork(null),
    }),
    [work],
  )
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useAiWork(): Api {
  const c = useContext(Ctx)
  if (!c) throw new Error("useAiWork debe usarse dentro de <AiWorkProvider>")
  return c
}
