"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Cabecera de página fija arriba. Al hacer scroll pasa del fondo de la página a un `bg-card` casi
 * transparente con desenfoque y una línea inferior tenue, para que se note que es la zona de «volver».
 * Un centinela de 1 px (IntersectionObserver) detecta el scroll sin escuchar eventos.
 */
export function StickyHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  const sentinel = React.useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinel} aria-hidden className="-mb-px h-px w-full" />
      <header
        data-scrolled={scrolled}
        className={cn(
          "sticky top-0 z-10 w-full border-b border-transparent bg-background motion-safe:transition-colors motion-safe:duration-200",
          "data-[scrolled=true]:border-border/50 data-[scrolled=true]:bg-card/40 data-[scrolled=true]:backdrop-blur-md",
          className,
        )}
      >
        {children}
      </header>
    </>
  )
}
