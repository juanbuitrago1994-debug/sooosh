"use client"

import { CheckIcon, EqualIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * Antes de completar el perfil con un CV leído: qué se llenará y qué se conserva. Nunca se borra ni se reemplaza lo que la persona ya escribió;
 * el aviso existe para que lo vea y decida (docs/INCIDENTES.md: no perder datos importantes).
 */
export function FillConfirmDialog({ plan, onConfirm, onCancel }: { plan: { fills: string[]; keeps: string[] } | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog open={!!plan} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Esto es lo que vamos a completar</DialogTitle>
          <DialogDescription>Leímos tu CV y trae datos que a tu perfil le faltan. No se borra ni se cambia nada de lo que ya escribiste.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-6 overflow-y-auto">
          {plan && plan.fills.length > 0 && (
            <section aria-label="Se completará" className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Se completará</h3>
              <ul className="flex flex-col gap-1">
                {plan.fills.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {plan && plan.keeps.length > 0 && (
            <section aria-label="Se conserva lo tuyo" className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Se conserva lo tuyo</h3>
              <p className="text-xs text-muted-foreground">Este CV trae contenido distinto en estos puntos, pero tus datos se quedan como están.</p>
              <ul className="flex flex-col gap-1">
                {plan.keeps.map((k) => (
                  <li key={k} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <EqualIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {k}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onConfirm}>Completar mi perfil</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
