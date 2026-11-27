"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeftIcon, CheckIcon, PlusIcon, SparklesIcon, XIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ProgressRing } from "@/components/cv/progress-ring"
import { ColdGlow } from "@/components/magic/cold-glow"
import { VerifyIcon } from "@/components/cv/verify-icon"
import { CvFileCard } from "@/components/cv/cv-file-card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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

export type FileFacts = { name: string; detail: string; notes: string[]; /** afinidad del archivo original con el formato ATS: `undefined` = calculando, `null` = no se puede medir */ ats?: { percent: number; labelText: string; good: boolean } | null }

/**
 * Validación del CV leído, en pantalla dividida (UI minimalista): a la izquierda los datos del archivo; a la derecha las etapas, una por una.
 * La persona confirma («Es correcto») o corrige. Se escribe a mano solo lo que la IA no puede generar o es sensible (nombre, contacto); el rol
 * se puede escoger entre los cargos que ya trae el CV. Nunca se inventa un dato.
 */
export function ValidationFlow({ cv, file, onChange, onChangeFile, onContinue, validated = false, onValidated, onExit }: { cv: CV; file: FileFacts; onChange: (cv: CV) => void; onChangeFile: () => void; /** botón del último paso */ onContinue?: () => void; /** ya se validó todo (al volver a este paso) */ validated?: boolean; /** avisa cuando se validan todas las etapas */ onValidated?: (all: boolean) => void; /** salir de la validación sin terminarla: vuelve a la pantalla inicial de subida (quien lo usa confirma, porque descarta la lectura) */ onExit?: () => void }) {
  // Las etapas se arman una vez con el CV leído (una por experiencia y por estudio); `step` es la actual y las anteriores ya se confirmaron.
  const [stages, setStages] = useState<Stage[]>(() => stagesFor(cv))
  const [step, setStep] = useState(validated ? stagesFor(cv).length : 0)
  const [dir, setDir] = useState(1)
  const reduce = useReducedMotion()
  const [editing, setEditing] = useState(false)
  const all = step >= stages.length
  const current = all ? null : stages[step]
  useEffect(() => onValidated?.(all), [all, onValidated])
  // Recargar a mitad de la validación: Cmd/Ctrl+R y F5 se interceptan y se muestra NUESTRO aviso (shadcn). El botón de recargar del navegador no se puede
  // interceptar con un modal propio: ahí queda, de respaldo, la pregunta nativa del navegador (su texto no se puede cambiar).
  const [reloadAsk, setReloadAsk] = useState(false)
  const nativeWarn = useRef<((e: BeforeUnloadEvent) => void) | null>(null)
  useEffect(() => {
    if (all) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    nativeWarn.current = warn
    const keys = (e: KeyboardEvent) => {
      if (e.key === "F5" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r")) {
        e.preventDefault()
        setReloadAsk(true)
      }
    }
    window.addEventListener("beforeunload", warn)
    window.addEventListener("keydown", keys)
    return () => {
      window.removeEventListener("beforeunload", warn)
      window.removeEventListener("keydown", keys)
    }
  }, [all])
  const reloadNow = () => {
    if (nativeWarn.current) window.removeEventListener("beforeunload", nativeWarn.current)
    window.location.reload()
  }

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
    <div className="grid w-full flex-1 gap-2 md:grid-cols-2 md:gap-4">

      {/* Dos mitades sin contenedor común. Izquierda (fija al hacer scroll): «Volver» arriba, a la izquierda, y, en el medio y centrado, el sello, qué hacer, la tarjeta del CV y sus notas. Derecha (panel enmarcado con resplandor frío): las preguntas, el formulario y la botonería. */}
      <section aria-label="Tu archivo" className="flex min-h-112 flex-col px-4 pt-4 pb-2 md:px-6 md:pt-6">
        <div className="flex min-h-9 items-center">
          {step > 0 ? (
            <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={back}>
              <ArrowLeftIcon data-icon="inline-start" aria-hidden /> Volver
            </Button>
          ) : (
            <span />
          )}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center py-6">
          <div className="flex w-full flex-col items-center gap-6 md:sticky md:top-1/2 md:-translate-y-1/2">
          <header className="flex max-w-sm flex-col items-center gap-1 text-center">
            <VerifyIcon aria-hidden className="mb-3 size-11 fill-foreground" />
            <h1 className="text-sm leading-snug font-medium text-balance text-foreground/50">Revisa lo que leímos de tu CV</h1>
            <p className="text-sm leading-snug text-muted-foreground/40">Confirma cada dato con el tick o corrígelo con la equis. Con ellos armaremos tus CV para cada oferta.</p>
          </header>
          <div className="flex w-full max-w-sm flex-col items-center gap-4">
            <CvFileCard file={file} onChange={onChangeFile} />
            {file.notes.map((n) => (
              <p key={n} className="text-center text-xs text-muted-foreground">
                {n}
              </p>
            ))}
          </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2">
          {!all && onContinue && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onContinue}>
              Omitir
            </Button>
          )}
          {onExit && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onExit}>
              Salir
            </Button>
          )}
        </div>
      </section>

      <ColdGlow className="rounded-2xl">
        <section aria-label="Validación de tus datos" aria-live="polite" className="flex h-full min-h-112 flex-col rounded-2xl border bg-background p-4 md:p-6">
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
                  <h2 className="text-xl font-medium text-balance">Todo validado</h2>
                  <p className="text-sm text-muted-foreground">Estos datos son la base de los CV que armaremos para cada oferta.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between gap-4">
            {current ? (
              <ProgressRing label={STAGE_NAME[current.kind]} percent={Math.floor((step / stages.length) * 100)} />
            ) : (
              <span className="text-sm text-muted-foreground">Listo</span>
            )}
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
      </ColdGlow>

      <AlertDialog open={reloadAsk} onOpenChange={setReloadAsk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Seguro que quieres recargar?</AlertDialogTitle>
            <AlertDialogDescription>Si recargas, perderás tu avance y la validación empezará de nuevo desde la primera pregunta. Quédate: te toma un par de minutos terminar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setReloadAsk(false)}>Seguir validando</AlertDialogAction>
            <AlertDialogCancel onClick={reloadNow}>Recargar y perder el avance</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
          <Input required id="v-name" placeholder="Tu nombre completo" aria-label="Tu nombre completo" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
      )}
      {stage === "role" && (
        <Field>
          <div className="flex gap-2">
            <Input id="v-role" placeholder="Tu rol" aria-label="Tu rol" value={role} onChange={(e) => setRole(e.target.value)} />
            {options.length > 0 && (
              <Button type="button" variant="outline" size="icon" aria-label="Sugerir desde mi CV" title="Sugerir desde mi CV" aria-pressed={suggest} onClick={() => setSuggest((v) => !v)}>
                <SparklesIcon aria-hidden />
              </Button>
            )}
          </div>
          {suggest && options.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Cargos que aparecen en tu CV">
              {options.map((o) => (
                <Button key={o} type="button" variant={role === o ? "default" : "outline"} size="sm" onClick={() => setRole(o)}>
                  {o}
                </Button>
              ))}
            </div>
          )}
        </Field>
      )}
      {stage === "contact" && (
        <>
          <Field>
            <Input id="v-email" placeholder="Correo" aria-label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field>
            <Input id="v-phone" placeholder="Teléfono" aria-label="Teléfono" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </Field>
          <Field>
            <Input id="v-loc" placeholder="Ciudad y país" aria-label="Ciudad y país" value={location} onChange={(e) => setLocation(e.target.value)} autoComplete="address-level2" />
          </Field>
        </>
      )}
      {stage === "experience" && (
        <>
          <Field>
            <Input required id="v-erole" placeholder="Cargo" aria-label="Cargo" value={e.role} onChange={(x) => setE({ ...e, role: x.target.value })} />
          </Field>
          <Field>
            <Input required id="v-eco" placeholder="Empresa" aria-label="Empresa" value={e.company} onChange={(x) => setE({ ...e, company: x.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field>
              <Input id="v-es" placeholder="Desde" aria-label="Desde" value={e.startDate} onChange={(x) => setE({ ...e, startDate: x.target.value })} />
            </Field>
            <Field>
              <Input id="v-ee" placeholder="Hasta" aria-label="Hasta" value={e.endDate} onChange={(x) => setE({ ...e, endDate: x.target.value })} />
            </Field>
          </div>
          <Field>
            <Input id="v-el" placeholder="Ciudad" aria-label="Ciudad" value={e.location} onChange={(x) => setE({ ...e, location: x.target.value })} />
          </Field>
          <Field>
            <Textarea id="v-eb" placeholder="Logros (uno por línea)" aria-label="Logros (uno por línea)" rows={5} value={e.bullets} onChange={(x) => setE({ ...e, bullets: x.target.value })} />
          </Field>
        </>
      )}
      {stage === "education" && (
        <>
          <Field>
            <Input required id="v-di" placeholder="Institución" aria-label="Institución" value={d.institution} onChange={(x) => setD({ ...d, institution: x.target.value })} />
          </Field>
          <Field>
            <Input id="v-dd" placeholder="Título" aria-label="Título" value={d.degree} onChange={(x) => setD({ ...d, degree: x.target.value })} />
          </Field>
          <Field>
            <Input id="v-df" placeholder="Área" aria-label="Área" value={d.field} onChange={(x) => setD({ ...d, field: x.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field>
              <Input id="v-ds" placeholder="Desde" aria-label="Desde" value={d.startDate} onChange={(x) => setD({ ...d, startDate: x.target.value })} />
            </Field>
            <Field>
              <Input id="v-de" placeholder="Hasta" aria-label="Hasta" value={d.endDate} onChange={(x) => setD({ ...d, endDate: x.target.value })} />
            </Field>
          </div>
        </>
      )}
      {stage === "summary" && (
        <Field>
          <Textarea id="v-sum" placeholder="Tu resumen" aria-label="Tu resumen" rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} />
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
            <div className="flex gap-2">
              <Input
                id="v-skill"
                placeholder="Agregar una habilidad"
                aria-label="Agregar una habilidad"
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
