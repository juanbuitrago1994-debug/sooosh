"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ChevronDownIcon, PencilIcon, RefreshCwIcon, SparklesIcon, XIcon } from "lucide-react"
import { useAiWork } from "@/components/ai/ai-work"
import { StepHeader } from "@/components/wizard/step-header"
import { GlassPanel } from "@/components/glass-panel"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Textarea } from "@/components/ui/textarea"
import { wordDiff } from "@/lib/rewrite/diff"
import { proposeExtras } from "@/lib/rewrite/extras"
import type { ChangeType } from "@/lib/rewrite/groups"
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

function EmptyState({ text }: { text: string }) {
  return <StepHeader title="Revisa los cambios" description={text} />
}

function OllamaHelp() {
  const code = "font-mono text-xs"
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
const TYPE_LABEL: Record<ChangeType, string> = {
  resumen: "Resumen",
  "viñeta": "Viñeta",
  "quitar-relleno": "Quitar relleno",
  habilidad: "Habilidad",
  "reordenar-habilidades": "Reordenar habilidades",
  "reordenar-viñetas": "Reordenar viñetas",
  "reordenar-secciones": "Reordenar secciones",
  titular: "Titular",
  brecha: "Falta en tu CV",
}
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`

/** Efecto estimado de aplicar solo este cambio, con el mismo motor de la ficha. */
function impactText(it: RewriteItem): string {
  const o = it.impact?.overall
  if (o === undefined) return ""
  if (it.type === "brecha") return o > 0 ? `Si de verdad lo tienes, el encaje con la oferta subiría ${signed(o)}.` : "Si de verdad lo tienes, ayuda a que lo vean; no cambia el encaje de forma medible."
  if (o !== 0) return `Efecto estimado en el encaje con la oferta: ${signed(o)}.`
  return it.type?.startsWith("reordenar") ? "Mejora la lectura rápida; no cambia la ficha." : "Sin efecto medible en la ficha."
}
const canEdit = (it: RewriteItem) => it.kind !== "quitar" && it.type !== "brecha" && !it.op?.type.startsWith("reorder")

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
  if (item.type === "brecha") return <p className="text-sm">{item.question}</p>
  if (item.op && item.op.type !== "headline") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-medium text-muted-foreground">Ahora</h3>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{item.original}</p>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-medium text-muted-foreground">Propuesta</h3>
          <p className="text-sm whitespace-pre-line">{item.proposed}</p>
        </div>
      </div>
    )
  }
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
  const [gapAnswer, setGapAnswer] = useState("")
  const [note, setNote] = useState("")
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
      if (k === "a") {
        if (cur.type !== "brecha") decide(cur, { status: "accepted", edited: curDecision.edited })
      }
      else if (k === "r") decide(cur, { status: "rejected" })
      else if (k === "e" && canEdit(cur)) startEdit()
      else if (e.key === "ArrowRight") setIdx((i) => Math.min(queue.length - 1, i + 1))
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1))
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, curDecision, queue, decide])

  if (!cv) return <EmptyState text="Falta tu perfil: vuelve al primer paso y sube tu CV." />
  if (!offer) return <EmptyState text="Falta la oferta: vuelve al paso de la oferta, pégala y analízala." />

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
      // Cambios deterministas con evidencia exacta (quitar relleno, añadir habilidades ya demostradas, reordenar, titular, brechas),
      // cada uno con su efecto recalculado en la ficha. Si falla, se usan solo los básicos.
      let all: RewriteItem[] = [...items, ...proposeExtras(cv, match, guard ?? undefined)]
      try {
        const res = await fetch("/api/changes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cv, offer, items }), signal: ctrl.signal })
        if (res.ok) all = ((await res.json()) as { items: RewriteItem[] }).items
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e
      }
      items.length = 0
      items.push(...all)
      setIdx(0)
      onChange({ inputKey: reviewKey(cv, offer), items, decisions: {} })
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError({ message: (e as Error).message, code: (e as { code?: string }).code })
    } finally {
      ai.stop()
    }
  }

  /** Ciclo de calidad opcional (K6): regenera solo las propuestas que no mejoran la ficha. */
  const improve = async () => {
    if (!value || !offer || !cv) return
    const ctrl = new AbortController()
    setNote("")
    const todo = weak
    ai.start(todo.map((w) => `Mejorando: ${w.label.split(" — ")[0]}`), () => ctrl.abort())
    let items = value.items
    try {
      for (let i = 0; i < todo.length; i++) {
        ai.advance(i)
        const res = await fetch("/api/improve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cv, offer, item: todo[i], source: guard ?? undefined }), signal: ctrl.signal })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? "No se pudo mejorar la propuesta.")
        items = items.map((it) => (it.id === todo[i].id ? (json.item as RewriteItem) : it))
        onChange({ ...value, items })
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote((e as Error).message)
    } finally {
      ai.stop()
    }
  }

  const approveLowRisk = () => {
    if (!value) return
    const next = { ...value.decisions }
    for (const it of queue) {
      if (statusOf(it.id) === "pending" && it.risk === "bajo" && it.type !== "brecha") {
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
  const lowPending = queue.filter((i) => statusOf(i.id) === "pending" && i.risk === "bajo" && i.type !== "brecha").length
  const weak = queue.filter((i) => (i.type === "resumen" || i.type === "viñeta") && (i.impact?.overall ?? 1) <= 0 && statusOf(i.id) === "pending")
  const needsHelp = error && ["unreachable", "model_missing", "not_configured", "timeout"].includes(error.code ?? "")
  const text = cur ? curDecision.edited ?? cur.proposed : ""

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        title="Revisa los cambios"
        description="Cada cambio usa solo lo que ya dices en tu CV, cita la evidencia y muestra cuánto mejora el encaje. Decides uno a uno; solo lo que aceptes entra en tu CV final."
      />

      {error && (
        <div role="alert" className="flex flex-col gap-1 text-sm text-destructive">
          <p className="font-medium">{needsHelp ? "No pudimos usar el modelo local" : "No pudimos reescribir tu CV"}</p>
          <div className="whitespace-pre-line">{error.message}</div>
          {needsHelp && <OllamaHelp />}
        </div>
      )}
      {value && !fresh && <p className="text-sm text-muted-foreground">Tu CV o la oferta cambiaron: las propuestas anteriores ya no corresponden. Vuelve a generarlas.</p>}

      {!fresh && (
        <Button className="self-start" onClick={generate}>
          {error ? <RefreshCwIcon data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
          {error ? "Reintentar" : "Proponer cambios para esta oferta"}
        </Button>
      )}

      {fresh && queue.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin cambios que proponer: tu CV ya dice lo que la oferta pide con tus propias palabras, o el modelo solo habría inventado. Puedes continuar tal cual.</p>
      )}

      {fresh && queue.length > 0 && cur && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Cambio {Math.min(idx, queue.length - 1) + 1} de {queue.length} · {accepted} {accepted === 1 ? "aceptado" : "aceptados"} · {rejected} {rejected === 1 ? "rechazado" : "rechazados"} · {pending} {pending === 1 ? "pendiente" : "pendientes"}
            </p>
            <div className="flex flex-wrap gap-2">
              {weak.length > 0 && (
                <Button variant="ghost" className="text-muted-foreground" onClick={() => void improve()}>
                  Mejorar {weak.length} {weak.length === 1 ? "propuesta débil" : "propuestas débiles"}
                </Button>
              )}
              {lowPending > 0 && (
                <Button variant="secondary" onClick={approveLowRisk}>
                  Aprobar los {lowPending} de bajo riesgo
                </Button>
              )}
            </div>
          </div>
          {note && (
            <p role="alert" className="text-xs text-destructive">
              {note}
            </p>
          )}

          <GlassPanel className="flex flex-col gap-4 p-4" aria-labelledby="cambio-actual" role="group">
            <div className="flex flex-col gap-1">
              <h2 id="cambio-actual" className="text-sm font-medium">
                {cur.label}
              </h2>
              <p className="text-xs text-muted-foreground">
                {cur.type ? TYPE_LABEL[cur.type] : KIND[cur.kind ?? "cambiar"]}
                {cur.risk && ` · Riesgo ${cur.risk}`}
                {curDecision.status !== "pending" && ` · ${curDecision.status === "accepted" ? (curDecision.edited !== undefined ? "Editado" : "Aceptado") : "Rechazado"}`}
              </p>
            </div>

            <ChangeBody item={cur} text={text} />

            {impactText(cur) && <p className="text-xs text-muted-foreground">{impactText(cur)}</p>}
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
                    <li key={e} className="border-l border-border pl-3 text-sm text-muted-foreground">
                      «{e}»
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {cur.type === "brecha" ? (
              <div className="flex flex-col gap-2">
                <Input aria-label={`Tu experiencia con ${cur.label.replace("Falta: ", "")}`} placeholder="Escríbelo como lo usaste (por ejemplo: «Python con pandas para limpiar datos de ventas»)" value={gapAnswer} onChange={(e) => setGapAnswer(e.target.value)} />
                <div className="flex gap-2">
                  <Button
                    disabled={!gapAnswer.trim()}
                    onClick={() => {
                      decide(cur, { status: "accepted", edited: gapAnswer.trim() })
                      setGapAnswer("")
                    }}
                  >
                    <CheckIcon data-icon="inline-start" /> Sí, lo tengo
                  </Button>
                  <Button variant="outline" onClick={() => decide(cur, { status: "rejected" })}>
                    <XIcon data-icon="inline-start" /> No lo tengo
                  </Button>
                </div>
              </div>
            ) : editing ? (
              <div className="flex flex-col gap-2">
                <Field data-invalid={!!draftError}>
                  <Textarea rows={4} value={draft} aria-label={`Editar: ${cur.label}`} aria-invalid={!!draftError} onChange={(e) => setDraft(e.target.value)} />
                  {draftError && <FieldError>{draftError}</FieldError>}
                </Field>
                <div className="flex gap-2">
                  <Button onClick={saveEdit}>Guardar edición</Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button variant={curDecision.status === "pending" ? "default" : "outline"} aria-pressed={curDecision.status === "accepted"} onClick={() => decide(cur, { status: "accepted", edited: curDecision.edited })}>
                    <CheckIcon data-icon="inline-start" /> Aceptar <Kbd>A</Kbd>
                  </Button>
                  <Button variant="outline" aria-pressed={curDecision.status === "rejected"} onClick={() => decide(cur, { status: "rejected" })}>
                    <XIcon data-icon="inline-start" /> Rechazar <Kbd>R</Kbd>
                  </Button>
                  {canEdit(cur) && (
                    <Button variant="ghost" onClick={startEdit}>
                      <PencilIcon data-icon="inline-start" /> Editar <Kbd>E</Kbd>
                    </Button>
                  )}
                </div>
                {curDecision.status === "rejected" && (
                  <Input
                    aria-label="Motivo del rechazo (opcional)"
                    placeholder="¿Por qué lo rechazas? (opcional; ayuda a aprender tus preferencias)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    onBlur={() => reason.trim() && cur && remember(value!.inputKey, offer, cur, curDecision, reason.trim())}
                  />
                )}
              </div>
            )}
          </GlassPanel>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" aria-label="Cambio anterior" disabled={idx <= 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
                <ArrowLeftIcon aria-hidden />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Cambio siguiente" disabled={idx >= queue.length - 1} onClick={() => setIdx((i) => Math.min(queue.length - 1, i + 1))}>
                <ArrowRightIcon aria-hidden />
              </Button>
            </div>
            <p className="flex items-center gap-1">
              Atajos: <Kbd>A</Kbd> <Kbd>R</Kbd> <Kbd>E</Kbd> <Kbd>←</Kbd> <Kbd>→</Kbd>
            </p>
          </div>
          {pending === 0 && <p className="text-sm text-muted-foreground">Ya decidiste todos los cambios. Continúa cuando quieras.</p>}
          <Button variant="ghost" className="self-start text-muted-foreground" onClick={generate}>
            <RefreshCwIcon data-icon="inline-start" /> Volver a proponer
          </Button>
        </>
      )}

      {fresh && unchanged.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
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
