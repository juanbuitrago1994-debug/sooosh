"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { FileTextIcon, UploadIcon } from "lucide-react"
import { CvMotion, type CvMotionState } from "@/components/ai/cv-motion"
import { LoadingState } from "@/components/ai/loading-state"
import { AtsVersion } from "@/components/jobs/ats-version"
import { parseCvFileSafe } from "@/components/jobs/parse-cv-file"
import type { SheetShell } from "@/components/jobs/responsive-sheet"
import { Beam } from "@/components/magic/beam"
import { CvStage } from "@/components/magic/cv-stage"
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle, AttachmentTrigger } from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { clearSearchProfile, setSearchProfile, useSearchProfile } from "@/lib/profile/search-profile"
import { ACCEPT_LABEL, validateFile } from "@/lib/uploads"

/**
 * Panel «Mi CV»: el CV con el que se compara cada oferta (elección explícita; las adaptaciones a otros CV no lo cambian) y, debajo, su
 * versión ATS. Arriba, un CV animado que cuenta el estado (reposo, trabajando, listo). Espaciado de panel: 24 px entre bloques y 8 px
 * dentro de cada bloque; el título y la descripción van dentro de la zona con scroll.
 */
export function SearchProfilePanel({ shell, onBusyChange }: { shell: SheetShell; onBusyChange?: (busy: boolean) => void }) {
  const { Header, Title, Description } = shell
  const profile = useSearchProfile()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState("")
  const [error, setError] = useState("")
  const [atsMotion, setAtsMotion] = useState<CvMotionState>("idle")

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const invalid = validateFile({ name: file.name, size: file.size })
    if (invalid) {
      setError(invalid)
      return
    }
    setBusy(true)
    onBusyChange?.(true)
    setError("")
    try {
      const r = await parseCvFileSafe(file, setStage)
      setSearchProfile(r.cv, r.fileId, r.sourceText)
      toast.success("CV listo: ya ves el encaje de cada oferta")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      onBusyChange?.(false)
      setStage("")
      if (input.current) input.current.value = ""
    }
  }

  const picker = (
    <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-hidden accept={`.${["pdf", "docx", "doc", "odt", "rtf", "txt", "md", "jpg", "jpeg", "png"].join(",.")}`} onChange={(e) => void onFile(e.target.files?.[0])} />
  )

  const motionState: CvMotionState = busy ? "working" : profile ? atsMotion : "idle"
  const working = busy || atsMotion === "working"

  const steps = ["Sube tu CV: se lee en tu equipo.", "Generamos una versión que los filtros de selección leen sin errores.", "La verificas y la descargas en PDF y Word."]

  return (
    // El haz recorre el borde de todo el panel mientras la IA trabaja; en reposo está apagado.
    <Beam active={working} size="md" className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto rounded-xl border">
        {picker}
        {busy ? (
          // Regla de las hojas con carga: mientras se lee el CV, solo el cargador con el avance real (o frases genéricas), centrado.
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
            <Header className="sr-only">
              <Title>Mi CV</Title>
              <Description>Leyendo tu CV.</Description>
            </Header>
            <CvMotion state="working" />
            <LoadingState messages={stage ? [stage] : ["Leyendo tu CV…", "Reconociendo tu experiencia…", "Preparando el encaje…"]} />
          </div>
        ) : (
          <>
            <CvStage state={motionState} />
            <div className="relative -mt-16 flex flex-col gap-6 px-4 pb-4">
              <Header className="flex flex-col items-center gap-2 p-0 text-center">
                <Title className="text-lg font-medium">Mi CV</Title>
                <Description className="text-sm text-muted-foreground">Con él comparamos cada oferta. Se lee en tu equipo. {ACCEPT_LABEL}.</Description>
              </Header>

              {profile ? (
                <>
                  <Attachment state="done" className="w-full">
                    <AttachmentMedia>
                      <FileTextIcon />
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>{profile.label}</AttachmentTitle>
                      <AttachmentDescription>El CV con el que comparamos las ofertas</AttachmentDescription>
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
                  <AtsVersion key={profile.updatedAt} cv={profile.cv} sourceText={profile.sourceText} onMotion={setAtsMotion} />
                </>
              ) : (
                <>
                  <ol className="flex flex-col gap-2 text-sm">
                    {steps.map((t, i) => (
                      <li key={t} className="flex items-start gap-3">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full border text-xs text-muted-foreground">{i + 1}</span>
                        <span className="text-muted-foreground">{t}</span>
                      </li>
                    ))}
                  </ol>
                  {/* Estado vacío: el recuadro de subida «respira» con un resplandor interior suave y acepta soltar el archivo encima. */}
                  <Beam size="pulse-inner" className="w-full">
                    <Attachment
                      state="idle"
                      className="w-full justify-center py-6"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        void onFile(e.dataTransfer.files?.[0])
                      }}
                    >
                      <AttachmentTrigger aria-label="Subir mi CV" onClick={() => input.current?.click()} />
                      <AttachmentMedia>
                        <UploadIcon />
                      </AttachmentMedia>
                      <AttachmentContent>
                        <AttachmentTitle>Sube tu CV</AttachmentTitle>
                        <AttachmentDescription>Haz clic o suelta el archivo aquí</AttachmentDescription>
                      </AttachmentContent>
                    </Attachment>
                  </Beam>
                </>
              )}

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Beam>
  )
}
