"use client"

import { useRef, useState } from "react"
import { FileTextIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { toast } from "sonner"
import { CvDropOverlay } from "@/components/cv/cv-drop-overlay"
import { DropMessage } from "@/components/cv/drop-message"
import { ReadingStatus } from "@/components/cv/reading-status"
import { AtsVersion } from "@/components/jobs/ats-version"
import { FloatingDrawerContent } from "@/components/jobs/floating-drawer"
import { parseCvFileSafe } from "@/components/jobs/parse-cv-file"
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle, AttachmentTrigger } from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Separator } from "@/components/ui/separator"
import { stageIndex } from "@/lib/cv/progress"
import { prefetchExtras } from "@/lib/ats/prefetch"
import { describeDrag, dragHasFiles, dropCopy, fileSummary, friendlyReadError, pickCvFile, type DragInfo } from "@/lib/profile/cv-drop"
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
  // Lo que se ve del archivo mientras se arrastra (cuántos y de qué tipo) y, ya soltado, su nombre, peso y tipo.
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null)
  const [picked, setPicked] = useState<{ name: string; size: number; type: string } | null>(null)
  // Mientras se genera la versión ATS, lo de arriba (título, tarjeta del CV) se retira hacia arriba y quedan solo los pasos.
  const [atsWorking, setAtsWorking] = useState(false)
  // dragenter/dragleave se disparan también al pasar sobre los hijos: se cuenta para no parpadear.
  const depth = useRef(0)

  const onFiles = async (files: ArrayLike<File> | null | undefined) => {
    if (busy) return
    const choice = pickCvFile(files)
    if (!choice.file) {
      setError(choice.error ?? "No llegó ningún archivo.")
      return
    }
    setBusy(true)
    setError("")
    setPicked({ name: choice.file.name, size: choice.file.size, type: choice.file.type })
    try {
      const r = await parseCvFileSafe(choice.file, setStage)
      setSearchProfile(r.cv, r.fileId, r.sourceText)
      prefetchExtras(r.cv, r.sourceText, r.fileId)
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
      setDragInfo(describeDrag(e.dataTransfer?.items))
    },
    onDragOver: (e: React.DragEvent) => {
      if (dragHasFiles(e.dataTransfer?.types)) e.preventDefault()
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!dragHasFiles(e.dataTransfer?.types)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) {
        setDragging(false)
        setDragInfo(null)
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      setDragInfo(null)
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
                {/* Mientras se genera la versión ATS, esta primera parte sube y se oculta; al terminar vuelve a su posición. Siempre montada para animar en los dos sentidos. */}
                <motion.div
                  className="overflow-hidden"
                  aria-hidden={atsWorking}
                  inert={atsWorking}
                  initial={false}
                  animate={atsWorking ? { height: 0, marginBottom: -24 } : { height: "auto", marginBottom: 0 }}
                  transition={reduce ? { duration: 0 } : TRANSITION_IN}
                >
                  {/* El contenido sube entero (su propia altura) mientras se desvanece y desenfoca; el bloque de arriba colapsa y el resto sube con él. */}
                  <motion.div
                    className="flex flex-col gap-6"
                    initial={false}
                    animate={atsWorking ? { y: "-100%", opacity: 0, filter: `blur(${MOTION.blur}px)` } : { y: "0%", opacity: 1, filter: "blur(0px)" }}
                    transition={reduce ? { duration: 0 } : TRANSITION_IN}
                  >
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
                  </motion.div>
                </motion.div>
                <AtsVersion key={profile.updatedAt} cv={profile.cv} sourceText={profile.sourceText} savedExtras={profile.extras} onWorkingChange={setAtsWorking} />
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

      {/* El haz recorre TODO el borde del panel solo mientras hay un archivo encima o se está leyendo el CV; el mensaje va centrado. */}
      <CvDropOverlay show={dragging || busy} hidden={!busy}>
        {busy ? (
          <>
            <ReadingStatus idx={stageIndex(stage)} phrase={stage} />
            {picked && <p className="max-w-xs text-center text-xs break-all text-muted-foreground">{fileSummary(picked)}</p>}
          </>
        ) : (
          <DropMessage title={<p className="text-sm font-medium">{dropCopy(dragInfo).title}</p>} description={<p className="text-sm text-muted-foreground">{dropCopy(dragInfo).description}</p>} />
        )}
      </CvDropOverlay>
    </div>
  )
}

