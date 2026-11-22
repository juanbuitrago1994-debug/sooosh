"use client"

import { BookmarkIcon, CheckIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/motion/motion-switch"
import { clearFilters, sameFilters, saveFilters, setAutoApply, useSavedFilters, type SavedFilters } from "@/lib/profile/saved-filters"

type Current = Omit<SavedFilters, "auto">

/**
 * «Mis filtros»: guarda región, área, modalidad, orden y «solo match» para recuperarlos con un botón, sin configurar todo de nuevo
 * cada vez. Solo en este navegador. Con «Aplicar al abrir», el buscador arranca ya con ellos.
 */
export function SavedFiltersBar({ current, onApply }: { current: Current; onApply: (f: Current) => void }) {
  const saved = useSavedFilters()
  const same = !!saved && sameFilters(saved, current)

  const save = () => {
    if (saveFilters(current)) toast.success(saved ? "Filtros actualizados" : "Filtros guardados")
    else toast.error("No se pudieron guardar los filtros.")
  }

  return (
    <div className="flex flex-col gap-3" aria-label="Mis filtros">
      <div className="flex flex-wrap items-center gap-2">
        {saved && (
          <Button size="sm" variant={same ? "secondary" : "default"} disabled={same} onClick={() => onApply(saved)} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
            {same && <CheckIcon data-icon="inline-start" aria-hidden />}
            {same ? "Mis filtros aplicados" : "Aplicar mis filtros"}
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={same} onClick={save}>
          <BookmarkIcon data-icon="inline-start" aria-hidden />
          {saved ? "Actualizar" : "Guardar filtros"}
        </Button>
        {saved && (
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => (clearFilters() ? toast.success("Filtros quitados") : toast.error("No se pudo quitar."))}>
            Quitar
          </Button>
        )}
      </div>
      {saved && (
        <div className="flex items-center justify-between gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
          <label htmlFor="filtros-auto" className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium">Aplicar al abrir</span>
          </label>
          <Switch id="filtros-auto" checked={saved.auto} onCheckedChange={(v) => setAutoApply(v)} />
        </div>
      )}
    </div>
  )
}
