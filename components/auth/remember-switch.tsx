"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { setRememberDevice } from "@/app/cuenta/actions"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"

/** «Mantener sesión iniciada en este dispositivo»: se elige aquí, ya con la sesión abierta (antes era una casilla en el login). Solo afecta a ESTE dispositivo. */
export function RememberSwitch({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  return (
    <Field orientation="horizontal" className="items-start justify-between gap-4">
      <FieldContent>
        <FieldLabel htmlFor="remember-device">Mantener sesión iniciada en este dispositivo</FieldLabel>
        <FieldDescription className="text-xs">{on ? "Seguirás dentro 30 días. Solo en tu equipo personal." : "Al cerrar el navegador tendrás que entrar de nuevo."}</FieldDescription>
      </FieldContent>
      <Switch
        id="remember-device"
        checked={on}
        disabled={pending}
        onCheckedChange={(v) => {
          setOn(v)
          start(async () => {
            if (await setRememberDevice(v)) toast.success(v ? "Sesión mantenida en este dispositivo" : "La sesión se cerrará con el navegador")
            else {
              setOn(!v)
              toast.error("No pudimos cambiarlo. Inténtalo de nuevo.")
            }
          })
        }}
      />
    </Field>
  )
}
