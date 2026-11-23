"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { CvMotion, type CvMotionState } from "@/components/ai/cv-motion"
import { LoadingState } from "@/components/ai/loading-state"
import { AtsVersion } from "@/components/jobs/ats-version"
import { parseCvFileSafe } from "@/components/jobs/parse-cv-file"
import type { SheetShell } from "@/components/jobs/responsive-sheet"
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
      setSearchProfile(r.cv, r.fileId)
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
      {picker}
      <div className="flex justify-center rounded-lg bg-muted/40 py-6">
        <CvMotion state={motionState} />
      </div>

      <Header className="flex flex-col gap-2 p-0 text-left">
        <Title className="text-lg font-medium">Mi CV</Title>
        <Description className="text-sm text-muted-foreground">Con él comparamos cada oferta. Se lee en tu equipo. {ACCEPT_LABEL}.</Description>
      </Header>

      {busy ? (
        // Mientras se lee el CV, solo el avance real de la lectura (o, mientras llega, frases genéricas).
        <LoadingState className="justify-start" messages={stage ? [stage] : ["Leyendo tu CV…", "Reconociendo tu experiencia…", "Preparando el encaje…"]} />
      ) : profile ? (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <p className="min-w-0 flex-1 font-medium">{profile.label}</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => input.current?.click()}>
                Cambiar CV
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearSearchProfile}>
                Quitar
              </Button>
            </div>
          </div>
          <Separator />
          <AtsVersion key={profile.updatedAt} cv={profile.cv} onMotion={setAtsMotion} />
        </>
      ) : (
        <Button className="self-start" onClick={() => input.current?.click()}>
          Subir mi CV
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
