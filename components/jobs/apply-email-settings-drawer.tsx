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
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/motion/motion-switch"
import { platformLabel, type ContactData } from "@/lib/apply/email"
import { PRESETS, presetOf, type BodySettings } from "@/lib/apply/body-settings"

type EmailBody = ReturnType<typeof useEmailBody>

type Option = { value: string; label: string; hint: string }
type Group = { key: keyof BodySettings; label: string; options: Option[] }

const STYLE_GROUPS: Group[] = [
  {
    key: "register",
    label: "Registro",
    options: [
      { value: "sobrio", label: "Sobrio", hint: "Muy formal, sin adornos ni exclamaciones." },
      { value: "profesional", label: "Profesional", hint: "Claro y formal sin ser rígido." },
      { value: "cercano", label: "Cercano", hint: "Amable y natural, sin exceso de confianza." },
      { value: "casual", label: "Casual", hint: "Relajado y conversacional, sin jerga." },
    ],
  },
  {
    key: "warmth",
    label: "Calidez",
    options: [
      { value: "neutra", label: "Neutra", hint: "Informativo, sin expresar emociones." },
      { value: "calida", label: "Cálida", hint: "Con amabilidad genuina hacia el equipo." },
      { value: "entusiasta", label: "Entusiasta", hint: "Con entusiasmo visible, sin exagerar." },
    ],
  },
  {
    key: "style",
    label: "Tipo de lenguaje",
    options: [
      { value: "sencillo", label: "Sencillo", hint: "Palabras simples y frases cortas." },
      { value: "tecnico", label: "Técnico", hint: "Usa el vocabulario y las herramientas que pide la oferta." },
      { value: "narrativo", label: "Narrativo", hint: "Cuenta un breve recorrido, con hilo conductor." },
    ],
  },
  {
    key: "length",
    label: "Longitud",
    options: [
      { value: "minimo", label: "Mínimo", hint: "Una sola frase: lo esencial." },
      { value: "corto", label: "Corto", hint: "Unas 2 frases." },
      { value: "medio", label: "Medio", hint: "3 o 4 frases: equilibrado." },
      { value: "largo", label: "Largo", hint: "5 o 6 frases, con más detalle." },
    ],
  },
]

const CONTENT_GROUPS: Group[] = [
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
  {
    key: "greeting",
    label: "Saludo",
    options: [
      { value: "equipo", label: "Hola, equipo", hint: "«Hola, equipo de la empresa:»." },
      { value: "formal", label: "Estimado", hint: "«Estimado equipo de selección de la empresa:»." },
      { value: "simple", label: "Solo «Hola»", hint: "Un saludo breve, sin nombrar a la empresa." },
    ],
  },
  {
    key: "cta",
    label: "Cierre",
    options: [
      { value: "conversar", label: "Conversar", hint: "Quedas atento/a para conversar cuando les convenga." },
      { value: "entrevista", label: "Entrevista", hint: "Dices que te encantaría una entrevista." },
      { value: "agradecer", label: "Agradecer", hint: "Cierras agradeciendo que consideren tu postulación." },
      { value: "ninguno", label: "Sin cierre", hint: "Solo el agradecimiento final, sin invitar a nada." },
    ],
  },
]

const LANG_GROUP: Group = {
  key: "lang",
  label: "Idioma",
  options: [
    { value: "auto", label: "Automático", hint: "Usa el idioma de la oferta." },
    { value: "es", label: "Español", hint: "El correo sale en español." },
    { value: "en", label: "Inglés", hint: "El correo sale en inglés." },
  ],
}

const TABS = [
  { value: "estilo", label: "Estilo" },
  { value: "contenido", label: "Contenido" },
  { value: "datos", label: "Datos" },
] as const

const PRESET_OPTIONS = [
  { value: "cercano", label: "Cercano", hint: "Cálido y breve, con saludo de equipo." },
  { value: "profesional", label: "Profesional", hint: "Formal y completo, centrado en tu experiencia." },
  { value: "directo", label: "Directo", hint: "Mínimo y al grano, centrado en tus habilidades." },
]

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
  const { settings, setSettings: onChange, loading, generate, lang, recipientName, setRecipientName } = email
  const [tab, setTab] = useState<string>("estilo")
  const preset = presetOf(settings)
  const presetOptions = preset ? PRESET_OPTIONS : [...PRESET_OPTIONS, { value: "custom", label: "Personalizado", hint: "Tus propios ajustes." }]
  const renderGroup = (g: Group) => {
    const options = g.key === "lang" ? g.options.map((o) => (o.value === "auto" ? { ...o, hint: `Usa el idioma de la oferta (ahora: ${lang === "en" ? "inglés" : "español"}).` } : o)) : g.options
    const current = options.find((o) => o.value === settings[g.key]) ?? options[0]
    return (
      <Field key={g.key}>
        <FieldLabel id={`set-${g.key}`}>{g.label}</FieldLabel>
        <SlidingChoice label={g.label} value={settings[g.key]} options={options} onValueChange={(v) => onChange({ ...settings, [g.key]: v } as BodySettings)} />
        <FieldDescription>{current.hint}</FieldDescription>
      </Field>
    )
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
      <FloatingDrawerContent>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
            <DrawerHeader className="flex flex-col gap-1 p-0 pt-4">
              <DrawerTitle>Ajustes de redacción</DrawerTitle>
              <DrawerDescription>Elige cómo suena tu correo, qué dice y qué datos tuyos salen en él. Los cambios se aplican a las versiones que pidas con el botón de abajo.</DrawerDescription>
            </DrawerHeader>
            <Field>
              <FieldLabel>Punto de partida</FieldLabel>
              <SlidingChoice
                label="Punto de partida"
                value={preset ?? "custom"}
                options={presetOptions}
                onValueChange={(v) => {
                  const p = PRESETS.find((x) => x.value === v)
                  if (p) onChange({ ...settings, ...p.settings })
                }}
              />
              <FieldDescription>{presetOptions.find((o) => o.value === (preset ?? "custom"))?.hint}</FieldDescription>
            </Field>
            <SlidingChoice label="Secciones de los ajustes" value={tab} options={TABS} onValueChange={setTab} />
            {tab === "estilo" && <FieldGroup className="gap-6">{[...STYLE_GROUPS, LANG_GROUP].map(renderGroup)}</FieldGroup>}
            {tab === "contenido" && (
              <FieldGroup className="gap-6">
                {CONTENT_GROUPS.map(renderGroup)}
                <Field>
                  <FieldLabel htmlFor="mail-recipient">Nombre de quien recibe (opcional)</FieldLabel>
                  <Input id="mail-recipient" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Ej.: Laura" autoComplete="off" />
                  <FieldDescription>Si lo sabes, el saludo será «Hola, Laura:». Solo se usa en este correo.</FieldDescription>
                </Field>
              </FieldGroup>
            )}
            {tab === "datos" && <DataTab email={email} sourceName={sourceName} />}
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
