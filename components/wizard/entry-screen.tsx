"use client"

import { motion, useReducedMotion } from "motion/react"
import { useAiWork } from "@/components/ai/ai-work"
import { CvDropOverlay } from "@/components/cv/cv-drop-overlay"
import { DropMessage } from "@/components/cv/drop-message"
import { ReadingStatus } from "@/components/cv/reading-status"
import { useCvDropzone } from "@/components/dropzone"
import { AppHeader, SkipLink, type HeaderActions } from "./app-header"
import { Rise } from "@/components/motion/rise"
import { Button } from "@/components/ui/button"
import type { UploadedFile } from "@/lib/uploads"
import { MOTION, TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"
import { STEPS } from "@/lib/steps"

export type EntryActions = HeaderActions

/**
 * Pantalla de Entrada (UI v2, docs/DESIGN-PATTERNS.md §v2): sin cajas ni bordes, sobre el fondo sólido del tema.
 * Toda la página es zona de soltar. Al detectar un archivo encima, el contenido se atenúa y desenfoca y el haz `FlowBeam` recorre el borde de la
 * ventana con «Suelta tu CV aquí»; mientras se sube y se lee, el mismo haz y la línea spinner + frase + porcentaje (`ReadingStatus`), centrados:
 * lo mismo que el panel «Mi CV». Una columna estrecha, a la izquierda, cuando no pasa nada de eso.
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
  const reduce = useReducedMotion()
  // Subiendo o leyendo: solo el haz y el avance. Arrastrando (sin estar ocupado): el aviso de soltar.
  const busy = phase === "parsing" || state.status === "uploading"
  const dragging = isDragActive && !busy && phase === "upload"

  return (
    <div {...rootProps} className="relative flex min-h-dvh flex-col">
      <input {...inputProps} />

      <SkipLink />
      <AppHeader actions={actions} />

      <main id="contenido" className="flex flex-1 items-center pb-24">
        <motion.div
          className="mx-auto flex w-full max-w-sm flex-col gap-5 px-6"
          animate={dragging && !reduce ? { opacity: 0.4, filter: `blur(${MOTION.blur}px)` } : { opacity: 1, filter: "blur(0px)" }}
          transition={dragging ? TRANSITION_IN : TRANSITION_OUT}
        >
          {/* Mientras se sube o se lee, solo el haz y el avance (igual que el panel «Mi CV»): el contador de pasos se oculta. */}
          {!busy && (
            <Rise>
              <p className="self-center text-xs text-muted-foreground" aria-label={`Paso 1 de ${STEPS.length}: ${STEPS[0].label}`}>
                1 de {STEPS.length}
              </p>
            </Rise>
          )}

          {/* Cada estado (soltar, subiendo, leyendo, error) sube al aparecer: la clave lo vuelve a montar al cambiar de estado. */}
          <Rise key={phase === "upload" ? state.status : phase} step={1}>
          {phase === "parsing" ? (
            <h1 className="sr-only">Leyendo tu CV</h1>
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
            <h1 className="sr-only">Subiendo tu CV</h1>
          ) : (
            // En reposo, el mismo mensaje que el panel «Mi CV» sin CV (ícono en cuadro, título, línea y formatos), centrado; al arrastrar cambia solo la frase.
            <section className="flex flex-col items-center gap-4">
              <DropMessage title={<h1 className="text-sm font-medium">Sube tu CV</h1>} description={<p className="text-sm text-muted-foreground">Arrastra el archivo o haz clic</p>} />
              {state.status === "error" && (
                <p role="alert" className="text-center text-sm text-destructive">
                  {state.message}
                </p>
              )}
            </section>
          )}
          </Rise>
        </motion.div>
      </main>

      {/* Haz alrededor de la ventana y mensaje centrado: al arrastrar un archivo y mientras se sube y se lee. */}
      <CvDropOverlay show={dragging || busy} className="fixed inset-2" hidden={!busy}>
        {busy ? (
          <>
            <ReadingStatus idx={phase === "parsing" ? (work?.step ?? 0) : -1} phrase={phase === "parsing" ? work?.messages?.[work?.step ?? 0] : "Subiendo tu CV"} />
            <div className="flex max-w-sm flex-col items-center gap-2">
              <p className="text-xs break-all text-muted-foreground">{fileName ?? (state.status === "uploading" ? state.name : "")}</p>
              {phase === "parsing" && work?.onCancel && (
                <Button variant="ghost" size="sm" className="pointer-events-auto text-muted-foreground" onClick={work.onCancel}>
                  Cancelar
                </Button>
              )}
            </div>
          </>
        ) : (
          <DropMessage title={<p className="text-sm font-medium">Suelta tu CV aquí</p>} description={<p className="text-sm text-muted-foreground">Un solo archivo</p>} />
        )}
      </CvDropOverlay>
    </div>
  )
}
