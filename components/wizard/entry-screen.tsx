"use client"

import { FileTextIcon } from "lucide-react"
import { MatrixLoader, patternForStep } from "@/components/ai/matrix-loader"
import { ThinkingTicker } from "@/components/ai/thinking-ticker"
import { useAiWork } from "@/components/ai/ai-work"
import { useCvDropzone } from "@/components/dropzone"
import { AppHeader, SkipLink, type HeaderActions } from "./app-header"
import { Rise } from "@/components/motion/rise"
import { Button } from "@/components/ui/button"
import { MAX_UPLOAD_BYTES, formatBytes, type UploadedFile } from "@/lib/uploads"
import { STEPS } from "@/lib/steps"

export type EntryActions = HeaderActions

/**
 * Pantalla de Entrada (UI v2, docs/DESIGN-PATTERNS.md §v2): sin cajas ni bordes, sobre el fondo sólido del tema.
 * Toda la página es zona de soltar; al arrastrar, el fondo se intensifica. Una columna estrecha, a la izquierda.
 */
export function EntryScreen({
  phase,
  fileName,
  error,
  actions,
  onFile,
  onRetry,
  onReset,
}: {
  phase: "upload" | "parsing" | "error"
  fileName?: string
  error?: string
  actions: EntryActions
  onFile: (file: UploadedFile) => void
  onRetry: () => void
  onReset: () => void
}) {
  const { work } = useAiWork()
  const { state, isDragActive, rootProps, inputProps } = useCvDropzone({ disabled: phase === "parsing", onChange: (f) => f && onFile(f) })

  return (
    <div {...rootProps} className="relative flex min-h-dvh flex-col">
      <input {...inputProps} />

      <SkipLink />
      <AppHeader actions={actions} />

      <main id="contenido" className="flex flex-1 items-center pb-24">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-5 px-6">
          <Rise>
            <p className="text-xs text-muted-foreground" aria-label={`Paso 1 de ${STEPS.length}: ${STEPS[0].label}`}>
              1 de {STEPS.length}
            </p>
          </Rise>

          {/* Cada estado (soltar, subiendo, leyendo, error) sube al aparecer: la clave lo vuelve a montar al cambiar de estado. */}
          <Rise key={phase === "upload" ? state.status : phase} step={1}>
          {phase === "parsing" ? (
            <section aria-label="Leyendo tu CV" className="flex flex-col gap-3">
              <h1 className="sr-only">Leyendo tu CV</h1>
              <div className="flex items-center gap-3">
                <MatrixLoader size="sm" pattern={patternForStep(work?.step ?? 0)} />
                <ThinkingTicker messages={work?.messages ?? []} step={work?.step ?? 0} className="text-left text-xs font-normal text-muted-foreground" />
              </div>
              <p className="text-xs break-all text-muted-foreground">{fileName}</p>
              {work?.onCancel && (
                <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={work.onCancel}>
                  Cancelar
                </Button>
              )}
            </section>
          ) : phase === "error" ? (
            <section className="flex flex-col gap-3">
              <h1 className="text-lg font-medium">No pudimos leer tu CV</h1>
              <p className="text-xs break-all text-muted-foreground">{fileName}</p>
              <p role="alert" className="text-sm whitespace-pre-line text-destructive">
                {error}
              </p>
              <div className="flex items-center gap-2">
                <Button onClick={onRetry}>Reintentar</Button>
                <Button variant="ghost" className="text-muted-foreground" onClick={onReset}>
                  Subir otro archivo
                </Button>
              </div>
            </section>
          ) : state.status === "uploading" ? (
            <section className="flex flex-col gap-3">
              <h1 className="sr-only">Subiendo tu CV</h1>
              <div className="flex items-center gap-3">
                <MatrixLoader size="sm" />
                <p role="status" className="text-xs break-all text-muted-foreground">
                  Subiendo {state.name}…
                </p>
              </div>
            </section>
          ) : (
            <section className="flex flex-col gap-4">
              <FileTextIcon className="size-6 text-muted-foreground/60" aria-hidden />
              <div className="flex flex-col gap-1">
                <h1 className="text-lg font-medium">{isDragActive ? "Suéltalo aquí" : "Suelta tu CV"}</h1>
                <p className="text-xs text-muted-foreground">
                  PDF, Word o imagen · máx. {formatBytes(MAX_UPLOAD_BYTES)} · se lee en tu equipo
                </p>
              </div>
              {state.status === "error" && (
                <p role="alert" className="text-sm text-destructive">
                  {state.message}
                </p>
              )}
            </section>
          )}
          </Rise>
        </div>
      </main>
    </div>
  )
}
