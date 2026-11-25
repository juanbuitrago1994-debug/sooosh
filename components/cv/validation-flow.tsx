"use client"

import { useEffect, useState } from "react"
import { ArrowLeftIcon, CheckIcon, InfoIcon, PlusIcon, SparklesIcon, XIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ProgressRing } from "@/components/cv/progress-ring"
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FileTextIcon } from "lucide-react"
import { applyStage, contactParts, dropStage, entryLine, flatSkills, languagesText, removeEntry, roleSuggestions, stagesFor, type Stage, type StageKind } from "@/lib/cv/validate"
import { MOTION } from "@/lib/motion"
import type { CV } from "@/lib/schemas/cv"

/** Nombre corto de la etapa para el indicador de avance. */
const STAGE_NAME: Record<StageKind, string> = { name: "Nombre", role: "Rol", contact: "Contacto", summary: "Resumen", experience: "Experiencia", education: "Educación", skills: "Habilidades", languages: "Idiomas" }
const QUESTIONS: Record<StageKind, string> = {
  experience: "Esta es una experiencia que leímos. ¿Es correcta?",
  education: "Este es un estudio que leímos. ¿Es correcto?",
  name: "Identificamos este nombre. ¿Es correcto?",
  role: "Este es el rol con el que te presentas. ¿Es correcto?",
  contact: "Estos son tus datos de contacto. ¿Son correctos?",
  summary: "Este es el resumen de tu CV. ¿Es correcto?",
  skills: "Estas son las habilidades que leímos. ¿Son correctas?",
  languages: "Estos son los idiomas que leímos. ¿Son correctos?",
}

const shown = (cv: CV, s: Stage) => {
  if (s.kind === "name") return cv.header.fullName
  if (s.kind === "role") return cv.header.headline?.trim() || ""
  if (s.kind === "summary") return cv.summary?.trim() || ""
  if (s.kind === "skills") return flatSkills(cv).join(" · ")
  if (s.kind === "languages") return languagesText(cv)
  if (s.kind === "experience" || s.kind === "education") return entryLine(cv, s)
  return contactParts(cv).filter(Boolean).join(" · ")
}

export type FileFacts = { name: string; detail: string; notes: string[] }

/**
 * Validación del CV leído, en pantalla dividida (UI minimalista): a la izquierda los datos del archivo; a la derecha las etapas, una por una.
 * La persona confirma («Es correcto») o corrige. Se escribe a mano solo lo que la IA no puede generar o es sensible (nombre, contacto); el rol
 * se puede escoger entre los cargos que ya trae el CV. Nunca se inventa un dato.
 */
export function ValidationFlow({ cv, file, onChange, onChangeFile, onContinue, validated = false, onValidated }: { cv: CV; file: FileFacts; onChange: (cv: CV) => void; onChangeFile: () => void; /** botón del último paso */ onContinue?: () => void; /** ya se validó todo (al volver a este paso) */ validated?: boolean; /** avisa cuando se validan todas las etapas */ onValidated?: (all: boolean) => void }) {
  // Las etapas se arman una vez con el CV leído (una por experiencia y por estudio); `step` es la actual y las anteriores ya se confirmaron.
  const [stages, setStages] = useState<Stage[]>(() => stagesFor(cv))
  const [step, setStep] = useState(validated ? stagesFor(cv).length : 0)
  const [dir, setDir] = useState(1)
  const reduce = useReducedMotion()
  const [editing, setEditing] = useState(false)
  const all = step >= stages.length
  const current = all ? null : stages[step]
  useEffect(() => onValidated?.(all), [all, onValidated])

  const confirm = () => {
    setEditing(false)
    setDir(1)
    setStep((n) => n + 1)
  }
  const back = () => {
    setEditing(false)
    setDir(-1)
    setStep((n) => Math.max(0, n - 1))
  }
  /** La persona dice que esa experiencia o estudio no va: se quita del CV y la etapa desaparece. */
  const remove = (at: number) => {
    onChange(removeEntry(cv, stages[at]))
    setStages((l) => dropStage(l, at))
    setEditing(false)
  }

  const enter = reduce ? { opacity: 0 } : { opacity: 0, x: dir * MOTION.offset * 2, filter: `blur(${MOTION.blur}px)` }
  const leave = reduce ? { opacity: 0 } : { opacity: 0, x: dir * -MOTION.offset * 2, filter: `blur(${MOTION.blur}px)` }

  return (
    <div className="grid w-full gap-2 rounded-3xl border bg-card p-2 md:grid-cols-2">
      <section aria-label="Tu archivo" className="order-2 flex flex-col items-center justify-center gap-4 rounded-2xl bg-muted/50 p-6 md:order-1 md:p-8">
        <Attachment state="done" className="w-full max-w-sm">
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
          <p key={n} className="flex max-w-sm items-start gap-2 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{n}</span>
          </p>
        ))}
      </section>

      {/* Dos mitades en una tarjeta: lo que subiste (panel hundido, izquierda) y lo que validas (derecha). */}
      <section aria-label="Validación de tus datos" aria-live="polite" className="order-1 flex min-h-112 flex-col p-4 md:order-2 md:p-6">
        {/* Arriba, fijo: qué debe hacer la persona. En medio, la pregunta junto a su respuesta. Abajo: a la izquierda el avance y a la derecha la botonería. */}
        <header className="flex flex-col gap-1">
          <h1 className="text-sm leading-snug font-medium text-balance">Revisa lo que leímos de tu CV</h1>
          <p className="text-sm leading-snug text-muted-foreground">Confirma cada dato con el tick o corrígelo con la equis. Con ellos armaremos tus CV para cada oferta.</p>
        </header>
        <div className="flex flex-1 flex-col">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${step}-${editing}`}
              className="flex flex-1 flex-col justify-center py-8"
              initial={enter}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={leave}
              transition={{ duration: MOTION.enter / 2, ease: MOTION.ease }}
            >
              {current ? (
                {/* Respuesta arriba y pregunta debajo (al editar, la pregunta va primero); misma distancia que entre el título y el subtítulo. */}
                <div className={`flex gap-1 ${editing ? "flex-col" : "flex-col-reverse"}`}>
                  <p className="text-sm leading-snug text-muted-foreground">{QUESTIONS[current.kind]}</p>
                  <div className="flex flex-col gap-3">
                    {!editing ? (
                      <>
                        <h2 className={`leading-snug font-medium break-words ${shown(cv, current).length > 90 ? "text-base" : "text-xl"}`}>{shown(cv, current) || "No encontramos este dato"}</h2>
                        {current.kind === "experience" && current.idx != null && cv.experience[current.idx]?.bullets.length > 0 && (
                          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground" aria-label="Lo que dice tu CV de esta experiencia">
                            {cv.experience[current.idx].bullets.map((b) => (
                              <li key={b}>{b}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <StageEditor stage={current} cv={cv} onSave={(next) => { onChange(next); confirm() }} />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-muted">
                    <CheckIcon aria-hidden />
                  </span>
                  <h2 className="text-xl font-medium text-balance">Todo validado</h2>
                  <p className="text-sm text-muted-foreground">Estos datos son la base de los CV que armaremos para cada oferta.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="icon-sm" aria-label="Volver a la pregunta anterior" onClick={back}>
                <ArrowLeftIcon aria-hidden />
              </Button>
            )}
            {current ? (
              <ProgressRing label={STAGE_NAME[current.kind]} percent={Math.floor((step / stages.length) * 100)} />
            ) : (
              <span className="text-sm text-muted-foreground">Listo</span>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {!current ? (
              <Button onClick={onContinue}>Continuar a Oferta</Button>
            ) : editing ? (
              <>
                {current.idx != null && (
                  <Button variant="ghost" className="text-muted-foreground" onClick={() => remove(step)}>
                    Quitar del CV
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button type="submit" form={FORM_ID}>
                  Guardar y seguir
                </Button>
              </>
            ) : shown(cv, current) ? (
              <>
                <Button variant="secondary" size="icon-lg" aria-label="No es correcto" title="No es correcto" onClick={() => setEditing(true)}>
                  <XIcon aria-hidden />
                </Button>
                <Button size="icon-lg" aria-label="Es correcto" title="Es correcto" onClick={confirm}>
                  <CheckIcon aria-hidden />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" className="text-muted-foreground" onClick={confirm}>
                  Omitir
                </Button>
                <Button onClick={() => setEditing(true)}>Agregar</Button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

const FORM_ID = "validar-etapa"

function StageEditor({ stage: st, cv, onSave }: { stage: Stage; cv: CV; onSave: (cv: CV) => void }) {
  const stage = st.kind
  const exp = stage === "experience" && st.idx != null ? cv.experience[st.idx] : undefined
  const edu = stage === "education" && st.idx != null ? cv.education[st.idx] : undefined
  const [e, setE] = useState({ role: exp?.role ?? "", company: exp?.company ?? "", location: exp?.location ?? "", startDate: exp?.startDate ?? "", endDate: exp?.endDate ?? "", bullets: (exp?.bullets ?? []).join("\n") })
  const [d, setD] = useState({ institution: edu?.institution ?? "", degree: edu?.degree ?? "", field: edu?.field ?? "", startDate: edu?.startDate ?? "", endDate: edu?.endDate ?? "" })
  const [name, setName] = useState(cv.header.fullName)
  const [role, setRole] = useState(cv.header.headline ?? "")
  const [email, setEmail] = useState(cv.header.email ?? "")
  const [phone, setPhone] = useState(cv.header.phone ?? "")
  const [location, setLocation] = useState(cv.header.location ?? "")
  const [suggest, setSuggest] = useState(false)
  const [summary, setSummary] = useState(cv.summary ?? "")
  const [skills, setSkills] = useState(flatSkills(cv))
  const [newSkill, setNewSkill] = useState("")
  const [langs, setLangs] = useState(cv.languages.map((l) => ({ name: l.name, level: l.level ?? "" })))
  const options = roleSuggestions(cv)
  /** lo que está escrito y aún no se agregó con «+» también cuenta al guardar */
  const pendingSkills = () => (newSkill.trim() ? [...skills, newSkill.trim()] : skills)
  const valid = stage === "name" ? name.trim().length > 0 : stage === "experience" ? !!e.role.trim() && !!e.company.trim() : stage === "education" ? !!d.institution.trim() : true

  return (
    <form
      id={FORM_ID}
      className="flex flex-col gap-3"
      onSubmit={(ev) => {
        ev.preventDefault()
        if (valid) onSave(applyStage(cv, st, { experience: { ...e, bullets: e.bullets.split("\n") }, education: d, name, role, email, phone, location, summary, skills: pendingSkills(), languages: langs }))
      }}
    >
      {stage === "name" && (
        <Field>
          <FieldLabel htmlFor="v-name">Tu nombre completo</FieldLabel>
          <Input required id="v-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
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
      {stage === "experience" && (
        <>
          <Field>
            <FieldLabel htmlFor="v-erole">Cargo</FieldLabel>
            <Input required id="v-erole" value={e.role} onChange={(x) => setE({ ...e, role: x.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="v-eco">Empresa</FieldLabel>
            <Input required id="v-eco" value={e.company} onChange={(x) => setE({ ...e, company: x.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field>
              <FieldLabel htmlFor="v-es">Desde</FieldLabel>
              <Input id="v-es" value={e.startDate} onChange={(x) => setE({ ...e, startDate: x.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="v-ee">Hasta</FieldLabel>
              <Input id="v-ee" value={e.endDate} onChange={(x) => setE({ ...e, endDate: x.target.value })} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="v-el">Ciudad</FieldLabel>
            <Input id="v-el" value={e.location} onChange={(x) => setE({ ...e, location: x.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="v-eb">Logros (uno por línea)</FieldLabel>
            <Textarea id="v-eb" rows={5} value={e.bullets} onChange={(x) => setE({ ...e, bullets: x.target.value })} />
          </Field>
        </>
      )}
      {stage === "education" && (
        <>
          <Field>
            <FieldLabel htmlFor="v-di">Institución</FieldLabel>
            <Input required id="v-di" value={d.institution} onChange={(x) => setD({ ...d, institution: x.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="v-dd">Título</FieldLabel>
            <Input id="v-dd" value={d.degree} onChange={(x) => setD({ ...d, degree: x.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="v-df">Área</FieldLabel>
            <Input id="v-df" value={d.field} onChange={(x) => setD({ ...d, field: x.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field>
              <FieldLabel htmlFor="v-ds">Desde</FieldLabel>
              <Input id="v-ds" value={d.startDate} onChange={(x) => setD({ ...d, startDate: x.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="v-de">Hasta</FieldLabel>
              <Input id="v-de" value={d.endDate} onChange={(x) => setD({ ...d, endDate: x.target.value })} />
            </Field>
          </div>
        </>
      )}
      {stage === "summary" && (
        <Field>
          <FieldLabel htmlFor="v-sum">Tu resumen</FieldLabel>
          <Textarea id="v-sum" rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>
      )}
      {stage === "skills" && (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-wrap gap-2" aria-label="Habilidades de tu CV">
            {skills.map((k) => (
              <li key={k}>
                <Badge variant="secondary" className="gap-1">
                  {k}
                  <button type="button" aria-label={`Quitar ${k}`} className="grid size-4 place-items-center rounded-sm hover:bg-foreground/10" onClick={() => setSkills((l) => l.filter((x) => x !== k))}>
                    <XIcon className="size-3" aria-hidden />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
          <Field>
            <FieldLabel htmlFor="v-skill">Agregar una habilidad</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="v-skill"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSkill.trim()) {
                    e.preventDefault()
                    setSkills((l) => [...l, newSkill.trim()])
                    setNewSkill("")
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" aria-label="Agregar habilidad" disabled={!newSkill.trim()} onClick={() => { setSkills((l) => [...l, newSkill.trim()]); setNewSkill("") }}>
                <PlusIcon aria-hidden />
              </Button>
            </div>
          </Field>
        </div>
      )}
      {stage === "languages" && (
        <div className="flex flex-col gap-2">
          {langs.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input aria-label="Idioma" placeholder="Idioma" value={l.name} onChange={(e) => setLangs((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Input aria-label="Nivel" placeholder="Nivel" value={l.level} onChange={(e) => setLangs((a) => a.map((x, j) => (j === i ? { ...x, level: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${l.name || "idioma"}`} onClick={() => setLangs((a) => a.filter((_, j) => j !== i))}>
                <XIcon aria-hidden />
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setLangs((a) => [...a, { name: "", level: "" }])}>
            <PlusIcon data-icon="inline-start" /> Agregar idioma
          </Button>
        </div>
      )}
    </form>
  )
}
