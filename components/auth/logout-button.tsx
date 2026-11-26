"use client"

import { useState } from "react"
import { LogOutIcon } from "lucide-react"
import { clearLocalAccountData } from "@/lib/auth/local-data"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

/** Cierra la sesión de ESTE dispositivo y lleva al login. */
export function LogoutButton() {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="outline"
      className="w-fit"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await fetch("/auth/salir", { method: "POST" }).catch(() => {})
        clearLocalAccountData({ silent: true })
        window.location.assign("/login") // recarga completa a propósito: no debe quedar estado de la sesión anterior
      }}
    >
      {busy ? <Spinner /> : <LogOutIcon aria-hidden />}
      Cerrar sesión
    </Button>
  )
}
