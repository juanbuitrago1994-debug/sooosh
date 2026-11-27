"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useAiWork } from "@/components/ai/ai-work"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EntryScreen, type EntryActions } from "@/components/wizard/entry-screen"
import { CV_FORM_ID, CvForm } from "@/components/cv/cv-form"
import { ValidationFlow } from "@/components/cv/validation-flow"
import { freezeSource, type Source } from "@/lib/cv/source"
import { originalAtsClient, type OriginalAts } from "@/lib/ats/client"
import { prefetchExtras } from "@/lib/ats/prefetch"
import { clearSearchProfile, getSearchProfile, refreshSearchProfile, setOriginalAts, setProfileValidated, setSearchProfile, useSearchProfile } from "@/lib/profile/search-profile"
import { ValidatedCv } from "@/components/cv/validated-cv"
import { cvFileDetail } from "@/components/cv/cv-file-card"
import { STAGES } from "@/lib/cv/stages"
import type { UploadedFile } from "@/lib/uploads"
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
  validated = false,
  onValidated,
  onContinue,
  home = false,
  onGoHome,
  onStartValidation,
}: {
  /** mostrar la pantalla de inicio con el CV adjunto aunque aún no esté validado */
  home?: boolean
  /** ir a la pantalla de inicio (botón «Salir» de la validación) */
  onGoHome?: () => void
  /** salir del inicio y empezar a validar */
  onStartValidation?: () => void
  onContinue?: () => void
  validated?: boolean
  onValidated?: (all: boolean) => void
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

  // Afinidad del archivo original con el formato ATS: se mide una vez por archivo (no si es una adaptación reabierta, que no trae archivo).
  const [atsState, setAtsState] = useState<{ id: string; v: OriginalAts | null } | null>(null)
  const atsKey = data && data.file.size > 0 ? data.file.id : ""
  const saved = useSearchProfile()
  const ats = atsState?.id === atsKey ? atsState.v : saved?.fileId === atsKey ? saved.originalAts : undefined
  useEffect(() => {
    if (!atsKey || !data) return
    const stored = getSearchProfile()
    if (stored?.fileId === atsKey && stored.originalAts !== undefined) return // ya medida: se lee del perfil
    const ctl = new AbortController()
    originalAtsClient(data.cv, data.file.id, data.file.name, data.sourceText, ctl.signal).then(
      (v) => {
        setAtsState({ id: atsKey, v })
        setOriginalAts(v, atsKey)
      },
      () => !ctl.signal.aborted && setAtsState({ id: atsKey, v: null }),
    )
    return () => ctl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el archivo
  }, [atsKey])
  // ¿Este CV ya estaba validado al llegar a este paso? (se mide una vez: al terminar de validar no se salta la pantalla «Todo validado»)
  const [resumed] = useState(() => {
    const p = getSearchProfile()
    return !!p?.validatedAt && !!initial && p.fileId === initial.file.id
  })
  /** Al terminar la validación se marca el CV como validado en el perfil guardado; si la persona vuelve atrás, se quita la marca. */
  const onValid = useCallback(
    (all: boolean) => {
      setProfileValidated(all)
      onValidated?.(all)
    },
    [onValidated],
  )
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
        onValidated?.(false)
        // Solo hay UN CV: el que se sube pasa a ser el perfil de búsqueda (sin validar hasta que la persona termine de validarlo).
        setSearchProfile(r.cv, f.id, r.sourceText, { name: f.name, type: f.type, size: f.size, readMs: r.meta.totalMs })
        prefetchExtras(r.cv, r.sourceText, f.id)
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
    [ai, onChange, onValidated],
  )

  const reset = () => {
    abortRef.current?.abort()
    if (file && file.size > 0) fetch(`/api/upload?id=${encodeURIComponent(file.id)}`, { method: "DELETE" }).catch(() => {})
    clearSearchProfile()
    setData(null)
    setFile(null)
    onValidated?.(false)
    onChange(null)
    setPhase("upload")
  }

  const update = (next: ProfileData) => {
    setData(next)
    onChange(next)
    refreshSearchProfile(next.cv, next.file.id)
    fetch("/api/cv/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next.cv) }).catch(() => {})
  }

  // En modo Entrada, al terminar la lectura el shell cambia de layout y vuelve a montar este paso en «review».
  if (entry) {
    if (phase === "review") return null
    return <EntryScreen phase={phase} fileName={file?.name} fileSize={file?.size} fileType={file?.type} error={error} actions={entry} onFile={(f) => void parse(f)} onRetry={() => file && void parse(file)} onReset={reset} />
  }

  const meta = data?.meta
  const notes = [meta?.method.includes("ocr") && "Leído con OCR: el texto salió de una imagen y puede tener errores. Revisa bien los datos.", meta?.truncated && "CV muy largo: solo se leyó el inicio. Usa «Corregir» para agregar lo que falte."].filter((n): n is string => !!n)
  const readMs = meta?.totalMs ?? getSearchProfile()?.file?.readMs
  const fileFacts = {
    name: file?.name ?? "CV",
    detail: cvFileDetail(file ?? undefined, readMs),
    notes,
    ats: !atsKey ? null : ats === undefined ? undefined : ats ? { percent: ats.percent, labelText: ats.labelText, good: ats.label === "listo" || ats.label === "casi" } : null,
  }
  return (
    <div className="flex flex-1 flex-col gap-8">
      {data &&
        (resumed || home ? (
          // CV ya validado (se volvió o se recargó la página): su tarjeta y el botón para seguir.
          <ValidatedCv file={fileFacts} onChangeFile={reset} onContinue={() => onContinue?.()} validated={resumed || validated} onValidate={onStartValidation} />
        ) : (
          <ValidationFlow cv={data.cv} file={fileFacts} onChange={(cv) => update({ ...data, cv })} onChangeFile={reset} onContinue={onContinue} validated={validated} onValidated={onValid} onExit={onGoHome} />
        ))}

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
