import type { Metadata } from "next"
import { StickyHeader } from "@/components/common/sticky-header"
import Link from "next/link"
import { Suspense } from "react"
import { ListSkeleton } from "@/components/common/list-skeleton"
import { ArrowLeftIcon } from "lucide-react"
import { NotificationsCenter } from "@/components/notifications/notifications-center"
import { buttonVariants } from "@/components/ui/button"
import { ensureDefaultAlert, listAlerts, touchAlerts } from "@/lib/alerts/engine"
import { listNotifications } from "@/lib/alerts/notifications"
import { getSession, requireProfile } from "@/lib/auth/session"
import { getDb } from "@/lib/db"

export const metadata: Metadata = { title: "Notificaciones · Sooosh", robots: { index: false, follow: false } }

async function Center({ searchParams }: { searchParams: PageProps<"/notificaciones">["searchParams"] }) {
  const { user } = await requireProfile()
  const { tab } = await searchParams
  const db = getDb()
  // La sesión ya dice si la alerta inicial existe (casi nunca hace falta crearla); lo demás es independiente y se pide a la vez.
  if (!(await getSession())?.alertsSeeded) await ensureDefaultAlert(db, user.id).catch(() => false)
  // Abrir el centro de notificaciones cuenta como actividad: las alertas no se pausan por inactividad.
  const [notifications, alerts] = await Promise.all([listNotifications(db, user.id, 50), listAlerts(db, user.id), touchAlerts(db, user.id).catch(() => {})])
  return <NotificationsCenter notifications={notifications} alerts={alerts} initialTab={tab === "alertas" ? "alertas" : "notificaciones"} />
}

export default function NotificacionesPage(props: PageProps<"/notificaciones">) {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <StickyHeader>
        <div className="mx-auto flex w-full max-w-2xl items-center gap-1 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Volver" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeftIcon aria-hidden />
        </Link>
        <h1 className="px-1 text-sm font-medium">Notificaciones</h1>
      </div>
      </StickyHeader>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-4 pb-12 sm:px-6">
        <Suspense fallback={<ListSkeleton />}>
          <Center searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  )
}
