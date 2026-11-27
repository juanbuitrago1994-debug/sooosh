"use client"

import { useState } from "react"
import Link from "next/link"
import { BrainIcon, SearchIcon } from "lucide-react"
import { AccountMenu } from "@/components/auth/account-menu"
import { NotificationsBell } from "@/components/notifications/notifications-bell"
import { Logo } from "@/components/brand/logo"
import { CvRepository } from "@/components/history/cv-repository"
import { Button, buttonVariants } from "@/components/ui/button"
import type { HistoryEntry } from "@/lib/history"

export type HeaderActions = { onLearning: () => void; /** reabrir una adaptación guardada (desde el repositorio de CV por oferta) */ onReopen: (e: HistoryEntry) => void; /** empezar con una oferta nueva (con el mismo CV validado) */ onNewOffer: () => void; /** ir a la pantalla de inicio (el logo) */ onHome?: () => void }

/** Cabecera mínima de la UI v2: marca pequeña a la izquierda, íconos fantasma a la derecha. Sin caja ni borde. */
export function AppHeader({ actions }: { actions: HeaderActions }) {
  // El amanecer del logo se pliega y vuelve a crecer cuando el puntero entra en toda la marca (logo + nombre), no solo en el ícono.
  const [play, setPlay] = useState(0)
  return (
    <header className="flex items-center justify-between px-4 py-3 sm:px-6">
      <button type="button" aria-label="Ir al inicio" className="-ml-1 flex items-center gap-2 rounded-lg px-1 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50" onPointerEnter={() => setPlay((n) => n + 1)} onClick={actions.onHome}>
        <Logo className="size-5" playTrigger={play} />
        Sooosh
      </button>
      <div className="flex items-center">
        <Link href="/ofertas" aria-label="Buscar ofertas" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <SearchIcon aria-hidden />
        </Link>
        <Button variant="ghost" size="icon" aria-label="Lo que he aprendido" onClick={actions.onLearning}>
          <BrainIcon aria-hidden />
        </Button>
        <CvRepository onReopen={actions.onReopen} onNewOffer={actions.onNewOffer} />
        <NotificationsBell />
        <AccountMenu />
      </div>
    </header>
  )
}

/** Enlace para saltar al contenido (accesibilidad por teclado). */
export function SkipLink() {
  return (
    <a
      href="#contenido"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:ring-3 focus:ring-ring"
    >
      Saltar al contenido
    </a>
  )
}
