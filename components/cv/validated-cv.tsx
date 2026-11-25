"use client"

import { BadgeCheckIcon, FileTextIcon } from "lucide-react"
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@/components/ui/attachment"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { FileFacts } from "@/components/cv/validation-flow"

/**
 * Pantalla de un CV que ya se validó (al volver o recargar la página): la tarjeta del archivo, con su afinidad ATS, en el centro, y el botón para
 * seguir con las ofertas. «Cambiar» empieza de nuevo (subir y validar otro CV).
 */
export function ValidatedCv({ file, onChangeFile, onContinue }: { file: FileFacts; onChangeFile: () => void; onContinue: () => void }) {
  return (
    <section aria-label="Tu CV validado" className="mx-auto flex w-full max-w-sm flex-col items-stretch gap-6">
      {/* Sello sólido de «hecho», con lo que pasó: se subió, se analizó y la persona lo validó. */}
      <div className="flex flex-col items-center gap-3 text-center">
        <BadgeCheckIcon aria-hidden className="size-12 fill-foreground stroke-background" />
        <div className="flex flex-col gap-1">
          <h1 className="text-base leading-snug font-medium">Tu CV se subió y se analizó sin problemas</h1>
          <p className="text-sm leading-snug text-muted-foreground">Ya validaste tus datos. Con este CV comparamos las ofertas y armamos tus CV para cada una.</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {file.ats && (
          <div>
            <Badge variant={file.ats.good ? "default" : "outline"} title="Mide el formato de tu archivo original según guías públicas de ATS; no garantiza que un ATS concreto lo acepte.">
              {`Afinidad con ATS · ${file.ats.percent} %`}
            </Badge>
          </div>
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
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onChangeFile}>
              Cambiar
            </Button>
          </AttachmentActions>
        </Attachment>
      </div>
      <Button className="w-full" onClick={onContinue}>
        Continuar a Oferta
      </Button>
    </section>
  )
}
