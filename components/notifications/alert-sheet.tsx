"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveAlert } from "@/app/notificaciones/actions"
import { Chips, ChipsInput } from "@/components/common/chips-input"
import { ResponsiveSheet } from "@/components/jobs/responsive-sheet"
import { SettingSelect } from "@/components/setting-select"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ALERT_SENIORITY, EMPLOYMENT_TYPES, FREQUENCIES, MAX_KEYWORDS, SENIORITY_LABEL, WORK_MODE_LABEL, isEmptyFilters, type AlertFilters, type Frequency } from "@/lib/alerts/filters"
import type { Alert } from "@/lib/alerts/engine"
import { FAMILIES } from "@/lib/jobs/classify"
import { REGION_OPTIONS } from "@/lib/jobs/geo"
import { WORK_MODES } from "@/lib/jobs/draft"

const EMPTY: AlertFilters = { regions: [], workModes: [], employmentTypes: [], seniority: [], families: [], keywords: [] }

/** Elegir de una lista larga: un selector que añade fichas quitables. */
function PickMany({ id, label, placeholder, options, value, onChange }: { id: string; label: string; placeholder: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <NativeSelect id={id} className="w-full" value="" aria-label={label} onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
        <NativeSelectOption value="">{placeholder}</NativeSelectOption>
        {options.filter((o) => !value.includes(o.value)).map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Chips items={value.map((v) => ({ value: v, label: options.find((o) => o.value === v)?.label ?? v }))} onRemove={(v) => onChange(value.filter((x) => x !== v))} label={`${label} elegidos`} />
    </div>
  )
}

function Toggles<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <ToggleGroup multiple variant="outline" size="sm" aria-label={label} className="w-full flex-wrap" value={value} onValueChange={(v) => onChange(v as T[])}>
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="pointer-coarse:min-h-11">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** Crear o editar una alerta: qué buscas (todas las condiciones a la vez; dentro de cada una, cualquiera de sus opciones) y cada cuánto avisarte. */
export function AlertSheet({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial: Alert | null }) {
  const [name, setName] = useState(initial?.name ?? "")
  const [filters, setFilters] = useState<AlertFilters>(initial?.filters ?? EMPTY)
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? "cada_pasada")
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const set = <K extends keyof AlertFilters>(k: K) => (v: AlertFilters[K]) => setFilters((f) => ({ ...f, [k]: v }))

  const submit = () => {
    if (!name.trim()) return void setError("Ponle un nombre a la alerta.")
    if (isEmptyFilters(filters)) return void setError("Elige al menos una condición.")
    start(async () => {
      const r = await saveAlert(initial?.id ?? null, { name, filters, frequency })
      if (r.ok) {
        toast.success(initial ? "Alerta actualizada" : "Alerta creada: te avisaremos en la próxima pasada")
        return void onOpenChange(false)
      }
      setError(r.reason === "limit" ? "Llegaste al máximo de 10 alertas." : (r.message ?? "No pudimos guardar la alerta. Inténtalo de nuevo."))
    })
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      {({ Header, Title, Description }) => (
        <>
          <Header className="p-0">
            <Title>{initial ? "Editar alerta" : "Nueva alerta"}</Title>
            <Description>Te avisamos dentro de la app cuando aparezcan ofertas nuevas que cumplan TODAS las condiciones que elijas; dentro de cada una vale cualquiera de sus opciones.</Description>
          </Header>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto py-1">
            <FieldGroup className="gap-6">
              <Field data-invalid={!!error && !name.trim()}>
                <FieldLabel htmlFor="alert-name">Nombre</FieldLabel>
                <Input id="alert-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ej.: Datos en Colombia" autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="alert-keywords">Palabras del cargo</FieldLabel>
                <ChipsInput id="alert-keywords" value={filters.keywords} onChange={set("keywords")} max={MAX_KEYWORDS} placeholder="Ej.: Analista de datos" addLabel="Añadir palabra" listLabel="Palabras elegidas" />
                <FieldDescription>Busca en el título de la oferta. Escribe un cargo y pulsa Enter.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="alert-regions">País o región</FieldLabel>
                <PickMany id="alert-regions" label="País o región" placeholder="Añadir un país o región" options={REGION_OPTIONS.map((r) => ({ value: r.code, label: r.name }))} value={filters.regions} onChange={set("regions")} />
              </Field>
              <Field>
                <FieldLabel>Modalidad</FieldLabel>
                <Toggles label="Modalidad" options={WORK_MODES.map((m) => ({ value: m, label: WORK_MODE_LABEL[m] }))} value={filters.workModes} onChange={set("workModes")} />
              </Field>
              <Field>
                <FieldLabel>Tipo de contrato</FieldLabel>
                <Toggles label="Tipo de contrato" options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t }))} value={filters.employmentTypes} onChange={set("employmentTypes")} />
              </Field>
              <Field>
                <FieldLabel>Nivel</FieldLabel>
                <Toggles label="Nivel" options={ALERT_SENIORITY.map((s) => ({ value: s, label: SENIORITY_LABEL[s] }))} value={filters.seniority} onChange={set("seniority")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="alert-families">Tipo de posición</FieldLabel>
                <PickMany id="alert-families" label="Tipo de posición" placeholder="Añadir un tipo de posición" options={Object.entries(FAMILIES).map(([value, label]) => ({ value, label }))} value={filters.families} onChange={(v) => set("families")(v as AlertFilters["families"])} />
              </Field>
            </FieldGroup>
            <SettingSelect label="Cada cuánto avisarte" options={FREQUENCIES} value={frequency} onValueChange={(v) => setFrequency(v as Frequency)} />
            {error && <FieldError>{error}</FieldError>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={pending} onClick={submit}>
              {pending && <Spinner />}
              {initial ? "Guardar cambios" : "Crear alerta"}
            </Button>
          </div>
        </>
      )}
    </ResponsiveSheet>
  )
}
