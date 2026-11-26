import { Suspense, type ReactNode } from "react"
import { CvSync } from "@/components/auth/cv-sync"
import { requireProfile } from "@/lib/auth/session"

async function Gate({ children }: { children: ReactNode }) {
  await requireProfile()
  return (
    <>
      <CvSync />
      {children}
    </>
  )
}

/** Deja pasar solo a quien tiene sesión válida en este dispositivo y su registro completo; si no, redirige al login o al registro. */
export function ProfileGate({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Gate>{children}</Gate>
    </Suspense>
  )
}
