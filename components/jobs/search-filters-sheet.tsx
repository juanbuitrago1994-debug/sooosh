"use client"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { ResponsiveSheet } from "@/components/jobs/responsive-sheet"
import { SavedFiltersBar } from "@/components/jobs/saved-filters-bar"
import { REGION_OPTIONS } from "@/lib/jobs/geo"
import { ALL_REGIONS } from "@/lib/jobs/region"
import type { SavedFilters } from "@/lib/profile/saved-filters"

export const MODE_LABEL: Record<string, string> = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" }
export const AREA_LABEL: Record<SavedFilters["area"], string> = { tecnologia: "Tecnología", todas: "Todas las áreas" }

export type FilterValues = Omit<SavedFilters, "auto"> & { onlySaved: boolean }

/** Todos los filtros del buscador en una hoja: la pantalla queda limpia y se ve lo que importa, las ofertas. */
export function SearchFiltersSheet({
  open,
  onOpenChange,
  values,
  hasCv,
  savedCount,
  onChange,
  onApplySaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  values: FilterValues
  hasCv: boolean
  savedCount: number
  onChange: (patch: Partial<FilterValues>) => void
  onApplySaved: (f: Omit<SavedFilters, "auto">) => void
}) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      {({ Header, Title }) => (
        <>
          <Header className="text-left">
            <Title className="text-lg">Filtros</Title>
          </Header>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="f-area">Área</FieldLabel>
                <NativeSelect id="f-area" className="w-full" value={values.area} onChange={(e) => onChange({ area: e.target.value as FilterValues["area"] })}>
                  {Object.entries(AREA_LABEL).map(([k, v]) => (
                    <NativeSelectOption key={k} value={k}>
                      {v}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="f-region">Región</FieldLabel>
                <NativeSelect id="f-region" className="w-full" value={values.region} onChange={(e) => onChange({ region: e.target.value })}>
                  <NativeSelectOption value={ALL_REGIONS}>Todas las regiones</NativeSelectOption>
                  {REGION_OPTIONS.map((r) => (
                    <NativeSelectOption key={r.code} value={r.code}>
                      {r.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="f-mode">Modalidad</FieldLabel>
                <NativeSelect id="f-mode" className="w-full" value={values.mode} onChange={(e) => onChange({ mode: e.target.value as FilterValues["mode"] })}>
                  <NativeSelectOption value="">Todas</NativeSelectOption>
                  {Object.entries(MODE_LABEL).map(([k, v]) => (
                    <NativeSelectOption key={k} value={k}>
                      {v}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="f-sort">Ordenar por</FieldLabel>
                <NativeSelect id="f-sort" className="w-full" value={values.sort} onChange={(e) => onChange({ sort: e.target.value as FilterValues["sort"] })}>
                  <NativeSelectOption value="relevancia">Relevancia</NativeSelectOption>
                  <NativeSelectOption value="recientes">Más recientes</NativeSelectOption>
                  <NativeSelectOption value="encaje" disabled={!hasCv}>
                    {hasCv ? "Encaje con mi CV" : "Encaje (requiere tu CV)"}
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>

            <div className="flex flex-col gap-4">
              <label htmlFor="f-match" className="flex items-center justify-between gap-3 text-sm font-medium">
                {hasCv ? "Solo con match" : "Solo con match (requiere tu CV)"}
                <Switch id="f-match" checked={hasCv && values.onlyMatches} disabled={!hasCv} onCheckedChange={(v) => onChange({ onlyMatches: v })} />
              </label>
              {savedCount > 0 && (
                <label htmlFor="f-saved" className="flex items-center justify-between gap-3 text-sm font-medium">
                  Solo mis guardadas ({savedCount})
                  <Switch id="f-saved" checked={values.onlySaved} onCheckedChange={(v) => onChange({ onlySaved: v })} />
                </label>
              )}
            </div>

            <SavedFiltersBar current={values} onApply={onApplySaved} />
          </div>
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Ver ofertas
          </Button>
        </>
      )}
    </ResponsiveSheet>
  )
}
