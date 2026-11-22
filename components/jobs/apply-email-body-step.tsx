"use client"

import { useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, SlidersHorizontalIcon, SparklesIcon, XIcon } from "lucide-react"
import { DotLoader } from "@/components/ai/dot-loader"
import { ApplyEmailSettingsDrawer } from "@/components/jobs/apply-email-settings-drawer"
import type { useEmailBody } from "@/components/jobs/use-email-body"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

type EmailBody = ReturnType<typeof useEmailBody>

const SOURCE_HINT = {
  base: "Texto base con datos de tu CV. Pide otras versiones para que la IA local las redacte.",
  ia: "Redactada con IA local con datos de tu CV y de la oferta. Revísala y ajústala.",
  plantilla: "Variante de plantilla con datos de tu CV. Revísala y ajústala.",
} as const

/** Paso «Cuerpo»: propuestas con flechas, pedir otras versiones a la IA local, ajustes de redacción y portafolio o web. */
export function BodyStep({ email }: { email: EmailBody }) {
  const { proposals, index, current, body, loading, settings, setSettings, includeWeb, setIncludeWeb, links, hasWebFromCv, extraUrl, addUrl, removeUrl, edit, go, generate } = email
  const [settingsOpen, setSettingsOpen] = useState(false)
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
      </Field>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="min-w-0 flex-1" onClick={generate} disabled={loading} aria-busy={loading}>
          {loading ? <DotLoader variant="orbit" rounded /> : <SparklesIcon data-icon="inline-start" />}
          {loading ? "Escribiendo propuestas…" : "Pedir otras versiones"}
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Ajustes de redacción" onClick={() => setSettingsOpen(true)}>
          <SlidersHorizontalIcon aria-hidden />
        </Button>
      </div>
      <ApplyEmailSettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onChange={setSettings} />

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
    </FieldGroup>
  )
}
