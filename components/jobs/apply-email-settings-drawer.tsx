"use client"

import { useState } from "react"
import { SparklesIcon, XIcon } from "lucide-react"
import { DotLoader } from "@/components/ai/dot-loader"
import { FloatingDrawerContent } from "@/components/jobs/floating-drawer"
import type { useEmailBody } from "@/components/jobs/use-email-body"
import { WebUrlField } from "@/components/jobs/web-url-field"
import { SlidingChoice } from "@/components/motion/sliding-choice"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { platformLabel, type ContactData } from "@/lib/apply/email"
import type { BodySettings } from "@/lib/apply/body-settings"

type EmailBody = ReturnType<typeof useEmailBody>

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

const TABS = [
  { value: "estilo", label: "Estilo" },
  { value: "datos", label: "Datos" },
] as const

/** Datos que pueden salir en la firma, en el orden en que se muestran. */
const CONTACT_ROWS: { key: keyof ContactData; label: string }[] = [
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Correo" },
  { key: "city", label: "Ciudad" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "web", label: "Portafolio o web" },
  { key: "source", label: "Dónde vi la oferta" },
]

/**
 * Drawer aparte (se abre encima del panel de correo) con los ajustes de redacción: así el paso «Cuerpo» queda limpio. Dos pestañas:
 * «Estilo» (cómo suena) y «Datos» (qué datos de tu CV salen en el correo).
 */
export function ApplyEmailSettingsDrawer({ open, onOpenChange, email, sourceName }: { open: boolean; onOpenChange: (open: boolean) => void; email: EmailBody; sourceName?: string | null }) {
  const { settings, setSettings: onChange, loading, generate } = email
  const [tab, setTab] = useState<string>("estilo")
  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
      <FloatingDrawerContent>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
            <DrawerHeader className="flex flex-col gap-1 p-0 pt-4">
              <DrawerTitle>Ajustes de redacción</DrawerTitle>
              <DrawerDescription>Elige cómo suena tu correo y qué datos tuyos salen en él. Los cambios de estilo se aplican a las versiones que pidas con el botón de abajo.</DrawerDescription>
            </DrawerHeader>
            <SlidingChoice label="Secciones de los ajustes" value={tab} options={TABS} onValueChange={setTab} />
            {tab === "estilo" ? (
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
            ) : (
              <DataTab email={email} sourceName={sourceName} />
            )}
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

/** Qué datos salen en la firma: un interruptor por dato, solo para los que el CV trae, mostrando el valor que saldría. */
export function DataTab({ email, sourceName }: { email: EmailBody; sourceName?: string | null }) {
  const { contact, setContact, available, extraUrl, removeUrl, addUrl, links, hasWebFromCv, cvValues } = email
  const shown = CONTACT_ROWS.filter((r) => available[r.key])
  const valueOf = (key: keyof ContactData): string => {
    if (key === "web") return links.map((l) => l.url.replace(/^https?:\/\//, "")).join(" · ")
    if (key === "source") return `Vi su publicación en ${platformLabel(sourceName) ?? ""}`.trim()
    return cvValues[key] ?? ""
  }
  return (
    <FieldGroup className="gap-6">
      {!hasWebFromCv && !extraUrl && <WebUrlField id="mail-url" onAdd={addUrl} />}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Datos en tu firma</p>
        <p className="text-xs text-muted-foreground">Tu nombre siempre va. Solo aparecen los datos que tu CV trae; tú decides cuáles salen.</p>
      </div>
      {shown.length === 0 && <FieldDescription>Tu CV no trae datos de contacto para mostrar aquí.</FieldDescription>}
      <div className="flex flex-col gap-2">
        {shown.map((r) => (
          <Field key={r.key} orientation="horizontal" className="items-center justify-between pointer-coarse:min-h-11">
            <FieldContent className="min-w-0 flex-1">
              <FieldLabel htmlFor={`contact-${r.key}`} className="font-normal">
                {r.label}
              </FieldLabel>
              <FieldDescription className="text-xs break-all">{valueOf(r.key)}</FieldDescription>
            </FieldContent>
            {r.key === "web" && extraUrl && (
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar el enlace agregado" onClick={removeUrl}>
                <XIcon aria-hidden />
              </Button>
            )}
            <Switch id={`contact-${r.key}`} checked={contact[r.key]} onCheckedChange={(on) => setContact({ ...contact, [r.key]: on })} />
          </Field>
        ))}
      </div>
    </FieldGroup>
  )
}
