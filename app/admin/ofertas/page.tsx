import type { Metadata } from "next"
import { ProfileGate } from "@/components/auth/profile-gate"
import { JobsAdmin } from "@/components/jobs/jobs-admin"

export const metadata: Metadata = { title: "Ofertas · Sooosh", robots: { index: false, follow: false } }

export default function AdminOfertasPage() {
  return (
    <ProfileGate>
      <JobsAdmin />
    </ProfileGate>
  )
}
