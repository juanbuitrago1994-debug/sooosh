"use client"

import { useState, type ReactNode } from "react"
import {
  Controller,
  get,
  useFieldArray,
  useFormContext,
  type ArrayPath,
  type Path,
} from "react-hook-form"
import { ChevronDownIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { ChipsInput } from "@/components/common/chips-input"
import { FieldDescription } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type { CVInput } from "./types"

type Name = Path<CVInput>

function errorMessage(errors: object, name: string): string | undefined {
  return (get(errors, name) as { message?: string } | undefined)?.message
}

export function FieldShell({ label, error, htmlFor, children }: { label: string; error?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}

export function TextField({ name, label, multiline, placeholder }: { name: Name; label: string; multiline?: boolean; placeholder?: string }) {
  const { register, formState } = useFormContext<CVInput>()
  const error = errorMessage(formState.errors, name)
  return (
    <FieldShell label={label} error={error} htmlFor={name}>
      {multiline ? (
        <Textarea id={name} rows={4} placeholder={placeholder} aria-invalid={!!error} {...register(name)} />
      ) : (
        <Input id={name} placeholder={placeholder} aria-invalid={!!error} {...register(name)} />
      )}
    </FieldShell>
  )
}

/** Lista de textos (bullets, detalles…) con agregar y quitar. */
export function StringList({ name, label, addLabel }: { name: Name; label: string; addLabel: string }) {
  const { control, formState } = useFormContext<CVInput>()
  const error = errorMessage(formState.errors, name)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const items: string[] = Array.isArray(field.value) ? (field.value as string[]) : []
        const set = (next: string[]) => field.onChange(next)
        return (
          <FieldShell label={label} error={error}>
            <ul className="flex flex-col gap-2">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Textarea
                    rows={2}
                    value={item}
                    aria-label={`${label} ${i + 1}`}
                    onChange={(e) => set(items.map((v, j) => (j === i ? e.target.value : v)))}
                  />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${label.toLowerCase()} ${i + 1}`} onClick={() => set(items.filter((_, j) => j !== i))}>
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>
            <Button id={name} type="button" variant="outline" className="self-start" onClick={() => set([...items, ""])}>
              <PlusIcon data-icon="inline-start" /> {addLabel}
            </Button>
          </FieldShell>
        )
      }}
    />
  )
}

/** Lista separada por comas (skills, tecnologías). */
export function TagsField({ name, label, placeholder }: { name: Name; label: string; placeholder?: string }) {
  const { control, formState } = useFormContext<CVInput>()
  const error = errorMessage(formState.errors, name)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <TagsInput label={label} placeholder={placeholder} error={error} value={field.value as string[] | undefined} onChange={field.onChange} />}
    />
  )
}

function TagsInput({ label, placeholder, error, value, onChange }: { label: string; placeholder?: string; error?: string; value?: string[]; onChange: (v: string[]) => void }) {
  // Texto local: si recalculáramos desde el array, la coma y el espacio final se perderían al teclear.
  const parse = (t: string) => t.split(",").map((x) => x.trim()).filter(Boolean)
  const joined = (value ?? []).join(", ")
  const [text, setText] = useState(joined)
  const [seen, setSeen] = useState(joined)
  // Si el formulario cambia desde fuera (p. ej. «Llenar con tu CV»), el texto se actualiza; lo que la persona teclea no se pisa.
  if (joined !== seen) {
    setSeen(joined)
    if (parse(text).join("|") !== (value ?? []).join("|")) setText(joined)
  }
  return (
    <FieldShell label={`${label} (separados por comas)`} error={error}>
      <Input
        value={text}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parse(e.target.value))
        }}
      />
    </FieldShell>
  )
}

/** Lista de textos cortos como etiquetas quitables: se escribe y se pulsa Enter (o «+»). Para los titulares del encabezado. */
export function ChipsField({ name, label, hint, placeholder, max, maxLength }: { name: Name; label: string; hint: string; placeholder?: string; max: number; maxLength?: number }) {
  const { control, formState } = useFormContext<CVInput>()
  const error = errorMessage(formState.errors, name)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FieldShell label={label} error={error} htmlFor={name}>
          <ChipsInput id={name} value={(field.value as string[] | undefined) ?? []} onChange={field.onChange} max={max} maxLength={maxLength} placeholder={placeholder} listLabel={label} addLabel={`Añadir a ${label.toLowerCase()}`} />
          <FieldDescription>{hint}</FieldDescription>
        </FieldShell>
      )}
    />
  )
}

/** Sección plegable. */
export function Section({
  title,
  count,
  errors,
  open,
  onOpenChange,
  children,
}: {
  title: string
  count?: number
  errors?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="rounded-xl border bg-card">
      <CollapsibleTrigger className="group flex min-h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-4 text-left font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="flex items-center gap-2">
          {title}
          {count !== undefined && <span className="text-xs font-normal text-muted-foreground">({count})</span>}
          {!!errors && <Badge variant="destructive">{errors} por revisar</Badge>}
        </span>
        <ChevronDownIcon className="size-4 transition-transform group-data-panel-open:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted>
        <FieldGroup className="border-t p-4">{children}</FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Lista de entradas (experiencias, estudios…) con agregar y quitar. */
export function EntryList({
  name,
  itemLabel,
  addLabel,
  emptyEntry,
  children,
}: {
  name: ArrayPath<CVInput>
  itemLabel: string
  addLabel: string
  emptyEntry: unknown
  children: (index: number) => ReactNode
}) {
  const { control } = useFormContext<CVInput>()
  const { fields, append, remove } = useFieldArray({ control, name })
  return (
    <>
      {fields.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyDescription>Nada por aquí todavía.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {fields.map((f, i) => (
        <div key={f.id} className="flex flex-col gap-3 rounded-lg border bg-background p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {itemLabel} {i + 1}
            </span>
            <Button type="button" variant="ghost" onClick={() => remove(i)} aria-label={`Quitar ${itemLabel.toLowerCase()} ${i + 1}`}>
              <Trash2Icon data-icon="inline-start" /> Quitar
            </Button>
          </div>
          {children(i)}
        </div>
      ))}
      <Button type="button" variant="outline" className="self-start" onClick={() => append(emptyEntry as never)}>
        <PlusIcon data-icon="inline-start" /> {addLabel}
      </Button>
    </>
  )
}
