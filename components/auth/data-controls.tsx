"use client"

import { useState, useTransition } from "react"
import { DownloadIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { deleteMyAccount } from "@/app/cuenta/actions"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { DELETE_PHRASE } from "@/lib/account/constants"
import { clearLocalAccountData } from "@/lib/auth/local-data"

/** «Tus datos»: llevarte todo en un archivo o borrar la cuenta (con confirmación escrita). */
export function DataControls() {
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState("")
  const [pending, start] = useTransition()
  const ready = phrase.trim().toUpperCase() === DELETE_PHRASE

  const remove = () =>
    start(async () => {
      const r = await deleteMyAccount(phrase)
      if (!r.ok) return void toast.error("No pudimos eliminar tu cuenta. Inténtalo de nuevo.")
      clearLocalAccountData({ silent: true })
      window.location.assign("/login") // recarga completa a propósito: no debe quedar estado de la cuenta borrada
    })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <a href="/auth/exportar" download className={buttonVariants({ variant: "outline" })}>
          <DownloadIcon aria-hidden />
          Descargar mis datos
        </a>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2Icon aria-hidden />
          Eliminar mi cuenta
        </Button>
      </div>
      <AlertDialog open={open} onOpenChange={(o) => (setPhrase(""), setOpen(o))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran para siempre tu perfil, tus CV guardados, tus ofertas y tus dispositivos. No se puede deshacer. Si quieres, descarga tus datos antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="confirm-delete">Escribe {DELETE_PHRASE} para confirmar</FieldLabel>
            <Input id="confirm-delete" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={!ready || pending} onClick={remove}>
              {pending && <Spinner />}
              Eliminar para siempre
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
