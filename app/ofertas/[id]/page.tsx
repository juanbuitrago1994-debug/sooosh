import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"
import { JobDetail } from "@/components/jobs/job-detail"
import { LoadingState } from "@/components/ai/loading-state"
import { withDb } from "@/lib/db/resilient"
import { getJobCard } from "@/lib/jobs/search"

export const metadata: Metadata = { title: "Oferta · Sooosh" }

/** Lo que depende de la petición (el id y la base de datos) va dentro de Suspense; el esqueleto sale de inmediato. */
async function Oferta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = z.string().uuid().safeParse(id).success ? await withDb((db) => getJobCard(db, id)).catch(() => null) : null
  if (!job) notFound()
  return <JobDetail job={job} />
}

export default function OfertaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center px-4">
          <LoadingState messages={["Abriendo la oferta…", "Leyendo los requisitos…", "Preparando cómo postular…"]} />
        </div>
      }
    >
      <Oferta params={params} />
    </Suspense>
  )
}
