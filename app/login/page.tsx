import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Suspense } from "react"
import { LoginCard } from "@/components/auth/login-card"
import { LoginLens } from "@/components/auth/login-lens"
import { LAST_USER_COOKIE, parseLastUser } from "@/lib/auth/last-user"

export const metadata: Metadata = { title: "Entrar · Sooosh" }

async function Login({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams
  const last = parseLastUser((await cookies()).get(LAST_USER_COOKIE)?.value)
  // Todo lo que se ve (tarjeta y aviso legal) va dentro de `LoginLens`: así el efecto de entrada lo «fotografía» completo cuando ya existe.
  return (
    <LoginLens>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <LoginCard error={typeof error === "string" ? error : undefined} last={last} />
      </div>
      <footer className="flex items-center justify-center px-4 py-8">
        <p className="max-w-sm text-center text-xs text-balance text-muted-foreground">Tu CV validado se guarda en tu cuenta y solo tú puedes verlo. El archivo original no se guarda.</p>
      </footer>
    </LoginLens>
  )
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="flex min-h-dvh flex-col">
      {/* Sin marcador de posición: la pantalla entra UNA vez, ya completa. */}
      <Suspense fallback={null}>
        <Login searchParams={props.searchParams} />
      </Suspense>
    </main>
  )
}
