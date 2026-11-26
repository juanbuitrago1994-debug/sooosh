"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import type { ProfileFormState } from "@/lib/auth/profile-store"
import { ChipsInput } from "@/components/common/chips-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { MAX_ROLES } from "@/lib/auth/profile-schema"

export type CountryOption = { code: string; name: string }

/** Registro de una cuenta nueva: nombre, país de residencia y cargos que le interesan. Los mismos datos se editan en Ajustes (mismo formulario). */
export function OnboardingForm({ action: submit, defaultName, defaultCountry = "", defaultRoles = [], countries, submitLabel = "Continuar" }: { action: (prev: ProfileFormState, form: FormData) => Promise<ProfileFormState>; defaultName: string; defaultCountry?: string; defaultRoles?: string[]; countries: CountryOption[]; submitLabel?: string }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(submit, {})
  const [roles, setRoles] = useState<string[]>(defaultRoles)
  useEffect(() => {
    if (state.saved) toast.success("Cambios guardados")
  }, [state])
  const fe = state.fieldErrors ?? {}

  return (
    <form action={action} className="flex w-full flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={!!fe.name}>
          <FieldLabel htmlFor="name">Nombre</FieldLabel>
          <Input id="name" name="name" defaultValue={defaultName} autoComplete="name" maxLength={80} aria-invalid={!!fe.name} required />
          {fe.name && <FieldError>{fe.name}</FieldError>}
        </Field>

        <Field data-invalid={!!fe.country}>
          <FieldLabel htmlFor="country">País de residencia</FieldLabel>
          <NativeSelect id="country" name="country" defaultValue={defaultCountry} className="w-full" aria-invalid={!!fe.country} required>
            <NativeSelectOption value="" disabled>
              Elige tu país
            </NativeSelectOption>
            {countries.map((c) => (
              <NativeSelectOption key={c.code} value={c.code}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {fe.country && <FieldError>{fe.country}</FieldError>}
        </Field>

        <Field data-invalid={!!fe.roleInterests}>
          <FieldLabel htmlFor="role-draft">Cargos que te interesa buscar</FieldLabel>
          <ChipsInput id="role-draft" value={roles} onChange={setRoles} max={MAX_ROLES} placeholder="Ej.: Diseñador de producto" addLabel="Añadir cargo" listLabel="Cargos añadidos" name="role" />
          <FieldDescription>Escribe un cargo y pulsa Enter. Hasta {MAX_ROLES}; los podrás cambiar en Ajustes.</FieldDescription>
          {fe.roleInterests && <FieldError>{fe.roleInterests}</FieldError>}
        </Field>
      </FieldGroup>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending && <Spinner />}
        {submitLabel}
      </Button>
    </form>
  )
}
