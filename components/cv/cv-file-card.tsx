"use client"

import { useState } from "react"
import { FileTextIcon } from "lucide-react"
import { ChangeCvDialog } from "@/components/cv/change-cv-dialog"
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { formatBytes } from "@/lib/uploads"
import { cn } from "cn"

export type CvFile = {
  /** nombre original del archivo, con su extensión */
  name: string
  /** «DOCX · 12 KB · leído en 1 s» (se arma con `cvFileDetail`) */
  detail: string
  /** afinidad del archivo original con el formato ATS: `undefined` = midiendo, `null` = no hay medida */
  ats?: { percent: number } | null
}

/** Segunda línea de la tarjeta: tipo, peso y lo que tardó la lectura. Sin archivo (CV reabierto) lo dice, sin inventar datos. */
export function cvFileDetail(file?: { type: string; size: number }, readMs?: number): string {
  const base = file && file.size > 0 ? `${file.type} · ${formatBytes(file.size)}` : file?.type || "Reabierto desde el historial"
  return readMs ? `${base} · leído en ${Math.max(1, Math.round(readMs / 1000))} s` : base
}

/**
 * LA tarjeta del CV de la persona: la única que se usa para mostrar su CV en cualquier pantalla (contrato en `docs/DESIGN-PATTERNS.md`,
 * «Tarjeta del CV»). Afinidad ATS arriba, archivo en medio y «Cambiar», que siempre pide confirmación antes de reemplazar el CV.
 */
export function CvFileCard({ file, onChange, changeHref, atsAlign = "center", className }: { file: CvFile; /** alineación de la línea de afinidad; «start» solo en la validación del journey */ atsAlign?: "center" | "start"; /** se ejecuta al confirmar el cambio */ onChange: () => void; /** a dónde se va al confirmar, si hay que salir de la pantalla */ changeHref?: string; className?: string }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      {file.ats !== null && (
        <p className={cn("flex items-center gap-2 text-xs text-muted-foreground/80", atsAlign === "center" ? "justify-center" : "justify-start")} title="Mide el formato de tu archivo original según guías públicas de ATS; no garantiza que un ATS concreto lo acepte.">
          {!file.ats && <Spinner />}
          {file.ats ? `Afinidad ATS · ${file.ats.percent} %` : "Midiendo afinidad ATS"}
        </p>
      )}
      <Attachment state="done" className="w-full">
        <AttachmentMedia>
          <FileTextIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{file.name}</AttachmentTitle>
          <AttachmentDescription>{file.detail}</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirming(true)}>
            Cambiar
          </Button>
        </AttachmentActions>
      </Attachment>
      <ChangeCvDialog open={confirming} onOpenChange={setConfirming} onConfirm={onChange} confirmHref={changeHref} />
    </div>
  )
}
