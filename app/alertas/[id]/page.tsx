import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"
import { ArrowLeftIcon } from "lucide-react"
import { ListSkeleton } from "@/components/common/list-skeleton"
import { JobCard } from "@/components/jobs/job-card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { cachedMatchingJobs } from "@/lib/alerts/cached"
import { getAlert, takeUnseen, touchAlerts } from "@/lib/alerts/engine"
import { describeFilters } from "@/lib/alerts/filters"
import { markAlertNotificationsRead } from "@/lib/alerts/notifications"
import { requireProfile } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { savedJobIds } from "@/lib/tracking/collections"

export const metadata: Metadata = { title: "Alerta · Sooosh", robots: { index: false, follow: false } }

async function Results({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireProfile()
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const db = getDb()
  const alert = await getAlert(db, user.id, id)
  if (!alert) notFound()
  // Todo lo demás es independiente: se pide a la vez (cada viaje a la base cuesta ~150 ms). Abrir los resultados cuenta como actividad, deja leídos sus
  // avisos y marca como vistas las ofertas nuevas (que se muestran con su distintivo esta vez); la lista sale de la memoria compartida si está fresca.
  const [unseen, jobs, saved] = await Promise.all([
    takeUnseen(db, id).catch(() => new Set<string>()),
    cachedMatchingJobs(alert.filters, 100),
    savedJobIds(db, user.id).catch(() => [] as string[]),
    touchAlerts(db, user.id, id).catch(() => {}),
    markAlertNotificationsRead(db, user.id, id).catch(() => {}),
  ])
  const savedSet = new Set(saved)
  const chips = describeFilters(alert.filters)
  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{alert.name}</h2>
          <p className="text-xs text-muted-foreground">
            {jobs.length === 0 ? "Ninguna oferta abierta cumple las condiciones ahora." : `${jobs.length === 100 ? "100 o más" : jobs.length} ${jobs.length === 1 ? "oferta abierta cumple" : "ofertas abiertas cumplen"} las condiciones`}
            {unseen.size > 0 ? ` · ${unseen.size} ${unseen.size === 1 ? "nueva" : "nuevas"} desde tu última visita` : ""}
          </p>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Condiciones de la alerta">
          {chips.map((c, i) => (
            <li key={`${c}-${i}`}>
              <Badge variant="outline">{c}</Badge>
            </li>
          ))}
        </ul>
        {alert.pausedReason === "inactiva" && <p className="text-xs text-muted-foreground">Esta alerta está pausada: llevabas 30 días sin abrir tus notificaciones. Reanúdala en «Mis alertas».</p>}
      </div>
      {jobs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Todavía no hay ofertas</EmptyTitle>
            <EmptyDescription>Te avisaremos en cuanto aparezca una. Puedes ampliar las condiciones desde «Mis alertas».</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-4">
          {jobs.map((j) => (
            <JobCard key={j.id} job={{ ...j, isNew: unseen.has(j.id) }} saved={savedSet.has(j.id)} />
          ))}
        </ul>
      )}
    </>
  )
}

export default function AlertaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="flex items-center gap-1 px-4 py-3 sm:px-6">
        <Link href="/notificaciones?tab=alertas" aria-label="Volver a mis alertas" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeftIcon aria-hidden />
        </Link>
        <h1 className="px-1 text-sm font-medium">Ofertas de tu alerta</h1>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-4 pb-12 sm:px-6">
        <Suspense fallback={<ListSkeleton label="Buscando las ofertas de tu alerta" />}>
          <Results params={params} />
        </Suspense>
      </main>
    </div>
  )
}
