"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookmarkIcon, ExternalLinkIcon } from "lucide-react"
import { toast } from "sonner"
import { removeOffer } from "@/app/mis-ofertas/actions"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { savePrefill } from "@/lib/jobs/prefill"
import { ago, groupByCompany } from "@/lib/tracking/relative"
import { companyKey } from "@/lib/tracking/company"
import type { TrackedOffer } from "@/lib/tracking/store"

const STATUS = {
  vigente: { label: "Sigue abierta", variant: "secondary" as const },
  finalizada: { label: "Oferta finalizada", variant: "destructive" as const },
  sin_verificar: { label: "Sin verificar", variant: "outline" as const },
}

function Row({ o }: { o: TrackedOffer }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [now] = useState(() => new Date())
  const s = STATUS[o.status]
  const adapt = () => {
    if (savePrefill(o.offer)) router.push("/")
    else toast.error("No pudimos abrir la oferta para adaptar tu CV.")
  }
  const remove = () =>
    start(async () => {
      if (!(await removeOffer(o.id))) toast.error("No pudimos quitar la oferta. Inténtalo de nuevo.")
    })
  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-medium">{o.title}</h3>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            {o.postedAt ? `Publicada ${ago(o.postedAt, now)}` : "Fecha de publicación no indicada"} · Guardada en Sooosh {ago(o.savedAt, now)}
          </p>
        </div>
        <Badge variant={s.variant} className="shrink-0">
          {s.label}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground" suppressHydrationWarning>
        {o.status === "finalizada"
          ? `Detectamos que cerró ${ago(o.closedDetectedAt, now)}. ${o.checkNote ?? ""}`
          : o.lastCheckedAt
            ? `Revisada ${ago(o.lastCheckedAt, now)}. ${o.status === "sin_verificar" ? (o.checkNote ?? "") : ""}`
            : "Aún no la hemos revisado; lo haremos en breve."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Ver oferta
          <ExternalLinkIcon aria-hidden />
        </a>
        {o.status !== "finalizada" && (
          <Button variant="outline" size="sm" onClick={adapt}>
            Adaptar mi CV
          </Button>
        )}
        <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={pending} onClick={remove}>
          Quitar
        </Button>
      </div>
    </li>
  )
}

/** «Mis ofertas»: las ofertas guardadas, agrupadas por empresa, con su estado de vigencia (lo revisa una tarea automática). */
export function TrackedOffers({ offers }: { offers: TrackedOffer[] }) {
  if (offers.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookmarkIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Aún no tienes ofertas guardadas</EmptyTitle>
          <EmptyDescription>Pega el enlace de una oferta en «Nueva oferta»: la analizamos, la guardamos completa aquí y vigilamos si sigue abierta.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href="/?nueva-oferta=1" className={buttonVariants()}>
            Nueva oferta
          </Link>
        </EmptyContent>
      </Empty>
    )
  }
  const groups = groupByCompany(offers, companyKey)
  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => (
        <section key={g.key || "sin-empresa"} aria-label={g.name} className="flex flex-col">
          <h2 className="text-sm font-medium">
            {g.name} <span className="font-normal text-muted-foreground">· {g.items.length === 1 ? "1 oferta" : `${g.items.length} ofertas`}</span>
          </h2>
          <ul className="flex flex-col divide-y">
            {g.items.map((o) => (
              <Row key={o.id} o={o} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
