import type { Metadata } from "next"
import { Suspense } from "react"
import { LoginCard } from "@/components/auth/login-card"

export const metadata: Metadata = { title: "Entrar · Sooosh" }

async function Login({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams
  return <LoginCard error={typeof error === "string" ? error : undefined} />
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <Suspense fallback={<LoginCard />}>
        <Login searchParams={props.searchParams} />
      </Suspense>
    </main>
  )
}
