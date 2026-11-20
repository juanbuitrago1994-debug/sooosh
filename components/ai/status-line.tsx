"use client"

import { MatrixLoader } from "./matrix-loader"
import { ThinkingTicker } from "./thinking-ticker"

/**
 * Línea de estado pequeña (UI v2, patrones e y g): ícono de carga suelto a la izquierda y el texto con la «respiración» de opacidad.
 * Con `running` muestra la matriz de puntos; terminado, solo el texto.
 */
export function StatusLine({ text, running, step = 0 }: { text: string; running: boolean; step?: number }) {
  return (
    <div className="flex items-center gap-3">
      {running && <MatrixLoader size="sm" />}
      <ThinkingTicker messages={[text]} step={step} className="text-left text-xs font-normal text-muted-foreground" />
    </div>
  )
}
