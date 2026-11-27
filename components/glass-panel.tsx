import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

/**
 * GlassPanel — el ÚNICO contenedor permitido en la UI v2 (docs/DESIGN-PATTERNS.md §v2, patrón c):
 * fondo semitransparente con blur, borde muy tenue, sin sombra.
 * Lista cerrada de usos: (1) línea de tiempo del análisis, (2) tarjeta de cambio en la revisión,
 * (3) menús y diálogos, (4) tarjeta de oferta del buscador (aprobado por Juan el 19-nov-2026), (5) panel lateral de estado de fuentes (20-nov-2026), (6) panel del correo de postulación (21-nov-2026), (7) tarjeta de avance de «Your resume» (27-nov-2026). En cualquier otro lugar está prohibido (y la tarjeta genérica de shadcn también).
 */
export function GlassPanel({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="glass-panel" className={cn("rounded-2xl border border-border/40 bg-background/50 backdrop-blur-xl", className)} {...props} />
}
