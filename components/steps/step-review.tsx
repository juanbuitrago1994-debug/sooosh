"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircleIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon, ChevronDownIcon, FileSearchIcon, PencilIcon, RefreshCwIcon, SparklesIcon, UserRoundIcon, XIcon } from "lucide-react"
import { useAiWork } from "@/components/ai/ai-work"
import { StepHeader } from "@/components/wizard/step-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Textarea } from "@/components/ui/textarea"
import { wordDiff } from "@/lib/rewrite/diff"
import { proposeExtras } from "@/lib/rewrite/extras"
import { groupLabel, rewriteGroups, type Decision, type Decisions, type RewriteItem } from "@/lib/rewrite/groups"
import type { MatchResult } from "@/lib/match/types"
import { verifyNoInvention } from "@/lib/rewrite/verify"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"

export type ReviewState = { inputKey: string; items: RewriteItem[]; decisions: Decisions }

/** Las propuestas dependen del CV y de la oferta: si cambian, hay que volver a generarlas. */
export const reviewKey = (cv: CV, offer: Offer) => JSON.stringify([cv, offer])
/** Cambios por decidir (los pendientes se descartan si la persona continúa sin decidirlos). */
export const pendingCount = (r: ReviewState | null) => (r ? r.items.filter((i) => i.status === "changed" && (r.decisions[i.id]?.status ?? "pending") === "pending").length : 0)
export const reviewReady = (r: ReviewState | null, cv: CV | null, offer: Offer | null) =>
  !!r && !!cv && !!offer && r.inputKey === reviewKey(cv, offer)

type Err = { message: string; code?: string }

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col gap-5">
      <StepHeader title="Revisa los cambios" />
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{text}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}

function OllamaHelp() {
  const code = "rounded-sm bg-muted px-1 font-mono"
  return (
    <ol className="mt-2 list-decimal pl-5 text-sm text-foreground">
      <li>
        Abre la aplicación de Ollama, o ejecuta <code className={code}>ollama serve</code> en una terminal.
      </li>
      <li>
        Comprueba que el modelo está descargado con <code className={code}>ollama list</code>; si falta, <code className={code}>ollama pull &lt;modelo&gt;</code>.
      </li>
      <li>
        Revisa <code className={code}>OLLAMA_URL</code> y <code className={code}>OLLAMA_MODEL</code> en <code className={code}>.env.local</code>.
      </li>
      <li>Pulsa «Reintentar».</li>
    </ol>
  )
}

function Diff({ original, proposed, side }: { original: string; proposed: string; side: "original" | "proposed" }) {
  const parts = wordDiff(original, proposed)
  return (
    <p className="text-sm leading-relaxed">
      {parts
        .filter((p) => (side === "original" ? p.type !== "add" : p.type !== "del"))
        .map((p, i) => (
          <span
            key={i}
            className={p.type === "del" ? "text-muted-foreground line-through" : p.type === "add" ? "rounded-sm bg-accent px-0.5 text-accent-foreground" : undefined}
          >
            {p.text}{" "}
          </span>
        ))}
    </p>
  )
}

const KIND = { cambiar: "Cambiar", quitar: "Quitar", añadir: "Añadir" } as const

const hash = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** Guarda la decisión en la memoria de preferencias local (no bloquea la interfaz). */
function remember(key: string, offer: Offer, it: RewriteItem, d: Decision, reason?: string) {
  const decision = d.status === "accepted" ? (d.edited !== undefined ? "editado" : "aceptado") : "rechazado"
  fetch("/api/learning/decisions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ref: `${hash(key)}:${it.id}`,
      kind: it.kind ?? "cambiar",
      section: it.section ?? "Experiencia",
      risk: it.risk ?? "medio",
      original: it.original,
      proposal: it.proposed,
      decision,
      editedText: d.edited,
      reason,
      changeReason: it.reason,
      offerTitle: offer.title,
      language: offer.language,
    }),
  }).catch(() => {})
}

function ChangeBody({ item, text }: { item: RewriteItem; text: string }) {
  if (item.kind === "quitar") {
    return (
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-muted-foreground">Se quita esta viñeta</h3>
        <p className="text-sm text-muted-foreground line-through">{item.original}</p>
      </div>
    )
  }
  if (item.kind === "añadir") {
    return (
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-muted-foreground">Se añade a tus habilidades</h3>
        <p className="text-sm">
          <span className="rounded-sm bg-accent px-1 text-accent-foreground">{text}</span>
        </p>
      </div>
    )
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-muted-foreground">Original</h3>
        <Diff original={item.original} proposed={text} side="original" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-muted-foreground">Propuesta</h3>
        <Diff original={item.original} proposed={text} side="proposed" />
      </div>
    </div>
  )
}

export function StepReview({
  cv,
  guard,
  offer,
  match,
  style,
  value,
  onChange,
}: {
  cv: CV | null
  /** Texto de la fuente de verdad (CV original + correcciones del usuario) contra el que se verifica todo. */
  guard: string | null
  offer: Offer | null
  match: MatchResult | null
  /** frase de estilo del CV (diagnóstico): la reescritura debe conservarlo */
  style?: string
  value: ReviewState | null
  onChange: (v: ReviewState | null) => void
}) {
  const [error, setError] = useState<Err | null>(null)
  const [idx, setIdx] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [draftError, setDraftError] = useState("")
  const [reason, setReason] = useState("")
  const ai = useAiWork()

  const fresh = reviewReady(value, cv, offer)
  const queue = useMemo(() => (fresh ? value!.items.filter((i) => i.status === "changed") : []), [fresh, value])
  const unchanged = useMemo(() => (fresh ? value!.items.filter((i) => i.status !== "changed") : []), [fresh, value])
  const decisions = useMemo<Decisions>(() => (fresh ? value!.decisions : {}), [fresh, value])
  const statusOf = useCallback((id: string) => decisions[id]?.status ?? "pending", [decisions])

  const cur = queue.length ? queue[Math.min(idx, queue.length - 1)] : null
  const curDecision: Decision = cur ? decisions[cur.id] ?? { status: "pending" } : { status: "pending" }

  const nextPending = useCallback(
    (from: number) => {
      for (let k = 1; k <= queue.length; k++) {
        const j = (from + k) % queue.length
        if (statusOf(queue[j].id) === "pending") return j
      }
      return from
    },
    [queue, statusOf],
  )

  const decide = useCallback(
    (it: RewriteItem, d: Decision, advance = true) => {
      if (!value || !offer) return
      onChange({ ...value, decisions: { ...value.decisions, [it.id]: d } })
      remember(value.inputKey, offer, it, d)
      setEditing(false)
      setReason("")
      if (advance) setIdx(nextPending(queue.indexOf(it)))
    },
    [value, offer, onChange, nextPending, queue],
  )

  // Atajos de teclado: A aceptar · R rechazar · E editar · ← → moverse. No actúan mientras se escribe.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (!cur || e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, [contenteditable=true], [role=dialog]")) return
      const k = e.key.toLowerCase()
      if (k === "a") decide(cur, { status: "accepted", edited: curDecision.edited })
      else if (k === "r") decide(cur, { status: "rejected" })
      else if (k === "e" && cur.kind !== "quitar") startEdit()
      else if (e.key === "ArrowRight") setIdx((i) => Math.min(queue.length - 1, i + 1))
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1))
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, curDecision, queue, decide])

  if (!cv) return <EmptyState icon={<UserRoundIcon />} title="Falta tu perfil" text="Vuelve al primer paso y sube tu CV." />
  if (!offer) return <EmptyState icon={<FileSearchIcon />} title="Falta la oferta" text="Vuelve al paso de la oferta, pégala y analízala." />

  function startEdit() {
    if (!cur) return
    setDraft(curDecision.edited ?? cur.proposed)
    setDraftError("")
    setEditing(true)
  }
  const saveEdit = () => {
    if (!cur || !cv || !offer) return
    const v = verifyNoInvention(guard ?? cv, draft, { offer })
    if (!draft.trim()) return setDraftError("El texto no puede quedar vacío.")
    if (!v.ok) return setDraftError(`${v.violations.map((x) => x.message).join(" ")} Si es cierto, agrégalo primero con «Corregir» en el primer paso.`)
    decide(cur, { status: "accepted", edited: draft.trim() })
  }

  const generate = async () => {
    const groups = rewriteGroups(cv)
    const ctrl = new AbortController()
    setError(null)
    const items: RewriteItem[] = []
    // Cada grupo es una llamada real al modelo: el ticker avanza con ellas, no con un temporizador.
    ai.start(groups.length ? groups.map((g) => `Reescribiendo: ${groupLabel(cv, g).split(" · ")[0]}`) : ["Preparando los cambios"], () => ctrl.abort())
    try {
      for (let i = 0; i < groups.length; i++) {
        ai.advance(i)
        const res = await fetch("/api/rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cv, offer, group: groups[i], guard, style }),
          signal: ctrl.signal,
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw Object.assign(new Error(json.error ?? "No se pudo reescribir el CV."), { code: json.code })
        items.push(...(json.items as RewriteItem[]))
      }
      // Cambios deterministas con evidencia exacta: quitar viñetas inútiles y añadir habilidades ya demostradas.
      items.push(...proposeExtras(cv, match, guard ?? undefined))
      setIdx(0)
      onChange({ inputKey: reviewKey(cv, offer), items, decisions: {} })
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError({ message: (e as Error).message, code: (e as { code?: string }).code })
    } finally {
      ai.stop()
    }
  }

  const approveLowRisk = () => {
    if (!value) return
    const next = { ...value.decisions }
    for (const it of queue) {
      if (statusOf(it.id) === "pending" && it.risk === "bajo") {
        next[it.id] = { status: "accepted" }
        remember(value.inputKey, offer, it, next[it.id])
      }
    }
    onChange({ ...value, decisions: next })
    setIdx(nextPending(idx))
  }

  const count = (s: Decision["status"]) => queue.filter((i) => statusOf(i.id) === s).length
  const accepted = count("accepted")
  const rejected = count("rejected")
  const pending = queue.length - accepted - rejected
  const lowPending = queue.filter((i) => statusOf(i.id) === "pending" && i.risk === "bajo").length
  const needsHelp = error && ["unreachable", "model_missing", "not_configured", "timeout"].includes(error.code ?? "")
  const text = cur ? curDecision.edited ?? cur.proposed : ""

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        title="Revisa los cambios"
        description="El modelo local propone cambios solo con lo que ya dices en tu CV, y cada uno cita la evidencia. Decides uno a uno; solo lo que aceptes entra en tu CV final."
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{needsHelp ? "No pudimos usar el modelo local" : "No pudimos reescribir tu CV"}</AlertTitle>
          <AlertDescription className="whitespace-pre-line">
            {error.message}
            {needsHelp && <OllamaHelp />}
          </AlertDescription>
        </Alert>
      )}
      {value && !fresh && (
        <Alert>
          <AlertCircleIcon />
          <AlertTitle>Tu CV o la oferta cambiaron</AlertTitle>
          <AlertDescription>Las propuestas anteriores ya no corresponden. Vuelve a generarlas.</AlertDescription>
        </Alert>
      )}

      {!fresh && (
        <Button size="lg" className="h-11" onClick={generate}>
          {error ? <RefreshCwIcon data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
          {error ? "Reintentar" : "Proponer cambios para esta oferta"}
        </Button>
      )}

      {fresh && queue.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SparklesIcon />
            </EmptyMedia>
            <EmptyTitle>Sin cambios que proponer</EmptyTitle>
            <EmptyDescription>Tu CV ya dice lo que la oferta pide con tus propias palabras, o el modelo solo habría inventado. Puedes continuar tal cual.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {fresh && queue.length > 0 && cur && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Cambio {Math.min(idx, queue.length - 1) + 1} de {queue.length} · {accepted} {accepted === 1 ? "aceptado" : "aceptados"} · {rejected} {rejected === 1 ? "rechazado" : "rechazados"} · {pending} {pending === 1 ? "pendiente" : "pendientes"}
            </p>
            {lowPending > 0 && (
              <Button variant="secondary" className="h-11" onClick={approveLowRisk}>
                Aprobar los {lowPending} de bajo riesgo
              </Button>
            )}
          </div>

          <article className="flex flex-col gap-4 rounded-2xl bg-muted p-4" aria-labelledby="cambio-actual">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="cambio-actual" className="text-sm font-medium">
                {cur.label}
              </h2>
              <Badge variant="outline">{KIND[cur.kind ?? "cambiar"]}</Badge>
              {cur.risk && <Badge variant={cur.risk === "bajo" ? "secondary" : "outline"}>Riesgo {cur.risk}</Badge>}
              {curDecision.status !== "pending" && <Badge variant={curDecision.status === "accepted" ? "default" : "outline"}>{curDecision.status === "accepted" ? (curDecision.edited !== undefined ? "Editado" : "Aceptado") : "Rechazado"}</Badge>}
            </div>

            <ChangeBody item={cur} text={text} />

            {cur.reason && (
              <p className="text-sm">
                <span className="font-medium">Motivo: </span>
                <span className="text-muted-foreground">{cur.reason}</span>
              </p>
            )}
            {cur.evidence && cur.evidence.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-medium text-muted-foreground">Evidencia: lo que dice tu CV</h3>
                <ul className="flex flex-col gap-1.5">
                  {cur.evidence.map((e) => (
                    <li key={e} className="border-l-2 border-primary pl-3 text-sm text-muted-foreground">
                      «{e}»
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {editing ? (
              <div className="flex flex-col gap-2">
                <Field data-invalid={!!draftError}>
                  <Textarea rows={4} value={draft} aria-label={`Editar: ${cur.label}`} aria-invalid={!!draftError} onChange={(e) => setDraft(e.target.value)} />
                  {draftError && <FieldError>{draftError}</FieldError>}
                </Field>
                <div className="flex gap-2">
                  <Button className="h-11 flex-1" onClick={saveEdit}>
                    Guardar edición
                  </Button>
                  <Button variant="ghost" className="h-11" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button className="h-11 flex-1" variant={curDecision.status === "pending" ? "default" : "outline"} aria-pressed={curDecision.status === "accepted"} onClick={() => decide(cur, { status: "accepted", edited: curDecision.edited })}>
                    <CheckIcon data-icon="inline-start" /> Aceptar <Kbd>A</Kbd>
                  </Button>
                  <Button className="h-11 flex-1" variant="outline" aria-pressed={curDecision.status === "rejected"} onClick={() => decide(cur, { status: "rejected" })}>
                    <XIcon data-icon="inline-start" /> Rechazar <Kbd>R</Kbd>
                  </Button>
                  {cur.kind !== "quitar" && (
                    <Button className="h-11 flex-1" variant="ghost" onClick={startEdit}>
                      <PencilIcon data-icon="inline-start" /> Editar <Kbd>E</Kbd>
                    </Button>
                  )}
                </div>
                {curDecision.status === "rejected" && (
                  <Input
                    className="h-11"
                    aria-label="Motivo del rechazo (opcional)"
                    placeholder="¿Por qué lo rechazas? (opcional; ayuda a aprender tus preferencias)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    onBlur={() => reason.trim() && cur && remember(value!.inputKey, offer, cur, curDecision, reason.trim())}
                  />
                )}
              </div>
            )}
          </article>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="size-11" aria-label="Cambio anterior" disabled={idx <= 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
                <ArrowLeftIcon aria-hidden />
              </Button>
              <Button variant="ghost" size="icon" className="size-11" aria-label="Cambio siguiente" disabled={idx >= queue.length - 1} onClick={() => setIdx((i) => Math.min(queue.length - 1, i + 1))}>
                <ArrowRightIcon aria-hidden />
              </Button>
            </div>
            <p className="flex items-center gap-1">
              Atajos: <Kbd>A</Kbd> <Kbd>R</Kbd> <Kbd>E</Kbd> <Kbd>←</Kbd> <Kbd>→</Kbd>
            </p>
          </div>
          {pending === 0 && <p className="text-sm text-muted-foreground">Ya decidiste todos los cambios. Continúa cuando quieras.</p>}
          <Button variant="ghost" className="h-11 self-start" onClick={generate}>
            <RefreshCwIcon data-icon="inline-start" /> Volver a proponer
          </Button>
        </>
      )}

      {fresh && unchanged.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group flex min-h-11 items-center gap-1 text-sm font-medium text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Se conservan sin cambios ({unchanged.length})
            <ChevronDownIcon className="size-4 transition-transform group-data-panel-open:rotate-180" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="flex flex-col gap-3 pt-2 text-sm">
              {unchanged.map((it) => (
                <li key={it.id} className="flex flex-col gap-1">
                  <span className="font-medium">{it.label}</span>
                  <span className="text-muted-foreground">{it.original}</span>
                  {it.reasons && <span className="text-xs text-destructive">Descartado: {it.reasons.join(" ")}</span>}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
