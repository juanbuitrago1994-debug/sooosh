"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FileTextIcon, InfoIcon } from "lucide-react"
import { toast } from "sonner"
import { useAiWork } from "@/components/ai/ai-work"
import { StepHeader } from "@/components/wizard/step-header"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EntryScreen, type EntryActions } from "@/components/wizard/entry-screen"
import { CV_FORM_ID, CvForm } from "@/components/cv/cv-form"
import { ProfileSummary } from "@/components/cv/profile-summary"
import { freezeSource, type Source } from "@/lib/cv/source"
import { getSearchProfile, refreshSearchProfile, setSearchProfile } from "@/lib/profile/search-profile"
import { STAGES } from "@/lib/cv/stages"
import { formatBytes, type UploadedFile } from "@/lib/uploads"
import type { CV } from "@/lib/schemas/cv"
import type { Diagnosis } from "@/lib/schemas/diagnosis"

export type ParseMeta = {
  method: string
  pipeline: "estructurado" | "clasico"
  extractMs: number
  totalMs: number
  timings: Record<string, number>
  llmCalls: number
  truncated: boolean
}

/**
 * `cv` es la copia editable (con las correcciones del usuario); `source` es la FUENTE DE VERDAD inmutable:
 * el texto y el CV tal como se leyeron del archivo, contra los que se verifica toda reescritura.
 */
export type ProfileData = { file: UploadedFile; cv: CV; sourceText: string; source: Source; diagnosis?: Diagnosis; meta?: ParseMeta }

export type ProfilePhase = "upload" | "parsing" | "error" | "review"

type Ev = { t: "stage"; i: number } | { t: "result"; cv: CV; diagnosis: Diagnosis; sourceText: string; meta: ParseMeta } | { t: "error"; error: string; code?: string }

export function StepProfile({
  initial,
  onPhase,
  onChange,
  entry,
}: {
  entry?: EntryActions
  initial: ProfileData | null
  onPhase: (p: ProfilePhase) => void
  onChange: (p: ProfileData | null) => void
}) {
  const [phase, setPhase] = useState<ProfilePhase>(initial ? "review" : "upload")
  const [data, setData] = useState<ProfileData | null>(initial)
  const [file, setFile] = useState<UploadedFile | null>(initial?.file ?? null)
  const [error, setError] = useState("")
  const [correcting, setCorrecting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const ai = useAiWork()

  useEffect(() => onPhase(phase), [phase, onPhase])
  useEffect(() => () => abortRef.current?.abort(), [])

  const parse = useCallback(
    async (f: UploadedFile) => {
      setFile(f)
      setError("")
      setPhase("parsing")
      const ctrl = new AbortController()
      abortRef.current = ctrl
      // El ticker avanza con las etapas REALES que informa el servidor (no con temporizadores).
      ai.start([...STAGES], () => ctrl.abort())
      try {
        const res = await fetch("/api/cv/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: f.id }),
          signal: ctrl.signal,
        })
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? "No se pudo leer el CV.")
        }
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ""
        let result: Extract<Ev, { t: "result" }> | null = null
        const handle = (line: string) => {
          if (!line.trim()) return
          const ev = JSON.parse(line) as Ev
          if (ev.t === "stage") ai.advance(ev.i)
          else if (ev.t === "error") throw new Error(ev.error)
          else result = ev
        }
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          let nl: number
          while ((nl = buf.indexOf("\n")) >= 0) {
            handle(buf.slice(0, nl))
            buf = buf.slice(nl + 1)
          }
        }
        handle(buf)
        const r = result as Extract<Ev, { t: "result" }> | null
        if (!r) throw new Error("La lectura terminó sin resultado. Inténtalo de nuevo.")
        const next: ProfileData = { file: f, cv: r.cv, sourceText: r.sourceText, source: freezeSource(r.sourceText, r.cv), diagnosis: r.diagnosis, meta: r.meta }
        setData(next)
        onChange(next)
        // El primer CV que se lee pasa a ser el perfil de búsqueda; los siguientes (adaptaciones) no lo cambian salvo que la persona lo pida.
        if (!getSearchProfile()) setSearchProfile(r.cv, f.id, r.sourceText)
        setPhase("review")
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          setPhase("upload")
          return
        }
        setError((e as Error).message)
        setPhase("error")
      } finally {
        ai.stop()
      }
    },
    [ai, onChange],
  )

  const reset = () => {
    abortRef.current?.abort()
    if (file && file.size > 0) fetch(`/api/upload?id=${encodeURIComponent(file.id)}`, { method: "DELETE" }).catch(() => {})
    setData(null)
    setFile(null)
    onChange(null)
    setPhase("upload")
  }

  const update = (next: ProfileData) => {
    setData(next)
    onChange(next)
    refreshSearchProfile(next.cv, next.file.id)
    fetch("/api/cv/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next.cv) }).catch(() => {})
  }

  const answer = (id: NonNullable<Diagnosis["question"]>["id"], value: string) => {
    if (!data?.diagnosis) return
    const diagnosis: Diagnosis = { ...data.diagnosis, question: null }
    if (id === "fullName") {
      update({ ...data, cv: { ...data.cv, header: { ...data.cv.header, fullName: value } }, diagnosis: { ...diagnosis, confidence: { ...diagnosis.confidence, name: "alta" } } })
    } else if (id === "language") {
      update({ ...data, diagnosis: { ...diagnosis, language: value === "Inglés" ? "en" : "es", confidence: { ...diagnosis.confidence, language: "alta" } } })
    } else {
      update({ ...data, diagnosis })
      if (value.startsWith("Sí")) setCorrecting(true)
    }
  }

  // En modo Entrada, al terminar la lectura el shell cambia de layout y vuelve a montar este paso en «review».
  if (entry) {
    if (phase === "review") return null
    return <EntryScreen phase={phase} fileName={file?.name} error={error} actions={entry} onFile={(f) => void parse(f)} onRetry={() => file && void parse(file)} onReset={reset} />
  }

  const meta = data?.meta
  return (
    <div className="flex flex-col gap-5">
      <StepHeader title="Así leímos tu CV" description="Revisa que los datos principales estén bien. Corrige solo lo que esté mal." />
      <div className="flex items-center gap-3">
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          <span className="block truncate text-sm font-medium text-foreground">{file?.name}</span>
          {file && file.size > 0 ? `${file.type} · ${formatBytes(file.size)}` : "Reabierto desde el historial"}
          {meta && ` · leído en ${Math.max(1, Math.round(meta.totalMs / 1000))} s`}
        </p>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={reset}>
          Cambiar
        </Button>
      </div>

      {meta?.method.includes("ocr") && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>Leído con OCR: el texto salió de una imagen y puede tener errores. Revisa bien los datos.</span>
        </p>
      )}
      {meta?.truncated && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>CV muy largo: solo se leyó el inicio. Usa «Corregir» para agregar lo que falte.</span>
        </p>
      )}

      {data && data.diagnosis ? (
        <ProfileSummary cv={data.cv} fileId={data.file.id} diagnosis={data.diagnosis} sourceText={data.sourceText} onAnswer={answer} onCorrect={() => setCorrecting(true)} />
      ) : (
        data && (
          <div className="flex flex-col gap-3">
            <p className="text-lg font-medium">{data.cv.header.fullName}</p>
            <p className="text-sm text-muted-foreground">Adaptación reabierta desde el historial.</p>
            <Button variant="ghost" className="self-start" onClick={() => setCorrecting(true)}>
              Corregir
            </Button>
          </div>
        )
      )}

      <Dialog open={correcting} onOpenChange={setCorrecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Corregir tus datos</DialogTitle>
            <DialogDescription>Lo que agregues aquí lo escribes tú: la IA solo podrá usar tus datos, nunca inventar otros.</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {data && (
              <CvForm
                initial={data.cv}
                onSubmit={(cv) => {
                  update({ ...data, cv })
                  setCorrecting(false)
                  toast.success("Cambios guardados")
                }}
              />
            )}
          </div>
          <DialogFooter>
            <Button type="submit" form={CV_FORM_ID}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
