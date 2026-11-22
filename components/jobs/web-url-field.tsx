"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/** Campo para agregar un portafolio o web cuando el CV no trae uno (se usa solo en este correo). `onAdd` devuelve `false` si la dirección no es válida. */
export function WebUrlField({ id, label = "Tu portafolio o web", hint, onAdd }: { id: string; label?: string; hint?: string; onAdd: (raw: string) => boolean }) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const submit = () => {
    if (!draft.trim()) return
    if (onAdd(draft)) {
      setDraft("")
      setError(null)
    } else setError("Escribe una dirección web válida, por ejemplo miportafolio.com.")
  }
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <Input
          id={id}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="miportafolio.com"
          value={draft}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submit()
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" aria-label="Agregar portafolio o web" onClick={submit} disabled={!draft.trim()}>
          <PlusIcon aria-hidden />
        </Button>
      </div>
      {error ? <FieldError>{error}</FieldError> : <FieldDescription>{hint ?? "Tu CV no trae un portafolio o web. Si lo agregas, se usa solo en este correo."}</FieldDescription>}
    </Field>
  )
}
