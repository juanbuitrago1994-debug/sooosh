"use client"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { DEFAULT_LENS, LENS_RANGES, type LensParams } from "@/lib/lens/frame"

/**
 * Panel de ajuste en vivo del efecto lupa. SOLO en desarrollo y con `/login?afinar=1`: se mueven los controles, se pulsa «Repetir efecto» para verlo y «Copiar valores» para
 * pasarle a Claude los que gustaron (se pegan en `DEFAULT_LENS`, `lib/lens/frame.ts`). Herramienta de trabajo, no de producto.
 */
export function LensTuner({ params, onChange, onReplay }: { params: LensParams; onChange: (p: LensParams) => void; onReplay: () => void }) {
  const keys = Object.keys(LENS_RANGES) as (keyof typeof LENS_RANGES)[]
  return (
    <aside aria-label="Ajuste del efecto lupa" className="fixed right-4 bottom-4 z-60 flex max-h-96 w-72 flex-col gap-4 overflow-y-auto rounded-2xl bg-popover p-4 text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Efecto lupa · ajuste</h2>
        <p className="text-xs text-muted-foreground">Mueve, pulsa «Repetir» y copia lo que te guste.</p>
      </div>
      <div className="flex flex-col gap-4">
        {keys.map((k) => {
          const [min, max, step, label] = LENS_RANGES[k]
          return (
            <div key={k} className="flex flex-col gap-2">
              <Label htmlFor={`lens-${k}`} className="flex justify-between gap-2 text-xs font-normal">
                <span>{label}</span>
                <span className="text-muted-foreground tabular-nums">{params[k]}</span>
              </Label>
              <Slider id={`lens-${k}`} min={min} max={max} step={step} value={[params[k]]} onValueChange={(v) => onChange({ ...params, [k]: Array.isArray(v) ? v[0] : v })} aria-label={label} />
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onReplay}>
          Repetir efecto
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(JSON.stringify(params, null, 2)).then(() => toast.success("Valores copiados"))
          }}
        >
          Copiar valores
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onChange({ ...DEFAULT_LENS })}>
          Restablecer
        </Button>
      </div>
    </aside>
  )
}
