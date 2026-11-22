"use client"

import { useState } from "react"
import { DotLoader } from "@/components/ai/dot-loader"
import { PlusIcon, SparklesIcon, XIcon } from "lucide-react"
import type { useEmailBody } from "@/components/jobs/use-email-body"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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

type EmailBody = ReturnType<typeof useEmailBody>

/** Drawer aparte (se abre encima del panel de correo) con los ajustes de redacción: así el paso «Cuerpo» queda limpio. */
export function ApplyEmailSettingsDrawer({ open, onOpenChange, email }: { open: boolean; onOpenChange: (open: boolean) => void; email: EmailBody }) {
  const { settings, setSettings: onChange, includeWeb, setIncludeWeb, links, hasWebFromCv, extraUrl, addUrl, removeUrl, loading, generate } = email
  const [urlDraft, setUrlDraft] = useState("")
  const [urlError, setUrlError] = useState<string | null>(null)
  const submitUrl = () => {
    if (!urlDraft.trim()) return
    if (addUrl(urlDraft)) {
      setUrlDraft("")
      setUrlError(null)
    } else setUrlError("Escribe una dirección web válida, por ejemplo miportafolio.com.")
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
      <FloatingDrawerContent>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
            <DrawerHeader className="flex flex-col gap-1 p-0 pt-4">
              <DrawerTitle>Ajustes de redacción</DrawerTitle>
              <DrawerDescription>Elige cómo suena tu correo y si incluye tu portafolio o web. Se aplican a las versiones que pidas con el botón de abajo.</DrawerDescription>
            </DrawerHeader>
            <FieldGroup className="gap-6">
              {!hasWebFromCv && !extraUrl && (
                <Field data-invalid={urlError ? true : undefined}>
                  <FieldLabel htmlFor="mail-url">Tu portafolio o web</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="mail-url"
                      type="url"
                      inputMode="url"
                      autoComplete="off"
                      placeholder="miportafolio.com"
                      value={urlDraft}
                      aria-invalid={urlError ? true : undefined}
                      onChange={(e) => {
                        setUrlDraft(e.target.value)
                        setUrlError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          submitUrl()
                        }
                      }}
                    />
                    <Button type="button" variant="outline" size="icon" aria-label="Agregar portafolio o web" onClick={submitUrl} disabled={!urlDraft.trim()}>
                      <PlusIcon aria-hidden />
                    </Button>
                  </div>
                  {urlError ? <FieldError>{urlError}</FieldError> : <FieldDescription>Tu CV no trae un portafolio o web. Si lo agregas, se usa solo en este correo.</FieldDescription>}
                </Field>
              )}

              {links.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Field orientation="horizontal" className="items-center justify-between pointer-coarse:min-h-11">
                    <FieldLabel htmlFor="mail-web" className="min-w-0 flex-1 font-normal break-all">
                      Incluir {links.map((l) => l.url.replace(/^https?:\/\//, "")).join(" y ")}
                    </FieldLabel>
                    {extraUrl && (
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar el enlace agregado" onClick={removeUrl}>
                        <XIcon aria-hidden />
                      </Button>
                    )}
                    <Switch id="mail-web" checked={includeWeb} onCheckedChange={setIncludeWeb} />
                  </Field>
                </div>
              )}
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
          <DrawerFooter className="flex-row gap-2 border-t border-border/40 p-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            {/* Acción principal: pide otras versiones con los ajustes elegidos y vuelve al paso para verlas llegar. */}
            <Button
              type="button"
              className="flex-1"
              disabled={loading}
              aria-busy={loading}
              onClick={() => {
                onOpenChange(false)
                void generate()
              }}
            >
              {loading ? <DotLoader variant="orbit" rounded /> : <SparklesIcon data-icon="inline-start" />}
              {loading ? "Escribiendo…" : "Pedir otras versiones"}
            </Button>
          </DrawerFooter>
        </div>
      </FloatingDrawerContent>
    </Drawer>
  )
}
