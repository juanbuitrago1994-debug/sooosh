import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Suspense } from "react"
import { LoginCard } from "@/components/auth/login-card"
import { Rise } from "@/components/motion/rise"
import { LAST_USER_COOKIE, parseLastUser } from "@/lib/auth/last-user"

export const metadata: Metadata = { title: "Entrar · Sooosh" }

async function Login({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams
  const last = parseLastUser((await cookies()).get(LAST_USER_COOKIE)?.value)
  return <LoginCard error={typeof error === "string" ? error : undefined} last={last} />
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        {/* Sin marcador de posición: la tarjeta entra animada UNA vez, cuando ya sabe si hay un último usuario. */}
        <Suspense fallback={null}>
          <Login searchParams={props.searchParams} />
        </Suspense>
      </div>
      <Rise step={9}>
        <footer className="flex items-center justify-center px-4 py-8">
          <p className="max-w-sm text-center text-xs text-balance text-muted-foreground">Tu CV validado se guarda en tu cuenta y solo tú puedes verlo. El archivo original no se guarda.</p>
        </footer>
      </Rise>
    </main>
  )
}
