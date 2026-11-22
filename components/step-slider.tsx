"use client"

import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"

/**
 * Elección entre pocas opciones ORDENADAS (de menos a más) con un slider de pasos fijos: el `Slider` de shadcn (base-ui) sin posiciones
 * libres. Arriba, el nombre del campo y el paso actual; abajo, solo los dos extremos y la explicación del paso. Cada paso se anuncia con su
 * nombre (no con un número) a los lectores de pantalla; con teclado: flechas, Inicio y Fin. Las marcas de los pasos van sobre la pista.
 */
export type StepOption = { value: string; label: string; hint?: string }

export function StepSlider({ label, options, value, onValueChange }: { label: string; options: readonly StepOption[]; value: string; onValueChange: (value: string) => void }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const current = options[index]
  const first = options[0]
  const last = options[options.length - 1]
  return (
    <Field>
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel className="font-normal">{label}</FieldLabel>
        <span className="text-sm font-medium" aria-hidden>
          {current.label}
        </span>
      </div>
      <SliderPrimitive.Root
        data-slot="step-slider"
        className="w-full"
        min={0}
        max={options.length - 1}
        step={1}
        largeStep={1}
        thumbAlignment="edge"
        value={index}
        onValueChange={(v) => {
          const next = options[Array.isArray(v) ? v[0] : v]
          if (next && next.value !== value) onValueChange(next.value)
        }}
      >
        {/* El padding vertical amplía el área de toque a 44 px (4 de pista + 2 × 20) sin agrandar la pista. */}
        <SliderPrimitive.Control className="relative flex w-full touch-none items-center py-5 select-none data-disabled:opacity-50">
          <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-muted select-none">
            <SliderPrimitive.Indicator className="h-full bg-primary select-none" />
          </SliderPrimitive.Track>
          {/* Marcas de cada paso: con la bolita «al borde», los centros caen en px-1 + 2 px = el radio de la bolita. */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 flex items-center justify-between px-1">
            {options.map((o, i) => (
              <span key={o.value} className={`size-1 rounded-full ${i <= index ? "bg-primary-foreground/60" : "bg-muted-foreground/40"}`} />
            ))}
          </span>
          <SliderPrimitive.Thumb
            getAriaLabel={() => label}
            getAriaValueText={() => current.label}
            className="relative block size-3 shrink-0 rounded-full border-2 border-primary bg-background transition-shadow select-none after:absolute after:-inset-3 hover:ring-3 hover:ring-ring/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-hidden active:ring-3 active:ring-ring/50"
          />
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden>
        <span>{first.label}</span>
        <span>{last.label}</span>
      </div>
      {current.hint && <FieldDescription>{current.hint}</FieldDescription>}
    </Field>
  )
}
