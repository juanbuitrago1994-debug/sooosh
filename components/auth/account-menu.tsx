"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BookmarkIcon, LogOutIcon, SettingsIcon } from "lucide-react"
import { whoAmI } from "@/app/cuenta/actions"
import { clearLocalAccountData } from "@/lib/auth/local-data"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"

/** Menú de la cuenta (en todas las cabeceras): quién eres, Ajustes y «Cerrar sesión» en este dispositivo. */
export function AccountMenu() {
  const [me, setMe] = useState<{ name: string; email: string } | null>(null)
  const [leaving, setLeaving] = useState(false)
  // Las iniciales se ven desde el principio, no solo al abrir el menú.
  useEffect(() => {
    void whoAmI().then(setMe).catch(() => {})
  }, [])

  async function logout() {
    setLeaving(true)
    await fetch("/auth/salir", { method: "POST" }).catch(() => {})
    clearLocalAccountData({ silent: true })
    window.location.assign("/login") // recarga completa a propósito: no debe quedar estado de la sesión anterior
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && void whoAmI().then(setMe).catch(() => {})}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Mi cuenta" className="text-xs font-medium text-muted-foreground hover:text-foreground aria-expanded:text-foreground" />}>
        {me ? initials(me.name) : <SettingsIcon aria-hidden className="size-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">{me?.name ?? "Mi cuenta"}</span>
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
