"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import { useAiWork } from "@/components/ai/ai-work"
import { StatusLine } from "@/components/ai/status-line"
import { GlassPanel } from "@/components/glass-panel"
import { StepHeader } from "@/components/wizard/step-header"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { computeFit, type JudgedCriterion } from "@/lib/analysis/fit"
import { DIMENSIONS, levelOf, type DimensionResult, type Finding } from "@/lib/analysis/rubric"
import type { MatchResult } from "@/lib/match/types"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"
import { cn } from "@/lib/utils"

export type MatchState = { key: string; result: MatchResult; /** segundos que tardó la comparación */ seconds?: number; /** veredictos opcionales del juez local */ judged?: JudgedCriterion[] }

/** El resultado solo vale para este CV y esta oferta: si cambia alguno, se recalcula. */
export const matchKey = (cv: CV, offer: Offer) => JSON.stringify([cv, offer])
export const matchReady = (m: MatchState | null, cv: CV | null, offer: Offer | null) => !!m && !!cv && !!offer && m.key === matchKey(cv, offer)

const LEVEL_LABEL = { fuerte: "Fuerte", aceptable: "Aceptable", debil: "Débil", ausente: "Sin evidencia" } as const
const VERDICT_LABEL: Record<Finding["verdict"], string> = { cumple: "Cumple", parcial: "Parcial", "no-cumple": "No cumple", "no-aplica": "No evaluado" }
const CRITERION = new Map(DIMENSIONS.flatMap((d) => d.criteria.map((c) => [c.id, c.label] as const)))

function Empty({ text }: { text: string }) {
  return <StepHeader title="Qué tanto encaja" description={text} />
}

/** Línea de tiempo del análisis (UI v2, patrón f): puntos pequeños unidos por un conector fino; el paso activo con más contraste. */
function Timeline({ steps }: { steps: { label: string; state: "done" | "active" | "todo" }[] }) {
  return (
    <GlassPanel className="p-4">
      <ol className="flex flex-col" aria-label="Etapas del análisis">
        {steps.map((s, i) => (
          <li key={s.label} aria-current={s.state === "active" ? "step" : undefined} className="relative flex gap-3 pb-3 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className="absolute top-3 left-1 h-full w-px bg-border" />}
            <span aria-hidden className={cn("relative mt-1.5 size-2 shrink-0 rounded-full", s.state === "done" ? "bg-muted-foreground/60" : s.state === "active" ? "bg-foreground" : "bg-border")} />
            <span className={cn("text-sm", s.state === "active" ? "font-medium text-foreground" : s.state === "done" ? "text-muted-foreground" : "text-muted-foreground/60")}>{s.label}</span>
          </li>
        ))}
      </ol>
    </GlassPanel>
  )
}

function Dimension({ d }: { d: DimensionResult }) {
  const meta = DIMENSIONS.find((x) => x.id === d.id)!
  const lvl = d.applicable ? LEVEL_LABEL[levelOf(d.score)] : "No aplica a esta oferta"
  const shown = d.findings.filter((f) => f.verdict !== "no-aplica")
  const lead = shown.find((f) => f.verdict !== "cumple") ?? shown[0]
  return (
    <li className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <Collapsible>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium">{meta.label}</h3>
          <span className="text-xs text-muted-foreground">{lvl}</span>
        </div>
        {d.applicable && <Progress value={d.score} aria-label={`${meta.label}: ${d.score} de 100`} className="mt-1.5" />}
        {lead && <p className="mt-1.5 text-xs text-muted-foreground">{lead.note}</p>}
        {shown.length > 0 && (
          <>
            <CollapsibleTrigger className="group mt-1 flex min-h-9 items-center gap-1 text-xs text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              Ver el detalle
              <ChevronDownIcon className="size-3.5 transition-transform group-data-panel-open:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="flex flex-col gap-2.5 pt-1">
                {shown.map((f) => (
                  <li key={f.criterion} className="flex flex-col gap-0.5 text-xs">
                    <span className="font-medium">
                      {CRITERION.get(f.criterion) ?? f.criterion} · <span className="font-normal text-muted-foreground">{VERDICT_LABEL[f.verdict]}</span>
                    </span>
                    <span className="text-muted-foreground">{f.note}</span>
                    {f.evidence && f.basis === "cita" && <span className="border-l border-border pl-2 text-muted-foreground">«{f.evidence}»</span>}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </>
        )}
      </Collapsible>
    </li>
  )
}

export function StepAnalysis({ cv, offer, cvLanguage, value, onChange }: { cv: CV | null; offer: Offer | null; cvLanguage?: "es" | "en" | "otro"; value: MatchState | null; onChange: (v: MatchState | null) => void }) {
  const [error, setError] = useState("")
  const [judging, setJudging] = useState(false)
  const [judgeNote, setJudgeNote] = useState("")
  const ai = useAiWork()
  const started = useRef<string | null>(null)

  const fresh = matchReady(value, cv, offer)
  const key = cv && offer ? matchKey(cv, offer) : null

  const run = async () => {
    if (!cv || !offer || !key) return
    const ctrl = new AbortController()
    const t0 = Date.now()
    setError("")
    // Comparar es una llamada a embeddings + juicio del modelo: un único mensaje honesto.
    ai.start(["Cruzando tu CV con la oferta"], () => ctrl.abort())
    try {
      const res = await fetch("/api/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cv, offer, cvLanguage }), signal: ctrl.signal })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "No se pudo comparar tu CV con la oferta.")
      onChange({ key, result: json as MatchResult, seconds: Math.max(1, Math.round((Date.now() - t0) / 1000)) })
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

  const fit = useMemo(() => (cv && offer && value && fresh ? computeFit(cv, offer, { match: value.result, judged: value.judged }) : null), [cv, offer, value, fresh])

  const deepen = async () => {
    if (!cv || !offer || !value) return
    const ctrl = new AbortController()
    setJudging(true)
    setJudgeNote("")
    ai.start(["Evaluando el resumen y los logros"], () => ctrl.abort())
    try {
      const res = await fetch("/api/judge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cv, offer }), signal: ctrl.signal })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "No se pudo evaluar con el modelo.")
      onChange({ ...value, judged: json.judged as JudgedCriterion[] })
    } catch (e) {
      if ((e as Error).name !== "AbortError") setJudgeNote((e as Error).message)
    } finally {
      ai.stop()
      setJudging(false)
    }
  }

  if (!cv) return <Empty text="Falta tu perfil: vuelve al primer paso y sube tu CV para poder compararlo." />
  if (!offer) return <Empty text="Falta la oferta: vuelve al paso anterior, pégala y analízala para ver qué tanto encaja tu CV." />

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <StepHeader title="Qué tanto encaja" />
        <p role="alert" className="text-sm whitespace-pre-line text-destructive">
          No pudimos comparar tu CV. {error}
        </p>
        <Button className="self-start" onClick={() => void run()}>
          Reintentar
        </Button>
      </div>
    )
  }

  const nTerms = fit?.coverage.length ?? 0
  const running = !fresh || !value
  const steps = [
    { label: `CV leído: ${cv.experience.length} ${cv.experience.length === 1 ? "puesto" : "puestos"}`, state: "done" as const },
    { label: `Oferta leída: ${offer.requirements.length} requisitos, ${offer.niceToHave.length} deseables`, state: "done" as const },
    { label: running ? "Cruzando requisitos con tu CV, por palabras y por significado" : `${nTerms} requisitos cruzados con tu CV`, state: running ? ("active" as const) : ("done" as const) },
    { label: running ? "Calculando la ficha" : "Ficha de 9 dimensiones lista", state: running ? ("todo" as const) : ("done" as const) },
  ]

  return (
    <div className="flex flex-col gap-5">
      <StepHeader title="Qué tanto encaja" description={running ? "Comparando lo que dice tu CV con lo que pide la oferta." : "Así queda tu CV frente a esta oferta, dimensión por dimensión."} />
      <StatusLine running={running} step={running ? 0 : 1} text={running ? "Analizando tu CV frente a la oferta…" : `Listo en ${value!.seconds ?? 1} s · ${nTerms} requisitos cruzados`} />
      <Timeline steps={steps} />

      {fit && value && (
        <>
          <section aria-labelledby="ficha" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="ficha" className="text-base font-medium">
                Ficha del CV
              </h2>
              <span className="text-xs text-muted-foreground">Resumen: {fit.overall} de 100</span>
            </div>
            <ul className="flex flex-col divide-y divide-border/40">
              {fit.scorecard.dimensions.map((d) => (
                <Dimension key={d.id} d={d} />
              ))}
            </ul>
          </section>

          {fit.gaps.length > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">No está en tu CV: </span>
              {fit.gaps
                .slice(0, 8)
                .map((g) => g.label)
                .join(", ")}
              . No se agregará ni se inventará nada; en la revisión podrás indicar si de verdad lo tienes.
            </p>
          )}

          {!value.judged && (
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" className="self-start" disabled={judging} onClick={() => void deepen()}>
                Profundizar con IA
              </Button>
              <p className="text-xs text-muted-foreground">Evalúa el resumen, los logros y las habilidades transversales con el modelo local (puede tardar hasta un minuto). La ficha ya es válida sin esto.</p>
            </div>
          )}
          {judgeNote && (
            <p role="alert" className="text-xs text-destructive">
              {judgeNote}
            </p>
          )}
          {fit.warnings.map((w) => (
            <p key={w} className="text-xs text-muted-foreground">
              {w}
            </p>
          ))}
          {value.result.warnings.map((w) => (
            <p key={w} className="text-xs text-muted-foreground">
              Comparación limitada: {w}
            </p>
          ))}
        </>
      )}
    </div>
  )
}
