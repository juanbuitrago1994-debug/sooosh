"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ai/loading-state"
import { parseCvFileSafe } from "@/components/jobs/parse-cv-file"
import { clearSearchProfile, setSearchProfile, useSearchProfile } from "@/lib/profile/search-profile"
import { ACCEPT_LABEL, validateFile } from "@/lib/uploads"

/**
 * El CV con el que se compara cada oferta. Es una elección explícita: se sube aquí (o se marca en el flujo de adaptación) y las
 * adaptaciones que la persona haga a otros CV no lo cambian.
 */
export function SearchProfilePanel({ onBusyChange }: { onBusyChange?: (busy: boolean) => void } = {}) {
  const profile = useSearchProfile()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState("")
  const [error, setError] = useState("")

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

  if (busy) {
    // Solo el cargador, centrado en la hoja; las frases son el avance real de la lectura (o, mientras llega, unas genéricas).
    return <LoadingState className="flex-1" messages={stage ? [stage] : ["Leyendo tu CV…", "Reconociendo tu experiencia…", "Preparando el encaje…"]} />
  }

  return (
    <div className="flex flex-col gap-2">
      {picker}
      {profile ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <p className="min-w-0 flex-1">
            <span className="font-medium">{profile.label}</span>
          </p>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => input.current?.click()}>
              Cambiar CV
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearSearchProfile}>
              Quitar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Para ver cuánto encaja cada oferta. Se lee en tu equipo. {ACCEPT_LABEL}.</p>
          <Button className="self-start" onClick={() => input.current?.click()}>
            Subir mi CV
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
