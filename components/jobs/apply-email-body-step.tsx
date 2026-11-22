"use client"

import { useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, SlidersHorizontalIcon } from "lucide-react"
import { DotLoader } from "@/components/ai/dot-loader"
import { ApplyEmailSettingsDrawer } from "@/components/jobs/apply-email-settings-drawer"
import type { useEmailBody } from "@/components/jobs/use-email-body"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type EmailBody = ReturnType<typeof useEmailBody>

const SOURCE_HINT = {
  base: "Texto base con datos de tu CV. Con «Ajustes y otras versiones» la IA local redacta más.",
  ia: "Redactada con IA local con datos de tu CV y de la oferta. Revísala y ajústala.",
  plantilla: "Variante de plantilla con datos de tu CV. Revísala y ajústala.",
} as const

/** Paso «Cuerpo»: propuestas con flechas, pedir otras versiones a la IA local, ajustes de redacción y portafolio o web. */
export function BodyStep({ email }: { email: EmailBody }) {
  const { proposals, index, current, body, loading, edit, go } = email
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

      <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)} aria-busy={loading}>
        {loading ? <DotLoader variant="orbit" rounded /> : <SlidersHorizontalIcon data-icon="inline-start" />}
        {loading ? "Escribiendo propuestas…" : "Ajustes y otras versiones"}
      </Button>
      <ApplyEmailSettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} email={email} />

    </FieldGroup>
  )
}
