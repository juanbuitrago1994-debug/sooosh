import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"
import { JobDetail } from "@/components/jobs/job-detail"
import { Skeleton } from "@/components/ui/skeleton"
import { getDb } from "@/lib/db"
import { getJobCard } from "@/lib/jobs/search"

export const metadata: Metadata = { title: "Oferta · Sooosh" }

/** Lo que depende de la petición (el id y la base de datos) va dentro de Suspense; el esqueleto sale de inmediato. */
async function Oferta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = z.string().uuid().safeParse(id).success ? await getJobCard(getDb(), id).catch(() => null) : null
  if (!job) notFound()
  return <JobDetail job={job} />
}

export default function OfertaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-6 sm:px-6" aria-hidden>
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      }
    >
      <Oferta params={params} />
    </Suspense>
  )
}
