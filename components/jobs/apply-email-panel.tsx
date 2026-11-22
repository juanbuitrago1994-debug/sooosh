"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CheckIcon, ChevronDownIcon, CopyIcon, DownloadIcon, FileTextIcon, PlusIcon, SparklesIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { toast } from "sonner"
import { DotLoader } from "@/components/ai/dot-loader"
import { FloatingDrawerContent } from "@/components/jobs/floating-drawer"
import { BodyStep } from "@/components/jobs/apply-email-body-step"
import { useEmailBody } from "@/components/jobs/use-email-body"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Drawer, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { buildSubject, personName } from "@/lib/apply/email"
import { ASK_LABEL, type AskKey } from "@/lib/jobs/asks"
import { MOTION } from "@/lib/motion"
import { useSearchProfile } from "@/lib/profile/search-profile"

const MAX_RECIPIENTS = 10
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}$/

/** Cabecera del panel: cambia con el paso (título y una descripción). */
const HEADERS = [
  { title: "Elige el destinatario", description: "Los correos salen de la oferta; puedes agregar otro si hace falta." },
  { title: "Escribe el asunto", description: "Usa el que pide la oferta o pide otra propuesta a la IA local." },
  { title: "Redacta el cuerpo", description: "La IA local arma varias versiones con tu CV y la oferta; elige una y ajústala." },
  { title: "Copia tu correo", description: "Pega cada parte en tu correo y adjunta tu CV desde tu equipo." },
] as const

const STEPS = [
  { title: "Destinatario", description: "Elige a quién le envías tu postulación." },
  { title: "Asunto", description: "Usa el que pide la oferta o ajústalo." },
  { title: "Cuerpo", description: "Revisa el mensaje y ajústalo a tu gusto." },
  { title: "Listo", description: "Copia cada parte en tu correo y adjunta tu CV desde tu equipo." },
] as const

export type ApplyEmailPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: { title: string; company?: string | null; /** de dónde viene la oferta (`linkedin`…) */ sourceName?: string | null }
  /** correos de postulación de la oferta (el más probable primero) */
  emails: string[]
  /** asunto que pide la oferta, si lo dice */
  subject?: string
  /** lo que el CV cubre de la oferta (de /api/jobs/[id]/fit) */
  covered: string[]
  /** requisitos de la oferta (para que la IA entienda qué busca) */
  requirements?: string[]
  /** lo que la oferta pide en el correo (aspiración salarial, disponibilidad…) */
  asks?: AskKey[]
}

/**
 * Asistente de correo (panel lateral): destinatario → asunto → cuerpo → copiar. No adjunta nada: la persona copia cada pieza a su
 * correo y adjunta su CV desde su equipo. Todo local; los datos salen solo del CV y de la oferta.
 */
export function ApplyEmailPanel(props: ApplyEmailPanelProps) {
  return (
    <Drawer open={props.open} onOpenChange={props.onOpenChange} swipeDirection="right">
      {/* Espaciado de los paneles laterales: 24 px entre bloques (título + descripción, campo, lista) y 8 px dentro de un bloque. */}
      {/* Panel flotante, como el de shadcn: separado de los bordes (--drawer-inset), esquinas redondeadas y sin la franja de relleno del borde. */}
      <FloatingDrawerContent>
        <PanelBody {...props} />
      </FloatingDrawerContent>
    </Drawer>
  )
}

function PanelBody({ onOpenChange, job, emails, subject: detected, covered, requirements = [], asks = [] }: ApplyEmailPanelProps) {
  const cv = useSearchProfile()?.cv ?? null
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<string[]>(emails.slice(0, 1))
  // Correos que la persona agrega a mano (la oferta puede traer más de los que detectamos); se marcan solos.
  const [added, setAdded] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const [draftError, setDraftError] = useState<string | null>(null)
  const [subject, setSubject] = useState(() => (cv ? buildSubject({ detected, cv, job }).text : (detected ?? "")))
  const email = useEmailBody({ cv, job, requirements, covered, asks })
  const body = email.body
  const [downloading, setDownloading] = useState(false)
  // El panel de pasos se puede plegar para dejar más espacio al contenido; los botones siempre quedan a la vista.
  const [stepsOpen, setStepsOpen] = useState(true)
  // «Pedir otro asunto»: lo ya mostrado se envía para no repetirlo; la petición se cancela si se cierra el panel.
  const [suggesting, setSuggesting] = useState(false)
  const [subjectHint, setSubjectHint] = useState<string | null>(null)
  const seenSubjects = useRef<string[]>([])
  const suggestAbort = useRef<AbortController | null>(null)
  useEffect(() => () => suggestAbort.current?.abort(), [])

  if (!cv) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4">
        <DrawerHeader className="flex flex-col gap-1 p-0">
          <DrawerTitle>Postular por correo</DrawerTitle>
          <DrawerDescription>Armamos el correo con los datos de tu CV.</DrawerDescription>
        </DrawerHeader>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Primero carga tu CV</EmptyTitle>
            <EmptyDescription>Sin tu CV no podemos escribir tu nombre ni lo que encaja con la oferta, y no inventamos datos. Cárgalo en el buscador de ofertas y vuelve aquí.</EmptyDescription>
          </EmptyHeader>
          <Link href="/ofertas" className={buttonVariants({ variant: "outline" })}>
            Ir al buscador
          </Link>
        </Empty>
      </div>
    )
  }

  const options = [...emails, ...added]
  const addRecipient = () => {
    const e = draft.trim().toLowerCase()
    if (!e) return
    if (!EMAIL_RE.test(e)) return setDraftError("Escribe un correo válido, por ejemplo nombre@empresa.com.")
    if (options.some((o) => o.toLowerCase() === e)) return setDraftError("Ese correo ya está en la lista.")
    if (options.length >= MAX_RECIPIENTS) return setDraftError(`Puedes elegir hasta ${MAX_RECIPIENTS} correos.`)
    setAdded((a) => [...a, e])
    setPicked((p) => [...p, e])
    setDraft("")
    setDraftError(null)
  }
  const removeAdded = (e: string) => {
    setAdded((a) => a.filter((x) => x !== e))
    setPicked((p) => p.filter((x) => x !== e))
  }
  // Los destinatarios se copian en el orden en que aparecen en la lista.
  const recipients = options.filter((o) => picked.includes(o))

    const fromOffer = Boolean(detected)
  const canNext = step === 0 ? recipients.length > 0 : step === 1 ? subject.trim().length > 0 : step === 2 ? body.trim().length > 0 : false

  const suggestSubject = async () => {
    suggestAbort.current?.abort()
    const ctrl = new AbortController()
    suggestAbort.current = ctrl
    setSuggesting(true)
    try {
      const res = await fetch("/api/email/subject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: job.title, company: job.company ?? undefined, name: personName(cv), avoid: [...new Set([...seenSubjects.current, subject].filter(Boolean))].slice(-12) }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error()
      const next = (await res.json()) as { subject?: string; source?: "ia" | "plantilla" }
      if (!next.subject) throw new Error()
      seenSubjects.current = [...seenSubjects.current, subject, next.subject]
      setSubject(next.subject)
      setSubjectHint(next.source === "ia" ? "Sugerido con IA local. Puedes ajustarlo." : "Otra variante de plantilla. Puedes ajustarla.")
    } catch {
      if (!ctrl.signal.aborted) toast.error("No pudimos sugerir otro asunto. Inténtalo de nuevo.")
    } finally {
      if (suggestAbort.current === ctrl) setSuggesting(false)
    }
  }

  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${what} copiado`)
    } catch {
      toast.error("Tu navegador no dejó copiar. Selecciona el texto y cópialo a mano.")
    }
  }

  const download = async () => {
    setDownloading(true)
    try {
      const res = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cv, company: job.company ?? undefined, format: "pdf" }) })
      if (!res.ok) throw new Error()
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "CV.pdf"
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement("a")
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("No pudimos generar el PDF. Inténtalo de nuevo.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
        {/* La cabecera va dentro de la zona con scroll: se va con el contenido en vez de quedarse fija arriba. */}
        <DrawerHeader className="flex flex-col gap-1 p-0 pt-4">
          {/* El texto de la cabecera cambia con el paso: entra con un fundido suave (sin animación con «reducir movimiento»). */}
          <DrawerTitle>
            <motion.span key={`t${step}`} className="block" initial={reduce ? false : { opacity: 0, y: MOTION.offset / 2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : MOTION.enter, ease: MOTION.ease }}>
              {HEADERS[step].title}
            </motion.span>
          </DrawerTitle>
          <DrawerDescription>
            <motion.span key={`d${step}`} className="block" initial={reduce ? false : { opacity: 0, y: MOTION.offset / 2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : MOTION.enter, ease: MOTION.ease, delay: reduce ? 0 : 0.06 }}>
              {HEADERS[step].description}
            </motion.span>
          </DrawerDescription>
        </DrawerHeader>
        {step === 0 && (
          <FieldGroup className="gap-6">
            <Field data-invalid={draftError ? true : undefined}>
              <FieldLabel htmlFor="mail-add" className="sr-only">
                Agregar otro correo
              </FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="mail-add"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="nombre@empresa.com"
                  value={draft}
                  aria-invalid={draftError ? true : undefined}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    setDraftError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addRecipient()
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" aria-label="Agregar correo" onClick={addRecipient} disabled={!draft.trim()}>
                  <PlusIcon aria-hidden />
                </Button>
              </div>
              {draftError && <FieldError>{draftError}</FieldError>}
            </Field>
            {/* Lista compacta: 8 px entre correos; en pantallas táctiles cada fila conserva 44 px de alto. */}
            <div role="group" aria-labelledby="mail-list-label" className="flex flex-col gap-2">
              <p id="mail-list-label" className="text-sm font-medium">
                {options.length > 1 ? "Correos para postular" : "Correo para postular"}
              </p>
              {options.map((e) => (
                <Field key={e} orientation="horizontal" className="items-center pointer-coarse:min-h-11">
                  <Checkbox id={`to-${e}`} checked={picked.includes(e)} onCheckedChange={(on) => setPicked((p) => (on ? [...p, e] : p.filter((x) => x !== e)))} />
                  <FieldLabel htmlFor={`to-${e}`} className="min-w-0 flex-1 break-all font-normal">
                    {e}
                  </FieldLabel>
                  {added.includes(e) && (
                    <Button type="button" variant="ghost" size="icon-xs" aria-label={`Quitar ${e}`} onClick={() => removeAdded(e)}>
                      <XIcon aria-hidden />
                    </Button>
                  )}
                </Field>
              ))}
            </div>
          </FieldGroup>
        )}

        {step === 1 && (
          <Field>
            <FieldLabel htmlFor="mail-subject">Asunto</FieldLabel>
            <div className="flex gap-2">
              <Input id="mail-subject" value={subject} onChange={(e) => setSubject(e.target.value)} readOnly={suggesting} aria-busy={suggesting} className={suggesting ? "opacity-60 transition-opacity" : "transition-opacity"} />
              {!fromOffer && (
                <Button type="button" variant="outline" size="icon" aria-label={suggesting ? "Buscando otro asunto…" : "Pedir otro asunto"} aria-busy={suggesting} disabled={suggesting} onClick={suggestSubject}>
                  {suggesting ? <DotLoader variant="orbit" rounded /> : <SparklesIcon aria-hidden />}
                </Button>
              )}
            </div>
            <FieldDescription>{fromOffer ? "La oferta pide este asunto. Puedes ajustarlo." : (subjectHint ?? "La oferta no pide un asunto; te proponemos este. Con el botón de la derecha puedes pedir otro.")}</FieldDescription>
          </Field>
        )}

        {step === 2 && <BodyStep email={email} sourceName={job.sourceName} />}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <Piece label="Para" text={recipients.join(", ")} onCopy={() => copy("Destinatario", recipients.join(", "))} />
            <Piece label="Asunto" text={subject} onCopy={() => copy("Asunto", subject)} />
            {email.missingAsks.length > 0 && (
              <p className="flex items-start gap-2 text-sm" role="status">
                <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  La oferta pide {email.missingAsks.map((k) => ASK_LABEL[k].toLowerCase()).join(", ")} y todavía no {email.missingAsks.length > 1 ? "están" : "está"} en tu correo. Puedes volver al paso 3 para agregarlo.
                </span>
              </p>
            )}
            <Piece label="Cuerpo" text={body} multiline onCopy={() => copy("Cuerpo", body)} />
            <Button type="button" variant="outline" onClick={download} disabled={downloading}>
              <DownloadIcon data-icon="inline-start" />
              {downloading ? "Preparando PDF…" : "Descargar mi CV (PDF)"}
            </Button>
          </div>
        )}
      </div>

      <DrawerFooter className="gap-6 border-t border-border/40 p-4">
        {/* Los pasos se van revelando de a uno y se pliegan al volver: solo se ven los superados (grises, con check) y el actual.
            El movimiento es lento y suave (curva y duraciones de MOTION); con «reducir movimiento» no anima. */}
        <ol id="mail-steps" className="flex w-full flex-col" aria-label="Pasos">
          <AnimatePresence initial={false}>
            {STEPS.map((s, i) => ({ s, i }))
              .slice(0, step + 1)
              .filter(({ i }) => stepsOpen || i === step)
              .map(({ s, i }) => {
              const done = i < step
              return (
                <motion.li
                  key={s.title}
                  aria-current={done ? undefined : "step"}
                  className="overflow-hidden"
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto", transition: reduce ? { duration: 0 } : { duration: MOTION.enter, ease: MOTION.ease } }}
                  exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, height: 0, transition: { duration: MOTION.exit * 1.5, ease: MOTION.ease } }}
                >
                  <div className="flex items-start gap-2 py-1">
                    <StepMark done={done} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className={`text-xs leading-4 transition-colors duration-500 ${done ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                        Paso {i + 1} · {s.title}
                        {done && <span className="sr-only"> (listo)</span>}
                      </span>
                      <span className={`text-xs leading-4 transition-colors duration-500 ${done ? "text-muted-foreground/70" : "text-muted-foreground"}`}>{s.description}</span>
                    </div>
                    {!done && step > 0 && (
                      <Button type="button" variant="ghost" size="icon-xs" aria-expanded={stepsOpen} aria-controls="mail-steps" aria-label={stepsOpen ? "Ocultar los pasos anteriores" : "Mostrar los pasos anteriores"} onClick={() => setStepsOpen((o) => !o)}>
                        <ChevronDownIcon aria-hidden className={`transition-transform duration-300 ${stepsOpen ? "" : "rotate-180"}`} />
                      </Button>
                    )}
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>
        <div className="flex gap-2">
          {step > 0 ? (
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
              Atrás
            </Button>
          ) : (
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" className="flex-1" disabled={!canNext} onClick={() => {
                if (step + 1 === 2) email.ensureGenerated()
                setStep(step + 1)
              }}>
              Siguiente
            </Button>
          ) : (
            <Button type="button" className="flex-1" onClick={() => onOpenChange(false)}>
              <CheckIcon data-icon="inline-start" />
              Terminar
            </Button>
          )}
        </div>
      </DrawerFooter>
    </div>
  )
}

/** Marca de un paso (solo visual): el MISMO círculo de 18 px con borde fino; vacío si es el actual, relleno en gris con check si ya se superó. */
function StepMark({ done }: { done: boolean }) {
  return (
    <span aria-hidden className={`flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-500 ${done ? "border-muted-foreground bg-muted-foreground" : "border-foreground"}`}>
      {done && <CheckIcon className="size-3 stroke-3 text-popover" />}
    </span>
  )
}

function Piece({ label, text, multiline, onCopy }: { label: string; text: string; multiline?: boolean; onCopy: () => void }) {
  return (
    <section className="flex flex-col gap-1.5" aria-label={label}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <FileTextIcon aria-hidden className="size-4 text-muted-foreground" />
          {label}
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={onCopy} aria-label={`Copiar ${label.toLowerCase()}`}>
          <CopyIcon data-icon="inline-start" />
          Copiar
        </Button>
      </div>
      <p className={`rounded-lg border border-border/40 p-3 text-sm break-words ${multiline ? "whitespace-pre-wrap" : ""}`}>{text}</p>
    </section>
  )
}
