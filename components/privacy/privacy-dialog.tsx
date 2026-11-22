"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/motion/motion-switch"
import { decide, eraseMyData, useConsent } from "@/lib/events/consent"
import { RETENTION_DAYS, MIN_DISTINCT_USERS } from "@/lib/events/types"

const SAVED = [
  "Tus búsquedas: región, área, modalidad, orden y el texto (en minúsculas y sin tildes; si parece un dato personal, no se guarda).",
  "Qué ofertas aparecieron en tu pantalla.",
  "Qué ofertas abres, guardas, descartas o adaptas, y a cuáles pulsas «Postular» (y por qué camino).",
]
const NEVER = ["El contenido de tu CV.", "Tu nombre, correo o teléfono.", "Las respuestas que escribas en formularios.", "Tu dirección IP."]

/** Qué se guarda y qué no, con los interruptores para cambiar la elección y el botón de borrar. */
export function PrivacyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const c = useConsent()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const apply = async (personal: boolean, aggregate: boolean) => {
    setBusy(true)
    const ok = await decide(personal, aggregate)
    setBusy(false)
    if (!ok) toast.error("No pudimos guardar tu elección. Inténtalo de nuevo.")
  }

  const erase = async () => {
    setBusy(true)
    const ok = await eraseMyData()
    setBusy(false)
    setConfirm(false)
    if (ok) toast.success("Borramos tus datos y la medición quedó apagada")
    else toast.error("No pudimos borrar tus datos ahora. Inténtalo de nuevo.")
  }

  const hasChoice = c.version !== null
  return (
    <Dialog open={open} onOpenChange={(o) => (setConfirm(false), onOpenChange(o))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Privacidad y medición</DialogTitle>
          <DialogDescription>Tú decides si medimos cómo usas el buscador. Puedes cambiarlo o borrarlo cuando quieras.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-96 flex-col gap-5 overflow-y-auto text-sm">
          <div className="flex flex-col gap-3">
            <label className="flex items-start justify-between gap-3">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Para mí</span>
                <span className="text-muted-foreground">Ordenar mejor las ofertas según lo que hago.</span>
              </span>
              <Switch checked={c.personal} disabled={busy} onCheckedChange={(v) => void apply(v, c.aggregate)} aria-label="Medición para mí" />
            </label>
            <label className="flex items-start justify-between gap-3">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Para todos</span>
                <span className="text-muted-foreground">Sumar mis búsquedas a estadísticas anónimas de mercado.</span>
              </span>
              <Switch checked={c.aggregate} disabled={busy} onCheckedChange={(v) => void apply(c.personal, v)} aria-label="Medición para todos" />
            </label>
            {!hasChoice && <p className="text-xs text-muted-foreground">Todavía no elegiste: mientras tanto no se guarda nada.</p>}
          </div>

          <section className="flex flex-col gap-1.5">
            <h3 className="font-medium">Qué guardamos</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
              {SAVED.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className="text-muted-foreground">Todo va con un identificador aleatorio de este navegador, no con tu nombre.</p>
          </section>
          <section className="flex flex-col gap-1.5">
            <h3 className="font-medium">Qué nunca guardamos</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
              {NEVER.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-1.5">
            <h3 className="font-medium">Cuánto tiempo</h3>
            <p className="text-muted-foreground">
              Los eventos individuales se borran a los {RETENTION_DAYS} días. Las estadísticas para todos solo muestran lo que hicieron al menos {MIN_DISTINCT_USERS} personas distintas.
            </p>
          </section>

          <div className="flex flex-col gap-2 border-t border-border/40 pt-4">
            {confirm ? (
              <>
                <p className="text-muted-foreground">Se borra todo lo que guardamos de este navegador y la medición queda apagada. ¿Seguro?</p>
                <div className="flex gap-2">
                  <Button variant="destructive" disabled={busy} onClick={() => void erase()}>
                    Sí, borrar
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="outline" className="self-start" disabled={busy || !c.anonId} onClick={() => setConfirm(true)}>
                Borrar mis datos
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Enlace discreto «Privacidad» que abre el diálogo (siempre disponible, haya o no elegido). */
export function PrivacyLink({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="ghost" size="sm" className={className ?? "text-muted-foreground"} onClick={() => setOpen(true)}>
        Privacidad
      </Button>
      <PrivacyDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
