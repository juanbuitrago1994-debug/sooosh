"use client"

import { useRef, useState } from "react"
import { CheckIcon, DownloadIcon, FileTextIcon } from "lucide-react"
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle, AttachmentTrigger } from "@/components/ui/attachment"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { saveBlob, tailorAtsClient, type TailoredAts } from "@/lib/ats/client"
import type { AtsExtras } from "@/lib/ats/enrich"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * CV en formato ATS para ESTA oferta: parte del CV validado (con lo que se aceptó en la revisión), pone adelante lo que la oferta pide (solo
 * ordena, no inventa), arma el PDF y el Word, los verifica y muestra el porcentaje de formato ATS (meta: 90 %) y la cobertura de la oferta.
 * Al terminar, `onGenerated` lo guarda en el repositorio de CV por oferta.
 */
export function TailoredAts({ cv, offer, sourceText, extras, onGenerated }: { cv: CV; offer: Offer; sourceText?: string; extras?: AtsExtras | null; onGenerated: (r: TailoredAts) => void }) {
  const [state, setState] = useState<{ k: "idle" } | { k: "working" } | { k: "done"; r: TailoredAts; /** la persona ya decidió qué resumen usar (o no había uno nuevo) */ confirmed: boolean } | { k: "error"; message: string }>({ k: "idle" })
  const abort = useRef<AbortController | null>(null)
  // Reescribir el resumen pensando en la oferta (IA local, verificado contra el CV): activado por defecto; si no pasa la verificación, se queda el tuyo.
  const [adapt, setAdapt] = useState(true)

  const run = async (keepMine = false) => {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setState({ k: "working" })
    try {
      const r = await tailorAtsClient(cv, offer, sourceText, extras, ctl.signal, { adaptSummary: adapt && !keepMine })
      if (ctl.signal.aborted) return
      // Si la IA propuso un resumen nuevo, no se guarda nada hasta que la persona elija cuál usar.
      const needsChoice = r.summary.adapted && !!r.summary.text
      setState({ k: "done", r, confirmed: !needsChoice })
      if (!needsChoice) onGenerated(r)
    } catch (e) {
      if (!ctl.signal.aborted) setState({ k: "error", message: (e as Error).message })
    }
  }

  const done = state.k === "done" ? state.r : null
  const confirmed = state.k === "done" && state.confirmed
  const useProposed = () => {
    if (state.k !== "done") return
    setState({ ...state, confirmed: true })
    onGenerated(state.r)
  }
  return (
    <section aria-labelledby="tailored-ats-title" className="flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-1">
        <h2 id="tailored-ats-title" className="text-sm leading-snug font-medium">
          CV ATS para esta oferta
        </h2>
        <p className="text-sm leading-snug text-muted-foreground">Parte de tu CV validado, pone adelante lo que pide la oferta y lo deja en formato ATS (PDF y Word). No agrega nada que no esté en tu CV.</p>
      </div>

      {state.k === "idle" && (
        <div className="flex flex-col gap-3">
          <label className="flex items-start gap-3 text-sm leading-snug">
            <Switch checked={adapt} onCheckedChange={setAdapt} aria-label="Adaptar el resumen a la oferta" />
            <span className="flex flex-col">
              <span className="font-medium">Adaptar el resumen a la oferta</span>
              <span className="text-muted-foreground">La IA local lo reescribe con tus datos y se verifica contra tu CV; si no pasa, se queda el tuyo.</span>
            </span>
          </label>
          <Button className="self-start" onClick={() => void run()}>
            Generar CV ATS para {offer.company || "esta oferta"}
          </Button>
        </div>
      )}
      {state.k === "working" && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Adaptando y verificando tu CV
        </p>
      )}
      {state.k === "error" && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
          <Button className="self-start" variant="outline" onClick={() => void run()}>
            Intentar de nuevo
          </Button>
        </div>
      )}

      {done && !confirmed && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium">Tu resumen</p>
            <p className="text-sm leading-snug text-muted-foreground">{cv.summary?.trim() || "Tu CV no traía resumen."}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium">Resumen propuesto para esta oferta</p>
            <p className="text-sm leading-snug">{done.summary.text}</p>
            <p className="text-xs text-muted-foreground">
              {done.summary.hits.length ? `Menciona lo que pide la oferta: ${done.summary.hits.join(", ")}. ` : ""}Lo escribió la IA local solo con datos de tu CV; léelo y confirma que todo es cierto.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={useProposed}>Usar este resumen</Button>
            <Button variant="outline" onClick={() => void run(true)}>
              Dejar el mío
            </Button>
          </div>
        </div>
      )}

      {done && confirmed && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={done.meets90 ? "default" : "outline"}>
              {done.meets90 && <CheckIcon data-icon="inline-start" />}
              Formato ATS · {done.percent} %
            </Badge>
            <Badge variant="secondary">Cobertura de la oferta · {done.coverage} %</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {done.meets90 ? "Cumple la meta de 90 % de formato ATS." : `No llega a la meta de 90 %: ${done.labelText.toLowerCase()}.`}{" "}
            {done.moved.skillsMoved + done.moved.bulletsMoved > 0
              ? `Pusimos adelante ${plural(done.moved.skillsMoved, "habilidad", "habilidades")} y ${plural(done.moved.bulletsMoved, "logro", "logros")} que pide la oferta.`
              : "Tu CV ya presentaba primero lo que pide la oferta."}{" "}
            {done.summary.adapted ? "Usa el resumen que confirmaste. " : done.summary.reason ? "No se pudo adaptar el resumen sin inventar datos: se dejó el tuyo. " : ""}Se guardó en tus CV por oferta.
          </p>
          <div className="flex flex-col gap-2">
            {([["PDF", done.pdf, plural(done.pages, "página", "páginas")], ["Word", done.docx, "Documento .docx"]] as const).map(([kind, f, note]) => (
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
          <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => void run()}>
            Generar de nuevo
          </Button>
        </div>
      )}
    </section>
  )
}
