import type { Metadata } from "next"
import { JobsAdmin } from "@/components/jobs/jobs-admin"

export const metadata: Metadata = { title: "Ofertas · Sooosh", robots: { index: false, follow: false } }

export default function AdminOfertasPage() {
  return <JobsAdmin />
}
