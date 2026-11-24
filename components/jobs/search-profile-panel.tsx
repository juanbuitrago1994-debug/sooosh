"use client"

import { useRef, useState } from "react"
import { FileTextIcon, UploadIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { toast } from "sonner"
import { LoadingState } from "@/components/ai/loading-state"
import { AtsVersion } from "@/components/jobs/ats-version"
import { Beam } from "@/components/magic/beam"
import { FloatingDrawerContent } from "@/components/jobs/floating-drawer"
import { parseCvFileSafe } from "@/components/jobs/parse-cv-file"
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle, AttachmentTrigger } from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Separator } from "@/components/ui/separator"
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
          // Regla de las hojas con carga: mientras se lee el CV, solo el cargador con el avance real, centrado.
          <div className="flex flex-1 flex-col items-center justify-center">
            <Header className="sr-only">
              <Title>Mi CV</Title>
              <Description>Leyendo tu CV.</Description>
            </Header>
            <LoadingState messages={stage ? [stage] : ["Leyendo tu CV…", "Reconociendo tu experiencia…", "Preparando el encaje…"]} />
          </div>
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
                <AttachmentMedia className="w-14">
                  <UploadIcon />
                </AttachmentMedia>
                <Header className="flex flex-col items-center gap-1 p-0 text-center">
                  <Title>Sube tu CV</Title>
                  <Description>Arrastra el archivo o haz clic</Description>
                </Header>
                <AttachmentDescription className="whitespace-normal">PDF, Word o imagen</AttachmentDescription>
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
        {dragging && (
          // El haz recorre el borde del panel solo mientras hay un archivo encima (única aparición del beam en este panel).
          <motion.div
            data-drop-overlay
            aria-hidden
            className="pointer-events-none absolute inset-2"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: MOTION.offset, filter: `blur(${MOTION.blur}px)` }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: TRANSITION_IN }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -MOTION.offset, filter: `blur(${MOTION.blur}px)`, transition: TRANSITION_OUT }}
          >
            {/* Intensidad 3: con la de siempre (0,5 en oscuro) las capas del haz quedaban al 6–10 % de opacidad y no se veía; medido en el navegador, con 3 suben al 63 % y 39 %. */}
            <Beam size="md" strength={3} className="flex h-full w-full">
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/40 text-center">
                <UploadIcon className="size-6" />
                <p className="text-sm font-medium">Suelta tu CV aquí</p>
                <p className="text-xs text-muted-foreground">Un solo archivo</p>
              </div>
            </Beam>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
