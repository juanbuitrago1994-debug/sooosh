"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircleIcon, ChevronDownIcon, FileSearchIcon, InfoIcon, UserRoundIcon } from "lucide-react"
import { useAiWork } from "@/components/ai/ai-work"
import { StepHeader } from "@/components/wizard/step-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { KIND_LABEL } from "@/lib/match/terms"
import type { MatchResult, TermMatch } from "@/lib/match/types"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"

export type MatchState = { key: string; result: MatchResult }

/** El resultado solo vale para este CV y esta oferta: si cambia alguno, se recalcula. */
export const matchKey = (cv: CV, offer: Offer) => JSON.stringify([cv, offer])
export const matchReady = (m: MatchState | null, cv: CV | null, offer: Offer | null) => !!m && !!cv && !!offer && m.key === matchKey(cv, offer)

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col gap-5">
      <StepHeader title="Qué tanto encaja" />
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

const level = (p: number) => (p >= 70 ? "Buena cobertura" : p >= 40 ? "Cobertura media" : "Cobertura baja")

function Rows({ items }: { items: TermMatch[] }) {
  return (
    <ul className="flex flex-col divide-y">
      {items.map((m) => (
        <li key={m.term.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{m.term.text}</span>
            <Badge variant="outline">{KIND_LABEL[m.term.kind]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{m.explanation}</p>
        </li>
      ))}
    </ul>
  )
}

export function StepAnalysis({
  cv,
  offer,
  cvLanguage,
  value,
  onChange,
}: {
  cv: CV | null
  offer: Offer | null
  cvLanguage?: "es" | "en" | "otro"
  value: MatchState | null
  onChange: (v: MatchState | null) => void
}) {
  const [error, setError] = useState("")
  const ai = useAiWork()
  const started = useRef<string | null>(null)

  const fresh = matchReady(value, cv, offer)
  const key = cv && offer ? matchKey(cv, offer) : null

  const run = async () => {
    if (!cv || !offer || !key) return
    const ctrl = new AbortController()
    setError("")
    // Comparar es una llamada a embeddings + juicio del modelo: un único mensaje honesto.
    ai.start(["Comparando tu CV con la oferta"], () => ctrl.abort())
    try {
      const res = await fetch("/api/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cv, offer, cvLanguage }), signal: ctrl.signal })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "No se pudo comparar tu CV con la oferta.")
      onChange({ key, result: json as MatchResult })
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message)
    } finally {
      ai.stop()
    }
  }

  // Cero entradas del usuario: el análisis arranca solo al llegar a este paso (una vez por CV+oferta).
  useEffect(() => {
    if (key && !fresh && started.current !== key) {
      started.current = key
      void run()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fresh])

  if (!cv) return <EmptyState icon={<UserRoundIcon />} title="Falta tu perfil" text="Vuelve al primer paso y sube tu CV para poder compararlo." />
  if (!offer) return <EmptyState icon={<FileSearchIcon />} title="Falta la oferta" text="Vuelve al paso anterior, pégala y analízala para ver qué tanto encaja tu CV." />

  if (error) {
    return (
      <div className="flex flex-col gap-5">
        <StepHeader title="Qué tanto encaja" />
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>No pudimos comparar tu CV</AlertTitle>
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
        <Button className="h-11" onClick={() => void run()}>
          Reintentar
        </Button>
      </div>
    )
  }

  if (!fresh || !value) {
    return (
      <div className="flex flex-col gap-5">
        <StepHeader title="Qué tanto encaja" description="Comparando lo que dice tu CV con lo que pide la oferta." />
        <div className="h-24" aria-hidden />
      </div>
    )
  }

  const r = value.result
  const { fit, reformulable, gaps } = r.groups
  if (r.terms.length === 0) {
    return <EmptyState icon={<FileSearchIcon />} title="No encontramos requisitos" text="La oferta no tiene requisitos ni funciones detectables. Revisa el texto en el paso anterior." />
  }

  return (
    <div className="flex flex-col gap-5">
      <StepHeader title="Qué tanto encaja" description={`${fit.length} de ${r.terms.length} puntos de la oferta ya tienen respaldo en tu CV.`} />

      <div className="flex items-baseline gap-3">
        <span className="font-heading text-5xl font-medium">{r.coverage}%</span>
        <span className="text-sm text-muted-foreground">{level(r.coverage)}</span>
      </div>

      {r.warnings.map((w) => (
        <Alert key={w}>
          <InfoIcon />
          <AlertTitle>Comparación limitada</AlertTitle>
          <AlertDescription>{w}</AlertDescription>
        </Alert>
      ))}

      {gaps.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="brechas">
          <div className="flex flex-col gap-1">
            <h2 id="brechas" className="text-sm font-medium">
              No está en tu CV ({gaps.length})
            </h2>
            <p className="text-xs text-muted-foreground">Son brechas reales: no se agregarán ni se inventarán. Si de verdad lo tienes, añádelo con «Corregir» en el primer paso.</p>
          </div>
          <Rows items={gaps} />
        </section>
      )}

      {reformulable.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="reformulable">
          <div className="flex flex-col gap-1">
            <h2 id="reformulable" className="text-sm font-medium">
              Se puede reformular con lo que ya dices ({reformulable.length})
            </h2>
            <p className="text-xs text-muted-foreground">Hay evidencia en tu CV; en la revisión propondremos palabras más cercanas a la oferta.</p>
          </div>
          <Rows items={reformulable} />
        </section>
      )}

      {fit.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group flex min-h-11 items-center gap-1 text-sm font-medium text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Ya encaja ({fit.length})
            <ChevronDownIcon className="size-4 transition-transform group-data-panel-open:rotate-180" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <Rows items={fit} />
          </CollapsibleContent>
        </Collapsible>
      )}

      <p className="text-xs text-muted-foreground">
        {r.method === "semantico" ? `Comparado por significado (modelo ${r.model}) y por palabras; entre idiomas también.` : "Comparado solo por palabras."} Lo obligatorio pesa más que lo deseable.
      </p>
    </div>
  )
}
