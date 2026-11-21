import { BadgeCheckIcon } from "lucide-react"

/** Marca de las ofertas que revisó una persona de Sooosh antes de publicarlas (las cargadas desde el panel de administración). */
export function CuratedTag({ className }: { className?: string }) {
  return (
    <p className={`flex items-center gap-1 text-xs text-muted-foreground ${className ?? ""}`}>
      <BadgeCheckIcon className="size-3.5" aria-hidden />
      Seleccionada por Sooosh
    </p>
  )
}
