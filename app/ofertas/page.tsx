import type { Metadata } from "next"
import { ProfileGate } from "@/components/auth/profile-gate"
import { JobSearch } from "@/components/jobs/job-search"

export const metadata: Metadata = { title: "Buscar ofertas · Sooosh", description: "Encuentra posiciones abiertas por región y mira cuánto encaja tu CV." }

export default function OfertasPage() {
  return (
    <ProfileGate>
      <JobSearch />
    </ProfileGate>
  )
}
