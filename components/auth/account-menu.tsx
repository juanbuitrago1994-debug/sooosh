"use client"

import { useState } from "react"
import Link from "next/link"
import { BookmarkIcon, LogOutIcon, SettingsIcon } from "lucide-react"
import { whoAmI } from "@/app/cuenta/actions"
import { initialsOf as initials } from "@/lib/auth/last-user"
import { clearLocalAccountData } from "@/lib/auth/local-data"
import { NAV_POPOVER_OFFSET } from "@/lib/nav"
import { useAccountName } from "@/components/auth/account-context"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"


/** Menú de la cuenta (en todas las cabeceras): quién eres, Ajustes y «Cerrar sesión» en este dispositivo. */
export function AccountMenu() {
  const [me, setMe] = useState<{ name: string; email: string } | null>(null)
  const [leaving, setLeaving] = useState(false)
  // Las iniciales vienen del servidor (siempre visibles); el correo se pide al abrir el menú.
  const name = useAccountName() ?? me?.name ?? ""

  async function logout() {
    setLeaving(true)
    await fetch("/auth/salir", { method: "POST" }).catch(() => {})
    clearLocalAccountData({ silent: true })
    window.location.assign("/login") // recarga completa a propósito: no debe quedar estado de la sesión anterior
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && void whoAmI().then(setMe).catch(() => {})}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Mi cuenta" className="text-xs font-medium" />}>
        {initials(name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={NAV_POPOVER_OFFSET} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">{name || "Mi cuenta"}</span>
            {me?.email && <span className="truncate text-xs font-normal text-muted-foreground">{me.email}</span>}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/mis-ofertas" />}>
          <BookmarkIcon aria-hidden />
          Mis ofertas
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/ajustes" />}>
          <SettingsIcon aria-hidden />
          Ajustes
        </DropdownMenuItem>
        <DropdownMenuItem disabled={leaving} onClick={() => void logout()}>
          <LogOutIcon aria-hidden />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
