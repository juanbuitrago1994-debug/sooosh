"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { setRememberDevice } from "@/app/cuenta/actions"
import { REMEMBER_ANSWERED_KEY, REMEMBER_DELAY_MS, REMEMBER_SHOWN_KEY, shouldAskRemember } from "@/lib/auth/remember-prompt"

const read = (store: "local" | "session", key: string) => {
  try {
    return (store === "local" ? localStorage : sessionStorage).getItem(key) === "1"
  } catch {
    return false
  }
}
const write = (store: "local" | "session", key: string) => {
  try {
    ;(store === "local" ? localStorage : sessionStorage).setItem(key, "1")
  } catch {
    /* sin almacenamiento */
  }
}

/** Sugerencia única (por dispositivo) de mantener la sesión iniciada. No pinta nada: lanza un aviso (Sonner) unos segundos después de entrar. Ver `lib/auth/remember-prompt.ts`. */
export function RememberPrompt({ remembered }: { remembered: boolean }) {
  useEffect(() => {
    if (remembered) return write("local", REMEMBER_ANSWERED_KEY) // ya la mantiene: no hay nada que sugerir nunca más
    if (!shouldAskRemember({ remembered, answered: read("local", REMEMBER_ANSWERED_KEY), shownThisTab: read("session", REMEMBER_SHOWN_KEY) })) return
    const timer = setTimeout(() => {
      write("session", REMEMBER_SHOWN_KEY)
      const answer = () => write("local", REMEMBER_ANSWERED_KEY)
      toast("¿Es tu equipo personal?", {
        description: "Mantén la sesión iniciada y no tendrás que entrar de nuevo al cerrar el navegador. Lo cambias cuando quieras en Ajustes.",
        duration: Infinity,
        action: {
          label: "Mantener",
          onClick: () => {
            answer()
            void setRememberDevice(true).then((ok) => (ok ? toast.success("Sesión mantenida en este dispositivo") : toast.error("No pudimos cambiarlo. Pruébalo en Ajustes.")))
          },
        },
        cancel: { label: "Ahora no", onClick: answer },
        onDismiss: answer,
      })
    }, REMEMBER_DELAY_MS)
    // El aviso vive en el `Toaster` de la raíz: sigue ahí al cambiar de página hasta que se responda. Aquí solo se cancela el temporizador si se sale antes de mostrarlo.
    return () => clearTimeout(timer)
  }, [remembered])
  return null
}
