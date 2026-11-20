"use client"

import { useState } from "react"
import { XIcon } from "lucide-react"
import { toast } from "sonner"
import { PrivacyDialog } from "@/components/privacy/privacy-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { decide, dismissAsk, shouldAsk, useConsent } from "@/lib/events/consent"

/**
 * Franja para pedir permiso de medición: aparece tras la primera búsqueda, sin tapar los resultados. Sin respuesta no se guarda nada;
 * si se cierra sin elegir, vuelve una vez la semana siguiente y luego no insiste.
 */
export function ConsentBanner() {
  const c = useConsent()
  const [personal, setPersonal] = useState(false)
  const [aggregate, setAggregate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [details, setDetails] = useState(false)
  // `shouldAsk` lee la fecha; solo se evalúa en el navegador (en el servidor `useConsent` devuelve vacío y no hay primera búsqueda).
  const visible = shouldAsk(c)
  const custom = personal || aggregate

  const choose = async (p: boolean, a: boolean) => {
    setBusy(true)
    const ok = await decide(p, a)
    setBusy(false)
    if (!ok) toast.error("No pudimos guardar tu elección. Inténtalo de nuevo.")
    else if (p || a) toast.success("Gracias: usaremos lo que haces para mejorar tus resultados")
  }

  return (
    <>
      {visible && (
        <div role="region" aria-label="Permiso de medición" className="fixed inset-x-0 bottom-0 z-40 border-t border-border/40 bg-background px-4 py-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Mejora tus recomendaciones</p>
                <p className="text-sm text-muted-foreground">Podemos recordar qué buscas, qué abres y a qué postulas para mostrarte primero lo que más te sirve. No guardamos tu CV ni tu nombre.</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Cerrar sin elegir" onClick={dismissAsk}>
                <XIcon aria-hidden />
              </Button>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={personal} onCheckedChange={(v) => setPersonal(v === true)} />
                Para mí: ordenar mejor las ofertas según lo que hago
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={aggregate} onCheckedChange={(v) => setAggregate(v === true)} />
                Para todos: sumar mis búsquedas a estadísticas anónimas de mercado
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={busy} onClick={() => void choose(custom ? personal : true, custom ? aggregate : true)}>
                {custom ? "Guardar mi elección" : "Aceptar las dos"}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void choose(false, false)}>
                Solo lo necesario
              </Button>
              <Button variant="ghost" className="text-muted-foreground" onClick={() => setDetails(true)}>
                Ver qué guardamos
              </Button>
            </div>
          </div>
        </div>
      )}
      <PrivacyDialog open={details} onOpenChange={setDetails} />
    </>
  )
}
