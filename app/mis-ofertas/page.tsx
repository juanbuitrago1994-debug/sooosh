import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ListSkeleton } from "@/components/common/list-skeleton"
import { ArrowLeftIcon } from "lucide-react"
import { TrackedOffers } from "@/components/tracking/tracked-offers"
import { buttonVariants } from "@/components/ui/button"
import { requireProfile } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { listCollections } from "@/lib/tracking/collections"
import { listTrackedOffers } from "@/lib/tracking/store"

export const metadata: Metadata = { title: "Mis ofertas · Sooosh", robots: { index: false, follow: false } }

async function Offers() {
  const { user } = await requireProfile()
  const db = getDb()
  const [offers, collections] = await Promise.all([listTrackedOffers(db, user.id), listCollections(db, user.id)])
  return <TrackedOffers offers={offers} collections={collections} />
}

export default function MisOfertasPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="flex items-center gap-1 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Volver" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeftIcon aria-hidden />
        </Link>
        <h1 className="px-1 text-sm font-medium">Mis ofertas</h1>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-4 pb-12 sm:px-6">
        <p className="text-xs text-muted-foreground">Guardamos cada oferta completa y revisamos su enlace varias veces al día. Si cierra, te lo marcamos para que no pierdas tiempo.</p>
        <Suspense fallback={<ListSkeleton />}>
          <Offers />
        </Suspense>
      </main>
    </div>
  )
}
