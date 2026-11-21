"use client"

import { useState, type CSSProperties } from "react"
import Link from "next/link"
import { CheckIcon, CircleCheckIcon, CopyIcon, DownloadIcon, FileTextIcon, PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { buildBody, buildSubject, webLinks } from "@/lib/apply/email"
import { useSearchProfile } from "@/lib/profile/search-profile"

const MAX_RECIPIENTS = 10
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}$/

const STEPS = ["Destinatario", "Asunto", "Cuerpo", "Listo"] as const

export type ApplyEmailPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: { title: string; company?: string | null }
  /** correos de postulación de la oferta (el más probable primero) */
  emails: string[]
  /** asunto que pide la oferta, si lo dice */
  subject?: string
  /** lo que el CV cubre de la oferta (de /api/jobs/[id]/fit) */
  covered: string[]
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
      <DrawerContent
        style={{ "--drawer-inset": "0.75rem", "--drawer-bleed-background": "transparent" } as CSSProperties}
        className="top-0 bottom-0 left-0 h-auto w-auto border-border/40 bg-popover/60 backdrop-blur-xl data-[swipe-direction=right]:rounded-2xl data-[swipe-direction=right]:border sm:left-auto sm:w-full sm:max-w-md"
      >
        <PanelBody {...props} />
      </DrawerContent>
    </Drawer>
  )
}

function PanelBody({ onOpenChange, job, emails, subject: detected, covered }: ApplyEmailPanelProps) {
  const cv = useSearchProfile()?.cv ?? null
  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<string[]>(emails.slice(0, 1))
  // Correos que la persona agrega a mano (la oferta puede traer más de los que detectamos); se marcan solos.
  const [added, setAdded] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const [draftError, setDraftError] = useState<string | null>(null)
  const [subject, setSubject] = useState(() => (cv ? buildSubject({ detected, cv, job }).text : (detected ?? "")))
  const [includeWeb, setIncludeWeb] = useState(false)
  const [body, setBody] = useState(() => (cv ? buildBody({ cv, job, covered, includeWeb: false }) : ""))
  const [edited, setEdited] = useState(false)
  const [downloading, setDownloading] = useState(false)

  if (!cv) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4">
        <DrawerHeader className="flex flex-col gap-1">
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

  const links = webLinks(cv)
  const fromOffer = Boolean(detected)
  const canNext = step === 0 ? recipients.length > 0 : step === 1 ? subject.trim().length > 0 : step === 2 ? body.trim().length > 0 : false

  const toggleWeb = (on: boolean) => {
    setIncludeWeb(on)
    if (!edited) setBody(buildBody({ cv, job, covered, includeWeb: on }))
  }
  const resetBody = () => {
    setBody(buildBody({ cv, job, covered, includeWeb }))
    setEdited(false)
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
      <DrawerHeader className="flex flex-col gap-1 p-4 pb-6">
        <DrawerTitle>Postular por correo</DrawerTitle>
        <DrawerDescription>Armamos el correo con los datos de tu CV. Los destinatarios salen de la oferta; puedes agregar otro.</DrawerDescription>
      </DrawerHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
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
            <Input id="mail-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="min-h-11" />
            <FieldDescription>{fromOffer ? "La oferta pide este asunto. Puedes ajustarlo." : "La oferta no pide un asunto; te proponemos este."}</FieldDescription>
          </Field>
        )}

        {step === 2 && (
          <FieldGroup className="gap-6">
            <Field>
              <FieldLabel htmlFor="mail-body">Cuerpo del correo</FieldLabel>
              <Textarea
                id="mail-body"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value)
                  setEdited(true)
                }}
                className="h-80"
              />
              <FieldDescription>Solo usamos datos de tu CV y de la oferta. Revísalo y ajústalo a tu gusto.</FieldDescription>
            </Field>
            <Field orientation="horizontal" className="items-center justify-between pointer-coarse:min-h-11">
              <FieldLabel htmlFor="mail-web" className="font-normal">
                Incluir mi portafolio o web
              </FieldLabel>
              <Switch id="mail-web" checked={includeWeb} disabled={links.length === 0} onCheckedChange={toggleWeb} />
            </Field>
            {links.length === 0 && <FieldDescription>Tu CV no tiene un portafolio o web cargado.</FieldDescription>}
            {edited && (
              <Button type="button" variant="outline" onClick={resetBody}>
                Volver al texto base
              </Button>
            )}
          </FieldGroup>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">Copia cada parte en tu correo. No adjuntamos archivos: adjunta tu CV desde tu equipo.</p>
            <Piece label="Para" text={recipients.join(", ")} onCopy={() => copy("Destinatario", recipients.join(", "))} />
            <Piece label="Asunto" text={subject} onCopy={() => copy("Asunto", subject)} />
            <Piece label="Cuerpo" text={body} multiline onCopy={() => copy("Cuerpo", body)} />
            <Button type="button" variant="outline" onClick={download} disabled={downloading}>
              <DownloadIcon data-icon="inline-start" />
              {downloading ? "Preparando PDF…" : "Descargar mi CV (PDF)"}
            </Button>
          </div>
        )}
      </div>

      <DrawerFooter className="gap-6 border-t border-border/40 p-4">
        {/* Los pasos se van revelando de a uno: solo se ven los superados (en gris, con un check sólido) y el actual. */}
        <ol className="flex w-full flex-col gap-2 text-sm" aria-label="Pasos">
          {STEPS.slice(0, step + 1).map((s, i) => {
            const done = i < step
            return (
              <li key={s} aria-current={done ? undefined : "step"} className="flex items-center gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200">
                {done ? <CircleCheckIcon aria-hidden className="size-4 fill-muted-foreground stroke-popover" /> : <span aria-hidden className="size-4 rounded-full border-2 border-foreground" />}
                <span className={done ? "text-muted-foreground" : "font-medium text-foreground"}>
                  {s}
                  {done && <span className="sr-only"> (listo)</span>}
                </span>
              </li>
            )
          })}
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
            <Button type="button" className="flex-1" disabled={!canNext} onClick={() => setStep(step + 1)}>
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
