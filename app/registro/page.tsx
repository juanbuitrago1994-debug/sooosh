import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { saveProfile } from "./actions"
import { OnboardingForm } from "@/components/auth/onboarding-form"
import { COUNTRY_CODES, countryName } from "@/lib/auth/profile-schema"
import { getSession } from "@/lib/auth/session"

export const metadata: Metadata = { title: "Crea tu perfil · Sooosh" }

async function Onboarding() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.profile) redirect("/")
  const user = session.user
  const [first, ...rest] = COUNTRY_CODES
  const countries = [first, ...rest.toSorted((a, b) => countryName(a).localeCompare(countryName(b), "es"))].map((code) => ({ code, name: countryName(code) }))
  return <OnboardingForm action={saveProfile} defaultName={user.googleName} countries={countries} />
}

export default function RegistroPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-medium">Cuéntanos de ti</h1>
          <p className="text-sm text-muted-foreground">Con esto te mostramos ofertas que te sirvan. Son tres datos y puedes cambiarlos después.</p>
        </div>
        <Suspense fallback={null}>
          <Onboarding />
        </Suspense>
      </div>
    </main>
  )
}
