import type { ReactNode } from "react"

/** Título y una línea de ayuda. Un solo `h1` por pantalla. */
export function StepHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className="text-lg leading-tight font-medium text-balance">{title}</h1>
      {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
    </header>
  )
}
