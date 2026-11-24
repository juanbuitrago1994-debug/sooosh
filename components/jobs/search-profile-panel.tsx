"use client"

import { useEffect, useRef, useState } from "react"
import { FileTextIcon, UploadIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { toast } from "sonner"
import { AtsVersion } from "@/components/jobs/ats-version"
import { FlowBeam } from "@/components/magic/flow-beam"
import { FloatingDrawerContent } from "@/components/jobs/floating-drawer"
import { parseCvFileSafe } from "@/components/jobs/parse-cv-file"
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle, AttachmentTrigger } from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Separator } from "@/components/ui/separator"
import { nextProgress, stageFloor, stageIndex } from "@/lib/cv/progress"
import { dragHasFiles, friendlyReadError, pickCvFile } from "@/lib/profile/cv-drop"
import { clearSearchProfile, setSearchProfile, useSearchProfile } from "@/lib/profile/search-profile"
import { MOTION, TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"

/** Piezas de cabecera del panel (inyectables para poder probar el contenido sin el Drawer). */
export type PanelShell = {
  Header: React.ComponentType<{ className?: string; children?: React.ReactNode }>
  Title: React.ComponentType<{ className?: string; children?: React.ReactNode }>
  Description: React.ComponentType<{ className?: string; children?: React.ReactNode }>
}

/**
 * «Mi CV» como panel lateral flotante (el mismo de «Postular por correo»). Todo el panel es una zona para soltar el CV: al arrastrar un
 * archivo encima, el contenido se desenfoca y aparece «Suelta tu CV aquí». Espaciado de panel: 24 px entre bloques y 8 px dentro de cada bloque.
 */
export function SearchProfileDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const hasCv = !!useSearchProfile()
  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
      {/* Sin CV, el borde del propio panel es el recuadro punteado de subida. */}
      <FloatingDrawerContent className={hasCv ? undefined : "border-dashed"}>
        <SearchProfilePanel shell={{ Header: DrawerHeader, Title: DrawerTitle, Description: DrawerDescription }} />
      </FloatingDrawerContent>
    </Drawer>
  )
}

export function SearchProfilePanel({ shell }: { shell: PanelShell }) {
  const { Header, Title, Description } = shell
  const profile = useSearchProfile()
  const reduce = useReducedMotion()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState("")
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)
  // dragenter/dragleave se disparan también al pasar sobre los hijos: se cuenta para no parpadear.
  const depth = useRef(0)

  const onFiles = async (files: ArrayLike<File> | null | undefined) => {
    if (busy) return
    const picked = pickCvFile(files)
    if (!picked.file) {
      setError(picked.error ?? "No llegó ningún archivo.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const r = await parseCvFileSafe(picked.file, setStage)
      setSearchProfile(r.cv, r.fileId, r.sourceText)
      toast.success("CV listo: ya ves el encaje de cada oferta")
    } catch (e) {
      setError(friendlyReadError((e as Error).message))
    } finally {
      setBusy(false)
      setStage("")
      if (input.current) input.current.value = ""
    }
  }

  const dnd = {
    onDragEnter: (e: React.DragEvent) => {
      if (!dragHasFiles(e.dataTransfer?.types)) return
      e.preventDefault()
      depth.current++
      setDragging(true)
    },
    onDragOver: (e: React.DragEvent) => {
      if (dragHasFiles(e.dataTransfer?.types)) e.preventDefault()
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!dragHasFiles(e.dataTransfer?.types)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      void onFiles(e.dataTransfer?.files)
    },
  }

  const picker = (
    <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-hidden accept={`.${["pdf", "docx", "doc", "odt", "rtf", "txt", "md", "jpg", "jpeg", "png", "heic"].join(",.")}`} onChange={(e) => void onFiles(e.target.files)} />
  )

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" {...dnd}>
      {picker}
      <motion.div
        className={`flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto ${profile || busy ? "p-4" : "p-0"}`}
        animate={dragging && !reduce ? { opacity: 0.4, filter: `blur(${MOTION.blur}px)` } : { opacity: 1, filter: "blur(0px)" }}
        transition={dragging ? TRANSITION_IN : TRANSITION_OUT}
      >
        {busy ? (
          // Regla de las hojas con carga: mientras se lee el CV no se ve nada más que el mensaje centrado (va en el aviso de abajo) y el haz.
          <Header className="sr-only">
            <Title>Mi CV</Title>
            <Description>Leyendo tu CV</Description>
          </Header>
        ) : (
          <>
            {profile ? (
              <>
                <Header className="flex flex-col gap-1 p-0 text-left">
                  <Title>Mi CV</Title>
                  <Description>Con él comparamos las ofertas y armamos tu versión ATS.</Description>
                </Header>
                <Attachment state="done" className="w-full">
                  <AttachmentMedia>
                    <FileTextIcon />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{profile.label}</AttachmentTitle>
                    <AttachmentDescription>Arrastra otro archivo aquí para cambiarlo</AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentActions>
                    <Button variant="ghost" size="sm" onClick={() => input.current?.click()}>
                      Cambiar CV
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearSearchProfile}>
                      Quitar
                    </Button>
                  </AttachmentActions>
                </Attachment>
                <Separator />
                <AtsVersion key={profile.updatedAt} cv={profile.cv} sourceText={profile.sourceText} />
              </>
            ) : (
              // Sin CV: todo el panel es el recuadro de subida (clic en cualquier parte o soltar el archivo).
              <Attachment state="idle" className="w-full flex-1 flex-col items-center justify-center gap-6 rounded-2xl border-0 bg-transparent text-center">
                <AttachmentTrigger aria-label="Subir mi CV" onClick={() => input.current?.click()} />
                <DropMessage
                  title={<Title className="text-sm font-medium">Sube tu CV</Title>}
                  description={<Description className="text-sm text-muted-foreground">Arrastra el archivo o haz clic</Description>}
                />
                {error && (
                  <p role="alert" className="relative z-20 max-w-xs text-sm text-destructive">
                    {error}
                  </p>
                )}
              </Attachment>
            )}

            {error && profile && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {(dragging || busy) && (
          // El haz recorre TODO el borde del panel solo mientras hay un archivo encima o se está leyendo el CV (únicas apariciones del haz en este panel).
          // El mensaje va siempre centrado en vertical y en horizontal.
          <motion.div
            data-drop-overlay
            aria-hidden={!busy}
            className="pointer-events-none absolute inset-0 rounded-2xl"
            initial={reduce ? { opacity: 0 } : { opacity: 0, filter: `blur(${MOTION.blur}px)` }}
            animate={{ opacity: 1, filter: "blur(0px)", transition: TRANSITION_IN }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, filter: `blur(${MOTION.blur}px)`, transition: TRANSITION_OUT }}
          >
            <FlowBeam className="rounded-2xl" />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              {busy ? (
                <div className="flex flex-col items-center gap-6">
                  <ReadingProgress stage={stage} />
                  <CenteredStatus messages={stage ? [stage] : READING} />
                </div>
              ) : (
                <DropMessage title={<p className="text-sm font-medium">Suelta tu CV aquí</p>} description={<p className="text-sm text-muted-foreground">Un solo archivo</p>} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const READING = ["Leyendo tu CV", "Reconociendo tu experiencia", "Preparando el encaje"]
const noDots = (t: string) => t.replace(/[\s….]+$/u, "")

/**
 * Mismo mensaje en los dos momentos de soltar un CV (sin CV subido y arrastrando uno nuevo): el mismo ícono, el mismo orden y los mismos
 * tamaños; solo cambia la frase. Los formatos aceptados van siempre debajo.
 */
function DropMessage({ title, description }: { title: React.ReactNode; description: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="grid size-14 place-items-center rounded-lg bg-muted text-foreground">
        <UploadIcon className="size-4" />
      </span>
      <div className="flex flex-col items-center gap-1">
        {title}
        {description}
      </div>
      <p className="text-xs text-muted-foreground">PDF, Word o imagen</p>
    </div>
  )
}

/** Frase de estado, siempre centrada (vertical y horizontal) y sin puntos suspensivos; cambia sola cada 2,4 s con la entrada de la app (opacity, blur y translate). */
function CenteredStatus({ messages }: { messages: string[] }) {
  const reduce = useReducedMotion()
  const list = messages.map(noDots)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (list.length < 2) return
    const t = setInterval(() => setI((n) => (n + 1) % list.length), 2400)
    return () => clearInterval(t)
  }, [list.length])
  const text = list[i % list.length] ?? ""
  return (
    <div role="status" aria-live="polite" className="relative flex h-6 items-center justify-center text-sm text-muted-foreground">
      <span className="sr-only">{list[0]}</span>
      {reduce ? (
        <span aria-hidden>{text}</span>
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            aria-hidden
            key={text}
            className="whitespace-nowrap"
            initial={{ opacity: 0, y: MOTION.offset, filter: `blur(${MOTION.blur}px)` }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: TRANSITION_IN }}
            exit={{ opacity: 0, y: -MOTION.offset, filter: `blur(${MOTION.blur}px)`, transition: TRANSITION_OUT }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      )}
    </div>
  )
}

/**
 * Avance de la lectura como anillo con el porcentaje al centro (ver `lib/cv/progress.ts`: sube con la etapa real y avanza suave dentro de ella;
 * nunca marca 100 % antes de terminar). Anillo SVG con tokens del tema: pista `muted`, avance `primary`.
 */
// Círculo que empieza arriba y avanza en sentido horario (dos semiarcos), con longitud normalizada a 100 para que el avance sea el porcentaje.
const RING = "M50 6 a44 44 0 1 1 0 88 a44 44 0 1 1 0 -88"
function ReadingProgress({ stage }: { stage: string }) {
  const idx = stageIndex(stage)
  const [value, setValue] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setValue((v) => nextProgress(v, idx)), 150)
    return () => clearInterval(t)
  }, [idx])
  const shown = Math.max(Math.floor(value), stageFloor(idx))
  return (
    <div role="progressbar" aria-label="Avance de la lectura de tu CV" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shown} className="relative grid size-24 place-items-center">
      <svg viewBox="0 0 100 100" aria-hidden className="absolute inset-0 size-full">
        <path d={RING} fill="none" strokeWidth="5" className="stroke-muted" />
        <path
          d={RING}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - shown}
          className="stroke-primary transition-all duration-300 motion-reduce:transition-none"
        />
      </svg>
      <span className="text-base font-medium tabular-nums">{shown} %</span>
    </div>
  )
}
