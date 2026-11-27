"use client"

import { useCallback, useState, type ComponentProps, type ReactNode } from "react"
import { OnboardingForm } from "@/components/auth/onboarding-form"
import { SettingsSection, SettingsSections } from "@/components/settings/settings-section"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

const FORM_ID = "profile-form"

/**
 * Cabecera de Ajustes con «Cancelar» y «Guardar cambios» a la derecha (referencia de Juan, 27-nov-2026), seguida de las secciones. Los botones gobiernan el formulario del perfil:
 * están desactivados hasta que haya cambios; «Cancelar» devuelve los campos a lo guardado. Las demás secciones (`children`) tienen sus propias acciones.
 */
export function ProfileSettings({ form, children }: { form: Omit<ComponentProps<typeof OnboardingForm>, "formId" | "hideSubmit" | "onStatus" | "hint">; children: ReactNode }) {
  const [status, setStatus] = useState({ dirty: false, pending: false })
  const [resetKey, setResetKey] = useState(0)
  const onStatus = useCallback((s: { dirty: boolean; pending: boolean }) => setStatus(s), [])
  return (
    <>
      <div className="flex flex-col gap-4 border-b border-foreground/10 pt-2 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-medium">Preferencias</h2>
          <p className="text-xs text-muted-foreground">Configura tu perfil, tu cuenta y tus datos.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={!status.dirty || status.pending} onClick={() => (setResetKey((k) => k + 1), setStatus({ dirty: false, pending: false }))}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} disabled={!status.dirty || status.pending}>
            {status.pending && <Spinner />}
            Guardar cambios
          </Button>
        </div>
      </div>
      <SettingsSections>
        <SettingsSection id="perfil" title="Tu perfil" description="Lo que nos contaste al registrarte. Cámbialo cuando quieras.">
          <div className="flex max-w-md flex-col gap-6">
            <OnboardingForm key={resetKey} {...form} formId={FORM_ID} hideSubmit onStatus={onStatus} hint="Escribe un cargo y pulsa Enter. Hasta 10." />
          </div>
        </SettingsSection>
        {children}
      </SettingsSections>
    </>
  )
}
