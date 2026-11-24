"use client"

import { useEffect, useRef, useState } from "react"
import { CheckIcon, CircleAlertIcon, CircleIcon, DownloadIcon, FileTextIcon } from "lucide-react"
import { toast } from "sonner"
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle, AttachmentTrigger } from "@/components/ui/attachment"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace"
import { nextProgress, stageFloor } from "@/lib/cv/progress"
import { setAtsStatus } from "@/lib/profile/search-profile"
import { ATS_STAGES, generateAtsClient, saveBlob, verifyAtsClient, type AtsBundle } from "@/lib/ats/client"
import type { VerifyView } from "@/lib/ats/verify"
import type { CV } from "@/lib/schemas/cv"

/**
 * Versión ATS del CV de la persona: se genera (avance real por etapas), se descarga en PDF y Word y se verifica. La verificación muestra
 * una marca «Validado» y las reglas AGRUPADAS por tema, sin el detalle de cada una (pedido de Juan, 23-nov-2026).
 */
type Phase =
  | { k: "idle" }
  | { k: "working"; stage: number }
  | { k: "ready"; bundle: AtsBundle }
  | { k: "verifying"; bundle: AtsBundle }
  | { k: "verified"; bundle: AtsBundle; view: VerifyView }
  | { k: "error"; message: string }

const pagesText = (n: number) => `${n} ${n === 1 ? "página" : "páginas"}`

export function AtsVersion({ cv, sourceText, onWorkingChange }: { cv: CV; /** texto original del CV, para releerlo a fondo */ sourceText?: string; /** avisa cuando empieza y termina la generación, para que el panel oculte lo de arriba */ onWorkingChange?: (working: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>({ k: "idle" })
  const abort = useRef<AbortController | null>(null)
  // La lectura a fondo es la parte lenta: se hace una vez por CV y «Generar de nuevo» la reutiliza.
  const extras = useRef<AtsBundle["extras"]>(null)
  const hasSummary = !!cv.summary?.trim()

  useEffect(() => () => abort.current?.abort(), [])
  const working = phase.k === "working"
  useEffect(() => {
    onWorkingChange?.(working)
    return () => onWorkingChange?.(false)
  }, [working, onWorkingChange])

  const generate = async () => {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setPhase({ k: "working", stage: 0 })
    try {
      const bundle = await generateAtsClient(cv, sourceText, (i) => setPhase({ k: "working", stage: i }), ctl.signal, extras.current)
      if (ctl.signal.aborted) return
      extras.current = bundle.extras
      setAtsStatus({ at: new Date().toISOString() })
      setPhase({ k: "ready", bundle })
    } catch (e) {
      if (!ctl.signal.aborted) setPhase({ k: "error", message: (e as Error).message })
    }
  }

  const verify = async (bundle: AtsBundle) => {
    const ctl = new AbortController()
    abort.current = ctl
    setPhase({ k: "verifying", bundle })
    try {
      const view = await verifyAtsClient(cv, sourceText, bundle, ctl.signal)
      if (!ctl.signal.aborted) {
        setPhase({ k: "verified", bundle, view })
        setAtsStatus({ at: new Date().toISOString(), validated: view.validated })
      }
    } catch (e) {
      if (ctl.signal.aborted) return
      toast.error((e as Error).message)
      setPhase({ k: "ready", bundle })
    }
  }

  const stageLabels = ATS_STAGES.map((l, i) => (i === 1 && hasSummary ? "Conservando tu resumen" : l))

  const bundle = "bundle" in phase ? phase.bundle : null
  const files = bundle && (
    <div className="flex flex-col gap-2">
      {([["PDF", bundle.pdf, `${pagesText(bundle.pages)}`], ["Word", bundle.docx, "Documento .docx"]] as const).map(([kind, f, note]) => (
        <Attachment key={kind} state="done" className="w-full">
          <AttachmentTrigger aria-label={`Descargar ${kind}`} onClick={() => saveBlob(f.blob, f.name)} />
          <AttachmentMedia>
            <FileTextIcon />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{f.name}</AttachmentTitle>
            <AttachmentDescription>
              {kind} · {note}
            </AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <span aria-hidden className="grid size-6 place-items-center">
              <DownloadIcon className="size-4" />
            </span>
          </AttachmentActions>
        </Attachment>
      ))}
    </div>
  )

  return (
    <section aria-labelledby="ats-title" className={working ? "flex min-h-0 flex-1 flex-col items-center justify-center gap-6" : "flex flex-col gap-6"}>
      {/* Mientras se genera, solo los pasos y el porcentaje, centrados: el título y la descripción se ocultan. */}
      <div className={working ? "sr-only" : "flex flex-col gap-2"}>
        <h3 id="ats-title" className="text-sm font-medium">
          Versión ATS
        </h3>
        <p className="text-xs text-muted-foreground">Una copia de tu CV en un formato que los filtros de selección leen sin errores. Usa solo lo que ya dice tu CV, en PDF y en Word.</p>
      </div>

      {phase.k === "idle" && (
        <Button className="self-start" onClick={() => void generate()}>
          Generar versión ATS
        </Button>
      )}

      {phase.k === "working" && (
        // Pasos reales del proceso (Trace de shadcn): hechos con ✓, el actual con brillo y spinner, los siguientes atenuados.
        <div className="flex flex-col items-center gap-6">
        <AtsPercent stage={phase.stage} />
        <Trace role="status" aria-live="polite" className="w-fit">
          {stageLabels.map((label, i) => {
            const done = i < phase.stage || (i === 1 && hasSummary && phase.stage >= 1)
            const current = i === phase.stage && !(i === 1 && hasSummary)
            return (
              <TraceLine key={label} status={current ? "running" : done ? undefined : "pending"} aria-current={current ? "step" : undefined}>
                <TraceIcon>{done ? <CheckIcon /> : current ? <Spinner /> : <CircleIcon />}</TraceIcon>
                <TraceTitle>{label}</TraceTitle>
              </TraceLine>
            )
          })}
        </Trace>
        </div>
      )}

      {phase.k === "error" && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">
            {phase.message}
          </p>
          <Button className="self-start" variant="outline" onClick={() => void generate()}>
            Intentar de nuevo
          </Button>
        </div>
      )}

      {bundle && (phase.k === "ready" || phase.k === "verifying" || phase.k === "verified") && (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Tu versión ATS está lista</p>
            {bundle.summary && <p className="text-xs text-muted-foreground">El resumen lo propuso la IA local a partir de tu CV: revísalo antes de enviarlo.</p>}
            {!bundle.summary && !bundle.summaryFromCv && bundle.summaryReason && <p className="text-xs text-muted-foreground">Tu CV no traía resumen y no se pudo redactar uno sin inventar datos: esa sección no aparece.</p>}
            {bundle.warnings.map((w) => (
              <p key={w} className="text-xs text-muted-foreground">
                {w}
              </p>
            ))}
          </div>

          {phase.k === "verified" ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={phase.view.validated ? "default" : "outline"}>
                    {phase.view.validated ? <CheckIcon data-icon="inline-start" /> : <CircleAlertIcon data-icon="inline-start" />}
                    {phase.view.validated ? "Validado" : phase.view.labelText}
                  </Badge>
                  <span className="text-sm font-medium tabular-nums">{phase.view.percent} %</span>
                </div>
                {phase.view.readRate != null && <p className="text-xs text-muted-foreground">Un lector automático recupera el {phase.view.readRate} % del contenido del archivo.</p>}
                <p className="text-xs text-muted-foreground">{phase.view.disclaimer}</p>
              </div>
              <ul className="flex flex-col gap-2 text-sm">
                {phase.view.groups.map((g) => (
                  <li key={g.group} className="flex items-center gap-2">
                    {g.status === "ok" ? <CheckIcon className="size-4 shrink-0" /> : <CircleAlertIcon className="size-4 shrink-0 text-destructive" />}
                    <span>{g.label}</span>
                    {g.status === "revisar" && <span className="text-xs text-muted-foreground">· por revisar</span>}
                  </li>
                ))}
              </ul>
              {phase.view.tips.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Consejos para tu CV</p>
                  <p className="text-xs text-muted-foreground">Dependen de lo que escribiste, no del formato; no restan del porcentaje.</p>
                  <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
                    {phase.view.tips.map((t) => (
                      <li key={t.id}>{t.fix}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          {files}

          <div className="flex flex-wrap gap-2">
            {phase.k !== "verified" && (
              <Button disabled={phase.k === "verifying"} onClick={() => void verify(bundle)}>
                {phase.k === "verifying" && <Spinner data-icon="inline-start" />}
                {phase.k === "verifying" ? "Verificando…" : "Verificar"}
              </Button>
            )}
            <Button variant="ghost" className="text-muted-foreground" disabled={phase.k === "verifying"} onClick={() => void generate()}>
              Generar de nuevo
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

/**
 * Porcentaje de la generación (ver `lib/cv/progress.ts`): el piso es lo completado (etapas terminadas ÷ 3) y dentro de la etapa actual
 * avanza suave hacia el techo de la siguiente sin alcanzarlo; nunca marca 100 % antes de terminar. La primera etapa (leer a fondo el CV) es la
 * lenta y no avisa cuánto lleva: tardó 160–220 s en las mediciones de A5 (`docs/BENCHMARKS.md`), así que ahí el avance es muy gradual.
 */
function AtsPercent({ stage }: { stage: number }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const rate = stage === 0 ? 0.004 : 0.03
    const t = setInterval(() => setValue((v) => nextProgress(v, stage, rate, ATS_STAGES.length)), 150)
    return () => clearInterval(t)
  }, [stage])
  const shown = Math.max(Math.floor(value), stageFloor(stage, ATS_STAGES.length))
  return (
    <span role="progressbar" aria-label="Avance de la versión ATS" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shown} className="text-sm text-muted-foreground tabular-nums">
      {shown} %
    </span>
  )
}
