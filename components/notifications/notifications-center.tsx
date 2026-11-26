"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { BellIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { readAllNotifications, readNotification, removeAlert, toggleAlert } from "@/app/notificaciones/actions"
import { AlertSheet } from "@/components/notifications/alert-sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Alert } from "@/lib/alerts/engine"
import { FREQUENCIES, MAX_ALERTS, describeFilters } from "@/lib/alerts/filters"
import type { Notification } from "@/lib/alerts/notifications"
import { ago } from "@/lib/tracking/relative"

function NotificationsList({ items }: { items: Notification[] }) {
  const [pending, start] = useTransition()
  const unread = items.filter((n) => !n.read).length
  if (items.length === 0)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BellIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Aún no tienes notificaciones</EmptyTitle>
          <EmptyDescription>Te avisaremos aquí cuando aparezcan ofertas nuevas que cumplan tus alertas, o cuando una oferta que guardaste cierre.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return (
    <div className="flex flex-col gap-2">
      {unread > 0 && (
        <Button variant="ghost" size="sm" className="self-end text-muted-foreground" disabled={pending} onClick={() => start(() => void readAllNotifications())}>
          Marcar todas como leídas
        </Button>
      )}
      <ul className="flex flex-col divide-y">
        {items.map((n) => (
          <li key={n.id}>
            <Link href={n.href} onClick={() => void readNotification(n.id, n.href)} className="flex flex-col gap-0.5 py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="flex items-start gap-2 text-sm font-medium">
                {!n.read && <span aria-label="Sin leer" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                {n.title}
              </span>
              {n.body && <span className="text-sm text-muted-foreground">{n.body}</span>}
              <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                {ago(n.createdAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AlertRow({ alert, onEdit }: { alert: Alert; onEdit: () => void }) {
  const [pending, start] = useTransition()
  const [deleting, setDeleting] = useState(false)
  const freq = FREQUENCIES.find((f) => f.value === alert.frequency)?.label
  const chips = describeFilters(alert.filters)
  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-medium">{alert.name}</h3>
          <p className="text-xs text-muted-foreground">
            {freq}
            {alert.pausedReason === "inactiva" ? " · Pausada: llevabas 30 días sin abrir tus notificaciones" : !alert.enabled ? " · Pausada" : ""}
          </p>
        </div>
        <Switch
          checked={alert.enabled}
          disabled={pending}
          aria-label={alert.enabled ? `Pausar la alerta ${alert.name}` : `Activar la alerta ${alert.name}`}
          onCheckedChange={(v) =>
            start(async () => {
              if (!(await toggleAlert(alert.id, v))) toast.error("No pudimos cambiar la alerta. Inténtalo de nuevo.")
            })
          }
        />
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Condiciones de la alerta">
        {chips.map((c, i) => (
          <li key={`${c}-${i}`}>
            <Badge variant="outline">{c}</Badge>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/alertas/${alert.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Ver ofertas encontradas
        </Link>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onEdit}>
          Editar
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setDeleting(true)}>
          Eliminar
        </Button>
      </div>
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{alert.name}»?</AlertDialogTitle>
            <AlertDialogDescription>Dejarás de recibir avisos de esta alerta. Las ofertas que ya guardaste no se tocan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                start(async () => {
                  if (!(await removeAlert(alert.id))) toast.error("No pudimos eliminar la alerta. Inténtalo de nuevo.")
                })
              }
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

/** Centro de notificaciones: lo que te avisamos y las alertas que tú defines. */
export function NotificationsCenter({ notifications, alerts, initialTab = "notificaciones" }: { notifications: Notification[]; alerts: Alert[]; initialTab?: "notificaciones" | "alertas" }) {
  const [editing, setEditing] = useState<{ alert: Alert | null; n: number } | null>(null)
  const unread = notifications.filter((n) => !n.read).length
  return (
    <Tabs defaultValue={initialTab} className="gap-6">
      <TabsList>
        <TabsTrigger value="notificaciones">Notificaciones{unread > 0 ? ` (${unread})` : ""}</TabsTrigger>
        <TabsTrigger value="alertas">Mis alertas</TabsTrigger>
      </TabsList>
      <TabsContent value="notificaciones">
        <NotificationsList items={notifications} />
      </TabsContent>
      <TabsContent value="alertas" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Defines qué buscas y te avisamos de lo nuevo. {alerts.length} de {MAX_ALERTS}.
          </p>
          <Button variant="outline" size="sm" className="shrink-0" disabled={alerts.length >= MAX_ALERTS} onClick={() => setEditing({ alert: null, n: Date.now() })}>
            <PlusIcon aria-hidden />
            Nueva alerta
          </Button>
        </div>
        {alerts.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No tienes alertas</EmptyTitle>
              <EmptyDescription>Crea una con el país, la modalidad, el contrato o el cargo que buscas y te avisamos cuando aparezcan ofertas nuevas.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col divide-y">
            {alerts.map((a) => (
              <AlertRow key={a.id} alert={a} onEdit={() => setEditing({ alert: a, n: Date.now() })} />
            ))}
          </ul>
        )}
        {editing && <AlertSheet key={editing.n} open onOpenChange={(o) => !o && setEditing(null)} initial={editing.alert} />}
      </TabsContent>
    </Tabs>
  )
}
