"use client"

import { useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, SlidersHorizontalIcon } from "lucide-react"
import { DotLoader } from "@/components/ai/dot-loader"
import { ApplyEmailSettingsDrawer } from "@/components/jobs/apply-email-settings-drawer"
import type { useEmailBody } from "@/components/jobs/use-email-body"
import { Button } from "@/components/ui/button"
import { WebUrlField } from "@/components/jobs/web-url-field"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/motion/motion-switch"
import { ASK_LABEL } from "@/lib/jobs/asks"
import { Textarea } from "@/components/ui/textarea"

type EmailBody = ReturnType<typeof useEmailBody>

const ASK_PLACEHOLDER = { salario: "Ej.: $5.000.000 COP", disponibilidad: "Ej.: inmediata", referencias: "Ej.: disponibles a solicitud" } as const

function SwitchRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <Field orientation="horizontal" className="items-center justify-between pointer-coarse:min-h-11">
      <FieldLabel htmlFor={id} className="min-w-0 flex-1 font-normal">
        {label}
      </FieldLabel>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  )
}

const SOURCE_HINT = {
  base: "Texto base con datos de tu CV. Con «Ajustes y otras versiones» la IA local redacta más.",
  ia: "Redactada con IA local con datos de tu CV y de la oferta. Revísala y ajústala.",
  plantilla: "Variante de plantilla con datos de tu CV. Revísala y ajústala.",
} as const

/** Paso «Cuerpo»: propuestas con flechas, pedir otras versiones a la IA local, ajustes de redacción y portafolio o web. */
export function BodyStep({ email, sourceName }: { email: EmailBody; sourceName?: string | null }) {
  const { proposals, index, current, body, loading, edit, resetEdit, go, asks, askValues, setAskValue, contact, setContact, available, hasWebFromCv, extraUrl, addUrl } = email
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <FieldGroup className="gap-6">
      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor="mail-body">Cuerpo del correo</FieldLabel>
          {proposals.length > 1 && (
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Propuesta anterior" disabled={index === 0} onClick={() => go(-1)}>
                <ChevronLeftIcon aria-hidden />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                {index + 1} de {proposals.length}
              </span>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Propuesta siguiente" disabled={index === proposals.length - 1} onClick={() => go(1)}>
                <ChevronRightIcon aria-hidden />
              </Button>
            </div>
          )}
        </div>
        <Textarea id="mail-body" value={body} onChange={(e) => edit(e.target.value)} className="h-80" />
        <FieldDescription>{SOURCE_HINT[current.source]}</FieldDescription>
        {current.override !== undefined && (
          <div className="flex flex-wrap items-center gap-2">
            <FieldDescription>Editaste este texto: los cambios de datos y ajustes no se aplican a él.</FieldDescription>
            <Button type="button" variant="ghost" size="sm" onClick={resetEdit}>
              Restaurar
            </Button>
          </div>
        )}
      </Field>

      {asks.length > 0 && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">La oferta pide en el correo</p>
            <p className="text-xs text-muted-foreground">Se agregan a tu correo solo si los completas; no inventamos nada.</p>
          </div>
          {asks.map((k) => {
            if (k === "salario" || k === "disponibilidad" || k === "referencias") {
              return (
                <Field key={k}>
                  <FieldLabel htmlFor={`ask-${k}`}>{ASK_LABEL[k]}</FieldLabel>
                  <Input id={`ask-${k}`} value={askValues[k] ?? ""} onChange={(e) => setAskValue(k, e.target.value)} placeholder={ASK_PLACEHOLDER[k]} autoComplete="off" />
                </Field>
              )
            }
            if (k === "linkedin") {
              return available.linkedin ? (
                <SwitchRow key={k} id="ask-linkedin" label="Incluir mi LinkedIn" checked={contact.linkedin} onChange={(on) => setContact({ ...contact, linkedin: on })} />
              ) : (
                <Field key={k}>
                  <FieldLabel htmlFor="ask-linkedin">{ASK_LABEL.linkedin}</FieldLabel>
                  <Input
                    id="ask-linkedin"
                    type="url"
                    inputMode="url"
                    value={askValues.linkedin ?? ""}
                    onChange={(e) => {
                      setAskValue("linkedin", e.target.value)
                      if (e.target.value.trim() && !contact.linkedin) setContact({ ...contact, linkedin: true })
                    }}
                    placeholder="linkedin.com/in/tu-perfil"
                    autoComplete="off"
                  />
                  <FieldDescription>Tu CV no trae un enlace de LinkedIn; se usa solo en este correo.</FieldDescription>
                </Field>
              )
            }
            // portafolio
            return hasWebFromCv || extraUrl ? (
              <SwitchRow key={k} id="ask-web" label="Incluir mi portafolio o web" checked={contact.web} onChange={(on) => setContact({ ...contact, web: on })} />
            ) : (
              <WebUrlField key={k} id="ask-web-url" label="Tu portafolio o web" onAdd={addUrl} />
            )
          })}
        </div>
      )}

      <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)} aria-busy={loading}>
        {loading ? <DotLoader variant="orbit" rounded /> : <SlidersHorizontalIcon data-icon="inline-start" />}
        {loading ? "Escribiendo propuestas…" : "Ajustes y otras versiones"}
      </Button>
      <ApplyEmailSettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} email={email} sourceName={sourceName} />

    </FieldGroup>
  )
}
