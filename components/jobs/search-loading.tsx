"use client"

import { useEffect, useState } from "react"
import { ProgressLine } from "@/components/ai/progress-line"
import { nextProgress } from "@/lib/cv/progress"

const MESSAGES = ["Buscando entre las ofertas", "Revisando las fuentes más recientes", "Ordenando los resultados", "Preparando las tarjetas"]

/**
 * Carga de la lista de ofertas: el mismo patrón que el panel «Mi CV» (spinner + frase + porcentaje), centrado bajo el buscador y con entrada muy suave.
 * La búsqueda es UNA sola petición y no informa su avance, así que el porcentaje es una estimación por tiempo: sube rápido al principio y se acerca
 * a 98 % sin llegar; el cargador desaparece cuando llegan los resultados. No es una medición.
 */
export function SearchLoading() {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setValue((v) => nextProgress(v, 0, 0.03, 1)), 150)
    return () => clearInterval(t)
  }, [])
  return <ProgressLine soft messages={MESSAGES} percent={Math.floor(value)} label="Avance de la búsqueda" className="py-6" />
}
