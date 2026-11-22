"use client"

import { Button } from "@/components/ui/button"
import { Drawer, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { FloatingDrawerContent } from "@/components/jobs/floating-drawer"
import { SlidingChoice } from "@/components/motion/sliding-choice"
import type { BodySettings } from "@/lib/apply/body-settings"

const GROUPS: { key: keyof BodySettings; label: string; options: { value: string; label: string; hint: string }[] }[] = [
  {
    key: "length",
    label: "Longitud",
    options: [
      { value: "corto", label: "Corto", hint: "Unas 2 frases: lo esencial." },
      { value: "medio", label: "Medio", hint: "3 o 4 frases: equilibrado." },
      { value: "largo", label: "Largo", hint: "5 o 6 frases: con más detalle." },
    ],
  },
  {
    key: "tone",
    label: "Tono",
    options: [
      { value: "cercano", label: "Cercano", hint: "Cálido y empático con el equipo." },
      { value: "profesional", label: "Profesional", hint: "Formal y sobrio, siempre de tú." },
      { value: "directo", label: "Directo", hint: "Breve y al grano, sin rodeos." },
    ],
  },
  {
    key: "focus",
    label: "Enfoque",
    options: [
      { value: "variado", label: "Variado", hint: "Cada propuesta destaca algo distinto." },
      { value: "experiencia", label: "Experiencia", hint: "Destaca tu experiencia reciente." },
      { value: "habilidades", label: "Habilidades", hint: "Destaca las herramientas y habilidades que pide la oferta." },
      { value: "motivacion", label: "Motivación", hint: "Destaca tu interés por el cargo y cómo puedes aportar." },
    ],
  },
]

/** Drawer aparte (se abre encima del panel de correo) con los ajustes de redacción: así el paso «Cuerpo» queda limpio. */
export function ApplyEmailSettingsDrawer({ open, onOpenChange, settings, onChange }: { open: boolean; onOpenChange: (open: boolean) => void; settings: BodySettings; onChange: (next: BodySettings) => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
      <FloatingDrawerContent>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
            <DrawerHeader className="flex flex-col gap-1 p-0 pt-4">
              <DrawerTitle>Ajustes de redacción</DrawerTitle>
              <DrawerDescription>Elige cómo quieres que suene tu correo. Se aplican a las próximas versiones que pidas.</DrawerDescription>
            </DrawerHeader>
            <FieldGroup className="gap-6">
              {GROUPS.map((g) => {
                const current = g.options.find((o) => o.value === settings[g.key]) ?? g.options[0]
                return (
                  <Field key={g.key}>
                    <FieldLabel id={`set-${g.key}`}>{g.label}</FieldLabel>
                    <SlidingChoice label={g.label} value={settings[g.key]} options={g.options} onValueChange={(v) => onChange({ ...settings, [g.key]: v } as BodySettings)} />
                    <FieldDescription>{current.hint}</FieldDescription>
                  </Field>
                )
              })}
            </FieldGroup>
          </div>
          <DrawerFooter className="border-t border-border/40 p-4">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Listo
            </Button>
          </DrawerFooter>
        </div>
      </FloatingDrawerContent>
    </Drawer>
  )
}
