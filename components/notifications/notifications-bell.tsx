"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BellIcon, ChevronRightIcon } from "lucide-react"
import { getBell, readAllNotifications, readNotification } from "@/app/notificaciones/actions"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import type { Notification } from "@/lib/alerts/notifications"
import { NAV_POPOVER_OFFSET } from "@/lib/nav"
import { ago } from "@/lib/tracking/relative"

const DAY_MS = 86_400_000

/** Etiqueta del día en hora local: «Hoy», «Ayer», «Esta semana» (últimos 7 días) y «Anteriores». */
function dayLabel(iso: string, now: Date): string {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const t = new Date(iso).getTime()
  if (t >= start) return "Hoy"
  if (t >= start - DAY_MS) return "Ayer"
  if (t >= start - 6 * DAY_MS) return "Esta semana"
  return "Anteriores"
}

function groupByDay(items: Notification[]): { label: string; items: Notification[] }[] {
  const now = new Date()
  const groups: { label: string; items: Notification[] }[] = []
  for (const n of items) {
    const label = dayLabel(n.createdAt, now)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(n)
    else groups.push({ label, items: [n] })
  }
  return groups
}

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
          <span aria-hidden className="absolute top-1.5 right-1.5 size-3 rounded-full border-2 border-background bg-destructive" />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={NAV_POPOVER_OFFSET} className="w-80 gap-2 p-0">
        <PopoverHeader className="px-4 pt-4">
          <PopoverTitle>
            <Link href="/notificaciones" onClick={() => setOpen(false)} className="-mx-1 inline-flex items-center gap-0.5 rounded-sm px-1 outline-none hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
              Notificaciones
              <ChevronRightIcon className="size-4" aria-hidden />
            </Link>
          </PopoverTitle>
        </PopoverHeader>
        {data && data.items.length === 0 && <p className="px-4 py-2 text-sm text-muted-foreground">Aún no tienes notificaciones. Te avisaremos aquí cuando aparezcan ofertas nuevas que cumplan tus alertas.</p>}
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto px-2">
          {groupByDay(data?.items ?? []).map((g) => (
            <section key={g.label} aria-label={g.label} className="flex flex-col">
              <h3 className="px-2 py-1 text-xs font-medium text-muted-foreground">{g.label}</h3>
              <ul className="flex flex-col">
                {g.items.map((n) => (
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
            </section>
          ))}
        </div>
        <div className="p-2 pt-0">
          <Button variant="secondary" className="w-full" disabled={unread === 0} onClick={() => void readAllNotifications().then(refresh)}>
            Marcar todas como leídas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
