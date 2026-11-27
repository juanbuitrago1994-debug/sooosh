"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import type { ProfileFormState } from "@/lib/auth/profile-store"
import { ChipsInput } from "@/components/common/chips-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LocateFixedIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { MAX_ROLES } from "@/lib/auth/profile-schema"

export type CountryOption = { code: string; name: string }

/** Registro de una cuenta nueva: nombre, país de residencia y cargos que le interesan. Los mismos datos se editan en Ajustes (mismo formulario). */
export function OnboardingForm({ action: submit, defaultName, defaultCountry = "", defaultCity = "", defaultRoles = [], countries, submitLabel = "Continuar", hint, formId, hideSubmit = false, onStatus }: { action: (prev: ProfileFormState, form: FormData) => Promise<ProfileFormState>; defaultName: string; defaultCountry?: string; defaultCity?: string; defaultRoles?: string[]; countries: CountryOption[]; submitLabel?: string; /** texto de ayuda de los cargos; por defecto el del registro */ hint?: string; /** id del formulario, para que botones de fuera lo envíen con `form="…"` */ formId?: string; /** oculta el botón de abajo (los botones viven en otra parte) */ hideSubmit?: boolean; /** avisa de si hay cambios sin guardar y si se está guardando */ onStatus?: (s: { dirty: boolean; pending: boolean }) => void }) {
  const [dirty, setDirty] = useState(false)
  const [country, setCountry] = useState(defaultCountry)
  const [city, setCity] = useState(defaultCity)
  const [locating, setLocating] = useState(false)
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(async (prev, form) => {
    const next = await submit(prev, form)
    if (next.saved) setDirty(false)
    return next
  }, {})
  const [roles, setRoles] = useState<string[]>(defaultRoles)
  useEffect(() => {
    if (state.saved) toast.success("Cambios guardados")
  }, [state])
  useEffect(() => {
    onStatus?.({ dirty, pending })
  }, [dirty, pending, onStatus])
  const fe = state.fieldErrors ?? {}

  /** Pide permiso de ubicación al navegador y pone el país y la ciudad que corresponden (las coordenadas solo se usan para eso y no se guardan). */
  function locate() {
    if (!("geolocation" in navigator)) return void toast.error("Tu navegador no permite usar la ubicación.")
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const r = await fetch(`/api/geo/country?lat=${coords.latitude}&lon=${coords.longitude}`)
          const { country: found, city: foundCity } = (await r.json()) as { country?: string | null; city?: string | null }
          if (!r.ok) throw new Error()
          if (found) {
            setCountry(found)
            if (foundCity) setCity(foundCity)
            setDirty(true)
          } else toast.error("Tu país no está en la lista; elígelo a mano.")
        } catch {
          toast.error("No se pudo identificar tu país; elígelo a mano.")
        } finally {
          setLocating(false)
        }
      },
      (err) => {
        setLocating(false)
        toast.error(err.code === err.PERMISSION_DENIED ? "No diste permiso de ubicación; elige tu país a mano." : "No se pudo obtener tu ubicación; elige tu país a mano.")
      },
      { timeout: 10000, maximumAge: 600000 },
    )
  }

  return (
    <form id={formId} action={action} onChange={() => setDirty(true)} className="flex w-full flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={!!fe.name}>
          <FieldLabel htmlFor="name">Nombre</FieldLabel>
          <Input id="name" name="name" defaultValue={defaultName} autoComplete="name" maxLength={80} aria-invalid={!!fe.name} required />
          {fe.name && <FieldError>{fe.name}</FieldError>}
        </Field>

        <Field data-invalid={!!fe.country}>
          <FieldLabel htmlFor="country">País de residencia</FieldLabel>
          <NativeSelect id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} className="w-full" aria-invalid={!!fe.country} required>
            <NativeSelectOption value="" disabled>
              Elige tu país
            </NativeSelectOption>
            {countries.map((c) => (
              <NativeSelectOption key={c.code} value={c.code}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type="button" variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={locate} disabled={locating}>
            {locating ? <Spinner /> : <LocateFixedIcon aria-hidden />}
            Usar mi ubicación
          </Button>
          {fe.country && <FieldError>{fe.country}</FieldError>}
        </Field>

        <Field data-invalid={!!fe.city}>
          <FieldLabel htmlFor="city">Ciudad</FieldLabel>
          <Input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" maxLength={80} placeholder="Opcional" aria-invalid={!!fe.city} />
          {fe.city && <FieldError>{fe.city}</FieldError>}
        </Field>

        <Field data-invalid={!!fe.roleInterests}>
          <FieldLabel htmlFor="role-draft">Cargos que te interesa buscar</FieldLabel>
          <ChipsInput id="role-draft" value={roles} onChange={(r) => (setRoles(r), setDirty(true))} max={MAX_ROLES} placeholder="Ej.: Diseñador de producto" addLabel="Añadir cargo" listLabel="Cargos añadidos" name="role" />
          <FieldDescription className="text-xs">{hint ?? `Escribe un cargo y pulsa Enter. Hasta ${MAX_ROLES}; los podrás cambiar en Ajustes.`}</FieldDescription>
          {fe.roleInterests && <FieldError>{fe.roleInterests}</FieldError>}
        </Field>
      </FieldGroup>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {!hideSubmit && (
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          {submitLabel}
        </Button>
      )}
    </form>
  )
}
