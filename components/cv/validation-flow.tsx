"use client"

import { useState } from "react"
import { CheckIcon, CircleIcon, InfoIcon, SparklesIcon } from "lucide-react"
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Trace, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace"
import { FileTextIcon } from "lucide-react"
import { applyStage, contactParts, roleSuggestions, VALIDATION_STAGES, type ValidationStage } from "@/lib/cv/validate"
import type { CV } from "@/lib/schemas/cv"

const TITLES: Record<ValidationStage, string> = { name: "Nombre", role: "Rol", contact: "Contacto" }
const QUESTIONS: Record<ValidationStage, string> = {
  name: "Identificamos este nombre. ¿Es correcto?",
  role: "Este es el rol con el que te presentas. ¿Es correcto?",
  contact: "Estos son tus datos de contacto. ¿Son correctos?",
}

const shown = (cv: CV, s: ValidationStage) => {
  if (s === "name") return cv.header.fullName
  if (s === "role") return cv.header.headline?.trim() || ""
  return contactParts(cv).filter(Boolean).join(" · ")
}

export type FileFacts = { name: string; detail: string; notes: string[] }

/**
 * Validación del CV leído, en pantalla dividida (UI minimalista): a la izquierda los datos del archivo; a la derecha las etapas, una por una.
 * La persona confirma («Es correcto») o corrige. Se escribe a mano solo lo que la IA no puede generar o es sensible (nombre, contacto); el rol
 * se puede escoger entre los cargos que ya trae el CV. Nunca se inventa un dato.
 */
export function ValidationFlow({ cv, file, onChange, onChangeFile }: { cv: CV; file: FileFacts; onChange: (cv: CV) => void; onChangeFile: () => void }) {
  const [done, setDone] = useState<ValidationStage[]>([])
  const [editing, setEditing] = useState(false)
  const current = VALIDATION_STAGES.find((s) => !done.includes(s))

  const confirm = (s: ValidationStage) => {
    setEditing(false)
    setDone((d) => [...d, s])
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section aria-label="Tu archivo" className="flex flex-col gap-4 md:sticky md:top-4 md:self-start">
        <Attachment state="done" className="w-full">
          <AttachmentMedia>
            <FileTextIcon />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{file.name}</AttachmentTitle>
            <AttachmentDescription>{file.detail}</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onChangeFile}>
              Cambiar
            </Button>
          </AttachmentActions>
        </Attachment>
        {file.notes.map((n) => (
          <p key={n} className="flex items-start gap-2 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{n}</span>
          </p>
        ))}
      </section>

      <section aria-label="Validación de tus datos" className="flex flex-col gap-6">
        {VALIDATION_STAGES.map((s) => {
          const isDone = done.includes(s)
          const isCurrent = s === current
          return (
            <div key={s} className="flex flex-col gap-3">
              <Trace>
                <TraceLine status={isCurrent ? undefined : isDone ? undefined : "pending"} aria-current={isCurrent ? "step" : undefined}>
                  <TraceIcon>{isDone ? <CheckIcon /> : <CircleIcon />}</TraceIcon>
                  <TraceTitle>{TITLES[s]}</TraceTitle>
                  {isDone && <TraceDescription>{shown(cv, s) || "Sin dato"}</TraceDescription>}
                </TraceLine>
              </Trace>
              {isCurrent && (
                <div className="flex flex-col gap-3 pl-6">
                  <p className="text-sm text-muted-foreground">{QUESTIONS[s]}</p>
                  {!editing ? (
                    <>
                      <p className="text-base font-medium break-words">{shown(cv, s) || "No encontramos este dato"}</p>
                      <div className="flex flex-wrap gap-2">
                        {shown(cv, s) && <Button onClick={() => confirm(s)}>Es correcto</Button>}
                        <Button variant="outline" onClick={() => setEditing(true)}>
                          {shown(cv, s) ? "No es correcto" : "Agregar"}
                        </Button>
                        {s === "role" && !shown(cv, s) && roleSuggestions(cv).length === 0 && (
                          <Button variant="ghost" className="text-muted-foreground" onClick={() => confirm(s)}>
                            Omitir
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <StageEditor stage={s} cv={cv} onSave={(next) => { onChange(next); confirm(s) }} onCancel={() => setEditing(false)} />
                  )}
                </div>
              )}
            </div>
          )
        })}
        {!current && <p className="text-sm text-muted-foreground">Listo: estos datos ya están validados.</p>}
      </section>
    </div>
  )
}

function StageEditor({ stage, cv, onSave, onCancel }: { stage: ValidationStage; cv: CV; onSave: (cv: CV) => void; onCancel: () => void }) {
  const [name, setName] = useState(cv.header.fullName)
  const [role, setRole] = useState(cv.header.headline ?? "")
  const [email, setEmail] = useState(cv.header.email ?? "")
  const [phone, setPhone] = useState(cv.header.phone ?? "")
  const [location, setLocation] = useState(cv.header.location ?? "")
  const [suggest, setSuggest] = useState(false)
  const options = roleSuggestions(cv)
  const valid = stage === "name" ? name.trim().length > 0 : true

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave(applyStage(cv, stage, { name, role, email, phone, location }))
      }}
    >
      {stage === "name" && (
        <Field>
          <FieldLabel htmlFor="v-name">Tu nombre completo</FieldLabel>
          <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
      )}
      {stage === "role" && (
        <>
          <Field>
            <FieldLabel htmlFor="v-role">Tu rol</FieldLabel>
            <Input id="v-role" value={role} onChange={(e) => setRole(e.target.value)} />
          </Field>
          {options.length > 0 && (
            <div className="flex flex-col gap-2">
              <Button type="button" variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setSuggest((v) => !v)}>
                <SparklesIcon data-icon="inline-start" /> Sugerir desde mi CV
              </Button>
              {suggest && (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Cargos que aparecen en tu CV">
                  {options.map((o) => (
                    <Button key={o} type="button" variant={role === o ? "default" : "outline"} size="sm" onClick={() => setRole(o)}>
                      {o}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {stage === "contact" && (
        <>
          <Field>
            <FieldLabel htmlFor="v-email">Correo</FieldLabel>
            <Input id="v-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field>
            <FieldLabel htmlFor="v-phone">Teléfono</FieldLabel>
            <Input id="v-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </Field>
          <Field>
            <FieldLabel htmlFor="v-loc">Ciudad y país</FieldLabel>
            <Input id="v-loc" value={location} onChange={(e) => setLocation(e.target.value)} autoComplete="address-level2" />
          </Field>
        </>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={!valid}>
          Guardar y seguir
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
