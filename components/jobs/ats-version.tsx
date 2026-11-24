"use client"

import { useEffect, useRef, useState } from "react"
import { CheckIcon, CircleAlertIcon, DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import type { CvMotionState } from "@/components/ai/cv-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
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

export function AtsVersion({ cv, sourceText, onMotion }: { cv: CV; /** texto original del CV, para releerlo a fondo */ sourceText?: string; onMotion?: (s: CvMotionState) => void }) {
  const [phase, setPhase] = useState<Phase>({ k: "idle" })
  const abort = useRef<AbortController | null>(null)
  // La lectura a fondo es la parte lenta: se hace una vez por CV y «Generar de nuevo» la reutiliza.
  const extras = useRef<AtsBundle["extras"]>(null)
  const hasSummary = !!cv.summary?.trim()

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    onMotion?.(phase.k === "working" || phase.k === "verifying" ? "working" : phase.k === "ready" || phase.k === "verified" ? "done" : "idle")
  }, [phase.k, onMotion])

  const generate = async () => {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setPhase({ k: "working", stage: 0 })
    try {
      const bundle = await generateAtsClient(cv, sourceText, (i) => setPhase({ k: "working", stage: i }), ctl.signal, extras.current)
      if (ctl.signal.aborted) return
      extras.current = bundle.extras
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
      if (!ctl.signal.aborted) setPhase({ k: "verified", bundle, view })
    } catch (e) {
      if (ctl.signal.aborted) return
      toast.error((e as Error).message)
      setPhase({ k: "ready", bundle })
    }
  }

  const stageLabels = ATS_STAGES.map((l, i) => (i === 1 && hasSummary ? "Conservando tu resumen" : l))

  const bundle = "bundle" in phase ? phase.bundle : null
  const downloads = bundle && (
    <>
      <Button variant="outline" onClick={() => saveBlob(bundle.pdf.blob, bundle.pdf.name)}>
        <DownloadIcon data-icon="inline-start" />
        PDF
      </Button>
      <Button variant="outline" onClick={() => saveBlob(bundle.docx.blob, bundle.docx.name)}>
        <DownloadIcon data-icon="inline-start" />
        Word
      </Button>
    </>
  )

  return (
    <section aria-labelledby="ats-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
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
        <ol role="status" aria-live="polite" className="flex flex-col gap-2 text-sm">
          {stageLabels.map((label, i) => {
            const done = i < phase.stage || (i === 1 && hasSummary && phase.stage >= 1)
            const current = i === phase.stage && !(i === 1 && hasSummary)
            return (
              <li key={label} className={`flex items-center gap-2 ${done || current ? "" : "text-muted-foreground"}`} aria-current={current ? "step" : undefined}>
                <span className={`grid size-5 shrink-0 place-items-center rounded-full ${done ? "bg-primary text-primary-foreground" : "border"}`}>
                  {done ? <CheckIcon className="size-3" /> : current ? <Spinner className="size-3" /> : null}
                </span>
                {label}
              </li>
            )
          })}
        </ol>
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
            <p className="text-xs text-muted-foreground">{pagesText(bundle.pages)} · {bundle.pdf.name.replace(/\.pdf$/, "")}</p>
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
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {phase.k !== "verified" && (
              <Button disabled={phase.k === "verifying"} onClick={() => void verify(bundle)}>
                {phase.k === "verifying" && <Spinner data-icon="inline-start" />}
                {phase.k === "verifying" ? "Verificando…" : "Verificar"}
              </Button>
            )}
            {downloads}
            <Button variant="ghost" className="text-muted-foreground" disabled={phase.k === "verifying"} onClick={() => void generate()}>
              Generar de nuevo
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
