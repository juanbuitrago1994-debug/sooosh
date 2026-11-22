"use client"

import { useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, SlidersHorizontalIcon, SparklesIcon } from "lucide-react"
import { DotLoader } from "@/components/ai/dot-loader"
import { ApplyEmailSettingsDrawer } from "@/components/jobs/apply-email-settings-drawer"
import type { useEmailBody } from "@/components/jobs/use-email-body"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type EmailBody = ReturnType<typeof useEmailBody>

const SOURCE_HINT = {
  base: "Texto base con datos de tu CV. Pide otras versiones para que la IA local las redacte.",
  ia: "Redactada con IA local con datos de tu CV y de la oferta. Revísala y ajústala.",
  plantilla: "Variante de plantilla con datos de tu CV. Revísala y ajústala.",
} as const

/** Paso «Cuerpo»: propuestas con flechas, pedir otras versiones a la IA local, ajustes de redacción y portafolio o web. */
export function BodyStep({ email }: { email: EmailBody }) {
  const { proposals, index, current, body, loading, edit, go, generate } = email
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
      <ApplyEmailSettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} email={email} />

    </FieldGroup>
  )
}
