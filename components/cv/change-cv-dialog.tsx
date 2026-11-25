"use client"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

/** Texto de la advertencia al cambiar de CV (el mismo en el asistente y en el panel «Mi CV» de las ofertas). */
export const CHANGE_CV_COPY = {
  title: "¿Cambiar tu CV?",
  description: "Tendrás que subir y validar un CV nuevo. Las ofertas se compararán con el nuevo CV, así que las afinidades de ahora dejarán de valer. Los CV que ya generaste se conservan en «Tus CV por oferta», pero seguirán basados en el CV anterior.",
} as const

/** Confirmación (AlertDialog de shadcn) antes de reemplazar el CV. */
export function ChangeCvDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{CHANGE_CV_COPY.title}</AlertDialogTitle>
          <AlertDialogDescription>{CHANGE_CV_COPY.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Cambiar CV</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
