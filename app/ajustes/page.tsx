import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ListSkeleton } from "@/components/common/list-skeleton"
import { and, desc, gt, isNull, eq } from "drizzle-orm"
import { ArrowLeftIcon } from "lucide-react"
import { updateProfile } from "@/app/cuenta/actions"
import { DataControls } from "@/components/auth/data-controls"
import { DevicesList } from "@/components/auth/devices-list"
import { RememberSwitch } from "@/components/auth/remember-switch"
import { LogoutButton } from "@/components/auth/logout-button"
import { buttonVariants } from "@/components/ui/button"
import { ProfileSettings } from "@/components/settings/profile-settings"
import { SettingsSection } from "@/components/settings/settings-section"
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
    <ProfileSettings key={JSON.stringify(profile)} form={{ action: updateProfile, defaultName: profile.name, defaultCountry: profile.country, defaultCity: profile.city ?? "", defaultRoles: profile.roleInterests, countries }}>
      <SettingsSection id="cuenta" title="Cuenta" description={`Entras con Google como ${user.email}.`}>
        <LogoutButton />
      </SettingsSection>
      <SettingsSection id="dispositivos" title="Dispositivos con sesión" description="En un dispositivo nuevo siempre se pide entrar. Cierra aquí los que ya no uses.">
        <RememberSwitch initial={user.remember} />
        <DevicesList devices={devices} />
      </SettingsSection>
      <SettingsSection id="datos" title="Tus datos" description="Llévate todo lo que guardamos de ti en un archivo, o elimina tu cuenta con todos sus datos.">
        <DataControls />
      </SettingsSection>
    </ProfileSettings>
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
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pt-4 pb-12 sm:px-6">
        <Suspense fallback={<ListSkeleton />}>
          <Settings />
        </Suspense>
      </main>
    </div>
  )
}
