"use client"

import { CvFileCard } from "@/components/cv/cv-file-card"
import type { FileFacts } from "@/components/cv/validation-flow"
import { VerifyIcon } from "@/components/cv/verify-icon"
import { Button } from "@/components/ui/button"

/**
 * Pantalla de inicio con el CV adjunto: un CV que ya se validó (al volver o recargar la página) o uno que aún no (al salir de la validación o pulsar el logo): la tarjeta del CV (`CvFileCard`) en el centro y el botón para seguir con las
 * ofertas. «Cambiar» empieza de nuevo (subir y validar otro CV).
 */
export function ValidatedCv({ file, onChangeFile, onContinue, validated = true, onValidate }: { file: FileFacts; onChangeFile: () => void; onContinue: () => void; /** si el CV ya se validó; si no, esta pantalla es el inicio con el CV adjunto y ofrece validarlo */ validated?: boolean; onValidate?: () => void }) {
  return (
    <section aria-label="Tu CV validado" className="mx-auto my-auto flex w-full max-w-sm flex-col items-stretch gap-6">
      {/* Sello sólido de «hecho», con lo que pasó: se subió, se analizó y la persona lo validó. */}
      <div className="flex flex-col items-center gap-3 text-center">
        <VerifyIcon aria-hidden className="size-11 fill-foreground" />
        <div className="flex flex-col gap-1">
          <h1 className="text-base leading-snug font-medium">{validated ? "Tu CV se subió y se analizó sin problemas" : "Tu CV está adjunto"}</h1>
          <p className="text-sm leading-snug text-muted-foreground">{validated ? "Ya validaste tus datos. Con este CV comparamos las ofertas y armamos tus CV para cada una." : "Aún no validaste sus datos. Revísalos para que comparemos las ofertas y armemos tus CV para cada una."}</p>
        </div>
      </div>
      <CvFileCard file={file} onChange={onChangeFile} />
      {validated ? (
        <Button className="w-full" onClick={onContinue}>
          Continuar a Oferta
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={onValidate}>
            Validar mis datos
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onContinue}>
            Continuar sin validar
          </Button>
        </div>
      )}
    </section>
  )
}
