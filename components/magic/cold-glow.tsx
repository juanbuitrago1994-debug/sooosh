import { EFFECT_COLORS } from "@/lib/design-tokens"
import { cn } from "cn"

const C = EFFECT_COLORS
const tint = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`

/**
 * ColdGlow — resplandor frío ESTÁTICO y muy sutil detrás de un panel (pedido por Juan el 25-nov-2026 para el panel izquierdo de la validación del CV).
 * Reusa los tonos fríos `flow-*` de `docs/DESIGN-TOKENS.md`. No se anima (sin riesgo con `prefers-reduced-motion`). El hijo debe llevar su propio fondo
 * sólido (`bg-background`) y radio: así la luz solo asoma por fuera del borde, como una sombra de color. `className` va al contenedor (posición, tamaño, radio).
 */
export function ColdGlow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("relative isolate", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px -z-10 opacity-20 blur-xl"
        style={{ borderRadius: "inherit", background: `linear-gradient(135deg, ${tint(C["flow-slate"], 35)}, ${tint(C["flow-blue"], 45)} 50%, ${tint(C["flow-ice"], 30)})` }}
      />
      {children}
    </div>
  )
}
