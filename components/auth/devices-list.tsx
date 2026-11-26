"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { revokeDevice } from "@/app/cuenta/actions"
import { clearLocalAccountData } from "@/lib/auth/local-data"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export type DeviceRow = { id: string; label: string; remember: boolean; lastSeenAt: string; current: boolean }

const ago = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (min < 2) return "hace un momento"
  if (min < 60) return `hace ${min} min`
  if (min < 1440) return `hace ${Math.round(min / 60)} h`
  return `hace ${Math.round(min / 1440)} d`
}

/** Dispositivos con sesión abierta. Cerrar uno revoca su acceso de inmediato; si es este, vuelve al login. */
export function DevicesList({ devices }: { devices: DeviceRow[] }) {
  const [pending, start] = useTransition()
  const close = (d: DeviceRow) =>
    start(async () => {
      const r = await revokeDevice(d.id)
      if (!r.ok) return void toast.error("No pudimos cerrar esa sesión. Inténtalo de nuevo.")
      if (r.self) return void (clearLocalAccountData({ silent: true }), window.location.assign("/login"))
      toast.success("Sesión cerrada en ese dispositivo")
    })
  return (
    <ul className="flex flex-col gap-2">
      {devices.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {d.label || "Dispositivo"}
              {d.current && <span className="font-normal text-muted-foreground"> · este dispositivo</span>}
            </span>
            <span className="text-xs text-muted-foreground">
              Último uso {ago(d.lastSeenAt)} · {d.remember ? "sesión mantenida" : "solo mientras el navegador esté abierto"}
            </span>
          </div>
          {!d.current && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => close(d)}>
              {pending && <Spinner />}
              Cerrar sesión
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
