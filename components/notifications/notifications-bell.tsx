"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BellIcon } from "lucide-react"
import { getBell, readAllNotifications, readNotification } from "@/app/notificaciones/actions"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import type { Notification } from "@/lib/alerts/notifications"
import { NAV_POPOVER_OFFSET } from "@/lib/nav"
import { ago } from "@/lib/tracking/relative"

const REFRESH_MS = 5 * 60_000

/** Campana de la cabecera: cuántas notificaciones sin leer y las últimas 5. Se refresca al abrir la app, al volver a ella y cada 5 minutos. */
export function NotificationsBell() {
  const [data, setData] = useState<{ unread: number; items: Notification[] } | null>(null)
  const [open, setOpen] = useState(false)
  const refresh = useCallback(() => void getBell().then((d) => d && setData(d)).catch(() => {}), [])

  useEffect(() => {
    refresh()
    const tick = setInterval(() => document.visibilityState === "visible" && refresh(), REFRESH_MS)
    const onVisible = () => document.visibilityState === "visible" && refresh()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(tick)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refresh])

  const unread = data?.unread ?? 0
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) refresh()
      }}
    >
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"} />}>
        <BellIcon aria-hidden />
        {unread > 0 && (
          <Badge aria-hidden className="absolute -top-0.5 -right-0.5 h-4 min-w-5 justify-center rounded-full border-2 border-background px-1 text-xs tabular-nums">
            {unread > 99 ? "99+" : unread}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={NAV_POPOVER_OFFSET} className="w-80 gap-3">
        <PopoverHeader className="flex-row items-center justify-between">
          <PopoverTitle>Notificaciones</PopoverTitle>
          {unread > 0 && (
            <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => void readAllNotifications().then(refresh)}>
              Marcar todas como leídas
            </Button>
          )}
        </PopoverHeader>
        {data && data.items.length === 0 && <p className="py-2 text-sm text-muted-foreground">Aún no tienes notificaciones. Te avisaremos aquí cuando aparezcan ofertas nuevas que cumplan tus alertas.</p>}
        <ul className="flex flex-col">
          {data?.items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.href}
                onClick={() => {
                  setOpen(false)
                  void readNotification(n.id, n.href).then(refresh)
                }}
                className="flex flex-col gap-0.5 rounded-lg px-2 py-2 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex items-start gap-2 text-sm font-medium">
                  {!n.read && <span aria-label="Sin leer" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                  {n.title}
                </span>
                {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                  {ago(n.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/notificaciones" onClick={() => setOpen(false)} className={buttonVariants({ className: "w-full" })}>
          Ver todas
        </Link>
      </PopoverContent>
    </Popover>
  )
}
