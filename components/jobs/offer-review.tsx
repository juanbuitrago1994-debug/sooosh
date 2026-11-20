"use client"

import { CheckIcon, CircleHelpIcon, MinusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { JobDraft } from "@/lib/jobs/draft"
import type { FieldEvidence } from "@/lib/jobs/evidence"
import { clearPatch, fieldValues, type FieldKey } from "@/lib/jobs/field-values"

/**
 * Lista de verificación de la tarjeta: cada dato con su estado y la frase de la oferta de donde sale.
 *  ✓ está en el texto · ? lo deducimos (confírmalo o quítalo) · — la oferta no lo dice. Lo que se cambia en el formulario de abajo
 * aparece aquí como «Editado por ti». Quitar deja el dato como «No indicado».
 */
export function OfferReview({ evidence, draft, confirmed, onConfirm, onClear }: { evidence: FieldEvidence[]; draft: JobDraft; confirmed: ReadonlySet<FieldKey>; onConfirm: (key: FieldKey) => void; onClear: (key: FieldKey, patch: Partial<JobDraft>) => void }) {
  const now = fieldValues(draft)
  return (
    <section className="flex flex-col gap-2" aria-labelledby="verificacion">
      <h3 id="verificacion" className="text-sm font-medium">
        Dato por dato
      </h3>
      <ul className="flex flex-col divide-y divide-border/40">
        {evidence.map((e) => {
          const value = now[e.key]
          const edited = value !== e.value
          const title = e.key === "titulo"
          const done = confirmed.has(e.key) || (title && draft.titleSource === "texto")
          const status = !value ? "falta" : edited ? "editado" : e.status === "inferido" && !done ? "inferido" : "texto"
          const clear = value ? clearPatch(e.key, draft) : null
          return (
            <li key={e.key} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                {status === "falta" ? <MinusIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> : status === "inferido" ? <CircleHelpIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm">
                    <span className="text-muted-foreground">{e.label}: </span>
                    <span className={value ? "font-medium" : "text-muted-foreground"}>{value ?? "No indicado"}</span>
                    <span className="sr-only">
                      {" "}
                      ({status === "texto" ? "está en el texto" : status === "inferido" ? "deducido, por confirmar" : status === "editado" ? "editado por ti" : "no aparece"})
                    </span>
                  </p>
                  {status === "editado" ? (
                    <p className="text-xs text-muted-foreground">Editado por ti</p>
                  ) : status === "falta" ? (
                    <p className="text-xs text-muted-foreground">La oferta no lo dice</p>
                  ) : e.quote ? (
                    <p className="text-xs text-muted-foreground">«{e.quote}»</p>
                  ) : status === "inferido" ? (
                    <p className="text-xs text-muted-foreground">Deducido; no hay una frase que lo diga igual</p>
                  ) : null}
                </div>
              </div>
              {value && (status === "inferido" || clear) && (
                <div className="flex gap-1 pl-6.5 sm:pl-0">
                  {status === "inferido" && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onConfirm(e.key)}>
                      Confirmar
                    </Button>
                  )}
                  {clear && (
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onClear(e.key, clear)}>
                      Quitar
                    </Button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
