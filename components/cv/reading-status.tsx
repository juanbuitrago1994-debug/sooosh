"use client"

import { useEffect, useState } from "react"
import { ProgressLine } from "@/components/ai/progress-line"
import { nextProgress, stageFloor } from "@/lib/cv/progress"

/** Porcentaje de la lectura (ver `lib/cv/progress.ts`: sube con la etapa real y avanza suave dentro de ella; nunca marca 100 % antes de terminar). `idx` -1 = subiendo el archivo. */
export function useReadingPercent(idx: number): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setValue((v) => nextProgress(v, idx)), 150)
    return () => clearInterval(t)
  }, [idx])
  return Math.max(Math.floor(value), stageFloor(idx))
}

const GENERIC = ["Leyendo tu CV", "Reconociendo tu experiencia", "Preparando el encaje"]

/** Cargador de la lectura del CV: spinner + frase + porcentaje en una línea (`ProgressLine`), el mismo en el panel «Mi CV» y en la pantalla inicial. */
export function ReadingStatus({ idx, phrase }: { idx: number; /** la etapa real en curso; sin ella, frases genéricas */ phrase?: string }) {
  const percent = useReadingPercent(idx)
  return <ProgressLine messages={phrase ? [phrase] : GENERIC} percent={percent} label="Avance de la lectura de tu CV" />
}
