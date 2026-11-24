import { CvMotion, type CvMotionState } from "@/components/ai/cv-motion"
import { cn } from "@/lib/utils"

/**
 * CvStage — el escenario de arriba del panel «Mi CV» (pedido por Juan el 23-nov-2026, a partir de una referencia): una hoja de CV monocromática
 * (`CvMotion`) sobre un degradado del color del tema que se desvanece hacia el fondo del documento, de modo que la hoja «se pierde» en el título
 * que va debajo. Solo tokens del tema (`primary`, `background`); es una de las excepciones a «sin degradados» (ver CLAUDE.md y docs/DESIGN-TOKENS.md):
 * únicamente aquí, nunca como fondo de la app. Decorativo (`aria-hidden`).
 */
export function CvStage({ state = "idle", className }: { state?: CvMotionState; className?: string }) {
  return (
    <div aria-hidden data-cv-stage className={cn("relative flex justify-center overflow-hidden bg-linear-to-b from-primary/15 via-primary/5 to-transparent pt-8", className)}>
      <CvMotion state={state} />
      <div data-cv-fade className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-b from-transparent to-background" />
    </div>
  )
}
