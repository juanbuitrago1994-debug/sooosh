"use client"

import { useSyncExternalStore, type ComponentType, type ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"

/** Piezas de cabecera que entrega la hoja (distintas en ventana y en panel inferior). */
export type SheetShell = {
  Header: ComponentType<{ className?: string; children?: ReactNode }>
  Title: ComponentType<{ className?: string; children?: ReactNode }>
  Description: ComponentType<{ className?: string; children?: ReactNode }>
}

// Escritorio: ventana ancha (Dialog). Móvil: panel que sube desde abajo (Drawer). Patrón «Responsive» de shadcn.
const wide = () => (typeof window === "undefined" ? false : window.matchMedia("(min-width: 640px)").matches)
const subscribeWide = (cb: () => void) => {
  const m = window.matchMedia("(min-width: 640px)")
  m.addEventListener("change", cb)
  return () => m.removeEventListener("change", cb)
}
export const useIsWide = () => useSyncExternalStore(subscribeWide, wide, () => false)

/**
 * Hoja de la app (filtros, CV, fuentes): MISMO tamaño en todas para que se sienta una sola familia. Escritorio: ventana de 3xl de ancho y
 * 3/4 de la altura; móvil: panel inferior de 4/5 de la altura. El contenido desplaza dentro; la cabecera no se mueve.
 */
export function ResponsiveSheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: (shell: SheetShell) => ReactNode }) {
  const isWide = useIsWide()
  return isWide ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-3/4 flex-col gap-4 sm:max-w-3xl">{children({ Header: DialogHeader, Title: DialogTitle, Description: DialogDescription })}</DialogContent>
    </Dialog>
  ) : (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-4/5">
        <div className="flex min-h-0 flex-1 flex-col p-4 pt-0">{children({ Header: DrawerHeader, Title: DrawerTitle, Description: DrawerDescription })}</div>
      </DrawerContent>
    </Drawer>
  )
}
