"use client"

import type { ComponentProps, CSSProperties } from "react"
import { DrawerContent } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

/**
 * Contenido de un drawer lateral FLOTANTE (el de los asistentes de postulación): separado 12 px de los bordes (`--drawer-inset`), esquinas
 * redondeadas, fondo con blur con tokens del tema y sin la franja de relleno del borde (`--drawer-bleed-background`).
 */
export function FloatingDrawerContent({ className, children, ...props }: ComponentProps<typeof DrawerContent>) {
  return (
    <DrawerContent
      style={{ "--drawer-inset": "0.75rem", "--drawer-bleed-background": "transparent" } as CSSProperties}
      className={cn(
        "top-0 bottom-0 left-0 h-auto w-auto border-border/40 bg-popover/60 backdrop-blur-xl data-[swipe-direction=right]:rounded-2xl data-[swipe-direction=right]:border sm:left-auto sm:w-full sm:max-w-md",
        className,
      )}
      {...props}
    >
      {children}
    </DrawerContent>
  )
}
