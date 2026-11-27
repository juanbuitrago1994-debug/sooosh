"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Undo2Icon } from "lucide-react"
import { toast } from "sonner"
import { useAiWork } from "@/components/ai/ai-work"
import { AuraField } from "@/components/magic/aura-field"
import { SwapText } from "@/components/motion/swap-text"
import { DropMessage } from "@/components/cv/drop-message"
import { ReadingStatus } from "@/components/cv/reading-status"
import { useCvDropzone } from "@/components/dropzone"
import { AppHeader, SkipLink, type HeaderActions } from "./app-header"
import { Rise } from "@/components/motion/rise"
import { Button } from "@/components/ui/button"
import type { UploadedFile } from "@/lib/uploads"
import { ENTRY_IDLE, entryDropCopy, fileSummary } from "@/lib/profile/cv-drop"
import { TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"

export type EntryActions = HeaderActions

/** Título de UNA línea y descripción de DOS (reserva el alto de dos líneas para que la pantalla no salte al cambiar de frase), igual en reposo y al arrastrar. */
const TITLE = "max-w-full min-w-0 truncate text-sm font-medium"
const DESCRIPTION = "line-clamp-2 min-h-10 max-w-full text-center text-sm text-balance text-muted-foreground"

/**
 * Pantalla de Entrada (UI v2, docs/DESIGN-PATTERNS.md §v2): sin cajas ni bordes, sobre el fondo sólido del tema.
 * Toda la página es zona de soltar. Al detectar un archivo encima (o mientras se sube y se lee), un AURA de luz (`AuraField`, en la línea de Siri y Apple Intelligence: un golpe
 * fuerte de luz desde el centro en el primer contacto y después un halo que respira y pulsos suaves, en bucle; solo suma luz, no deforma nada) rodea al mensaje central, que cambia
 * de frase con motion (`entryDropCopy`: qué va a pasar y, si algo no sirve, qué hacer). Una columna estrecha, a la izquierda, cuando no pasa nada de eso. El panel «Mi CV» tiene su
 * propio aviso (haz `FlowBeam`); el login, su lupa de entrada. */
export function EntryScreen({
  phase,
  fileName,
  fileSize,
  fileType,
  error,
  actions,
  onFile,
  onRetry,
  onReset,
}: {
  phase: "upload" | "parsing" | "error"
  fileName?: string
  fileSize?: number
  fileType?: string
  error?: string
  actions: EntryActions
  onFile: (file: UploadedFile) => void
  onRetry: () => void
  onReset: () => void
}) {
  const { work } = useAiWork()
  const { state, isDragActive, dragInfo, overCancel, cancelZoneProps, rootProps, inputProps, open } = useCvDropzone({ disabled: phase === "parsing", onChange: (f) => f && onFile(f), onCancelDrop: () => toast.info("Cancelaste la carga: no se subió nada.") })
  const reduce = useReducedMotion()
  // Subiendo o leyendo: solo el haz y el avance. Arrastrando (sin estar ocupado): el aviso de soltar.
  const busy = phase === "parsing" || state.status === "uploading"
  const dragging = isDragActive && !busy && phase === "upload"
  // Mientras se arrastra, el aviso dice lo que el navegador deja ver: cuántos archivos y de qué tipo (nunca el nombre ni el peso hasta soltarlo).
  const copy = entryDropCopy(dragInfo, overCancel)
  const active = dragging || busy

  return (
    <div {...rootProps} className="relative flex min-h-dvh flex-col">
      <input {...inputProps} />

      <SkipLink />
      <AppHeader actions={actions} />

      <main id="contenido" className="flex flex-1 items-center pb-24">
        {/* El mensaje de reposo se desvanece (solo opacidad, sin desenfoque) cuando entra el aura y el mensaje del momento. */}
        <motion.div className="mx-auto flex w-full max-w-sm flex-col gap-5 px-6" animate={{ opacity: active ? 0 : 1 }} transition={reduce ? { duration: 0 } : active ? TRANSITION_IN : TRANSITION_OUT}>
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
              <DropMessage
                onPick={open}
                title={<h1 className={TITLE}>{ENTRY_IDLE.title}</h1>}
                description={<p className={DESCRIPTION}>{ENTRY_IDLE.description}</p>}
              />
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

      {/* Aura de luz: un golpe fuerte desde el centro al detectar el archivo y después respiración y pulsos suaves en bucle (el mensaje es DOM real encima). */}
      <AuraField active={active} />
      {/* Mensaje del momento, en la misma posición que el de reposo: al arrastrar cambia la frase (solo opacidad y desplazamiento) según lo que se ve en el arrastre. */}
      <AnimatePresence>
        {active && (
          <motion.div
            data-drop-overlay
            aria-hidden={!busy}
            className="pointer-events-none fixed inset-0 z-50 flex items-center pb-24"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: reduce ? { duration: 0 } : TRANSITION_IN }}
            exit={{ opacity: 0, transition: reduce ? { duration: 0 } : TRANSITION_OUT }}
          >
            <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 px-6">
              {busy ? (
                <>
                  <ReadingStatus idx={phase === "parsing" ? (work?.step ?? 0) : -1} phrase={phase === "parsing" ? work?.messages?.[work?.step ?? 0] : "Subiendo tu CV"} />
                  <div className="flex max-w-sm flex-col items-center gap-2">
                    <p className="text-xs break-all text-muted-foreground">{state.status === "uploading" ? fileSummary(state) : fileName ? fileSummary({ name: fileName, size: fileSize ?? 0, type: fileType }) : ""}</p>
                    {phase === "parsing" && work?.onCancel && (
                      <Button variant="ghost" size="sm" className="pointer-events-auto text-muted-foreground" onClick={work.onCancel}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <DropMessage
                  title={
                    <SwapText id={copy.title} blur={false}>
                      <p className={TITLE}>{copy.title}</p>
                    </SwapText>
                  }
                  description={
                    <SwapText id={copy.description} blur={false}>
                      <p className={DESCRIPTION}>{copy.description}</p>
                    </SwapText>
                  }
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Zona de cancelar (punteada, abajo): si el archivo se suelta aquí no se sube nada y se vuelve al inicio. Solo mientras se arrastra (no al subir ni leer). */}
      <AnimatePresence>
        {dragging && !busy && (
          <motion.div
            data-cancel-zone
            aria-hidden
            {...cancelZoneProps}
            className={`fixed inset-x-6 bottom-6 z-50 mx-auto flex h-24 max-w-md flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 text-center motion-safe:transition-colors motion-safe:duration-200 ${overCancel ? "border-foreground/60 bg-muted/60" : "border-muted-foreground/30"}`}
            initial={{ opacity: 0, y: reduce ? 0 : 16 }}
            animate={{ opacity: 1, y: 0, transition: reduce ? { duration: 0 } : TRANSITION_IN }}
            exit={{ opacity: 0, y: reduce ? 0 : 16, transition: reduce ? { duration: 0 } : TRANSITION_OUT }}
          >
            <Undo2Icon className={`pointer-events-none size-4 ${overCancel ? "text-foreground" : "text-muted-foreground"}`} aria-hidden />
            <p className={`pointer-events-none text-sm font-medium ${overCancel ? "text-foreground" : "text-muted-foreground"}`}>{overCancel ? "Suéltalo para cancelar" : "¿Te equivocaste de archivo?"}</p>
            <p className="pointer-events-none text-xs text-muted-foreground">Llévalo aquí y no se sube nada.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
