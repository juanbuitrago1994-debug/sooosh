"use client"

import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/**
 * Un ajuste de elección en una fila: a la izquierda el nombre y la explicación de la opción elegida; a la derecha un `Select` compacto de
 * ancho fijo (así todos quedan alineados). Es el componente de shadcn sin cambios: solo la composición de la fila.
 */
export type SettingOption = { value: string; label: string; hint?: string }

export function SettingSelect({ label, options, value, onValueChange }: { label: string; options: readonly SettingOption[]; value: string; onValueChange: (value: string) => void }) {
  const current = options.find((o) => o.value === value) ?? options[0]
  return (
    <Field orientation="horizontal" className="items-start justify-between gap-4">
      <FieldContent className="min-w-0 flex-1">
        <FieldLabel className="font-normal">{label}</FieldLabel>
        {current.hint && <FieldDescription className="text-xs">{current.hint}</FieldDescription>}
      </FieldContent>
      <Select items={options} value={current.value} onValueChange={(v) => v && v !== current.value && onValueChange(v)}>
        <SelectTrigger aria-label={label} className="w-36 shrink-0 pointer-coarse:h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="end">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="pointer-coarse:min-h-11">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
