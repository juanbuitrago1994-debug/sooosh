import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { and, desc, gt, isNull, eq } from "drizzle-orm"
import { ArrowLeftIcon } from "lucide-react"
import { updateProfile } from "@/app/cuenta/actions"
import { DevicesList } from "@/components/auth/devices-list"
import { LogoutButton } from "@/components/auth/logout-button"
import { OnboardingForm } from "@/components/auth/onboarding-form"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { COUNTRY_CODES, countryName } from "@/lib/auth/profile-schema"
import { requireProfile } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { trustedDevices } from "@/lib/db/schema"

export const metadata: Metadata = { title: "Ajustes · Sooosh", robots: { index: false, follow: false } }

async function Settings() {
  const { user, profile } = await requireProfile()
  const [first, ...rest] = COUNTRY_CODES
  const countries = [first, ...rest.toSorted((a, b) => countryName(a).localeCompare(countryName(b), "es"))].map((code) => ({ code, name: countryName(code) }))
  const rows = await getDb()
    .select({ id: trustedDevices.id, label: trustedDevices.label, remember: trustedDevices.remember, lastSeenAt: trustedDevices.lastSeenAt })
    .from(trustedDevices)
    .where(and(eq(trustedDevices.userId, user.id), isNull(trustedDevices.revokedAt), gt(trustedDevices.expiresAt, new Date().toISOString())))
    .orderBy(desc(trustedDevices.lastSeenAt))
  const devices = rows.map((r) => ({ ...r, lastSeenAt: new Date(/[zZ]|[+-]\d\d(:?\d\d)?$/.test(r.lastSeenAt) ? r.lastSeenAt : `${r.lastSeenAt}Z`).toISOString(), current: r.id === user.deviceId }))

  return (
    <>
      <section className="flex flex-col gap-6" aria-labelledby="perfil">
        <div className="flex flex-col gap-1">
          <h2 id="perfil" className="text-sm font-medium">Tu perfil</h2>
          <p className="text-xs text-muted-foreground">Lo que nos contaste al registrarte. Cámbialo cuando quieras.</p>
        </div>
        <OnboardingForm key={JSON.stringify(profile)} action={updateProfile} defaultName={profile.name} defaultCountry={profile.country} defaultRoles={profile.roleInterests} countries={countries} submitLabel="Guardar cambios" />
      </section>
      <Separator />
      <section className="flex flex-col gap-6" aria-labelledby="cuenta">
        <div className="flex flex-col gap-1">
          <h2 id="cuenta" className="text-sm font-medium">Cuenta</h2>
          <p className="text-xs text-muted-foreground">Entras con Google como {user.email}.</p>
        </div>
        <LogoutButton />
      </section>
      <Separator />
      <section className="flex flex-col gap-6" aria-labelledby="dispositivos">
        <div className="flex flex-col gap-1">
          <h2 id="dispositivos" className="text-sm font-medium">Dispositivos con sesión</h2>
          <p className="text-xs text-muted-foreground">En un dispositivo nuevo siempre se pide entrar. Cierra aquí los que ya no uses.</p>
        </div>
        <DevicesList devices={devices} />
      </section>
    </>
  )
}

export default function AjustesPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="flex items-center gap-1 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Volver" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeftIcon aria-hidden />
        </Link>
        <h1 className="px-1 text-sm font-medium">Ajustes</h1>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-4 pb-12 sm:px-6">
        <Suspense fallback={null}>
          <Settings />
        </Suspense>
      </main>
    </div>
  )
}
