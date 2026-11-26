"use server"

import { redirect } from "next/navigation"
import { requireUser } from "@/lib/auth/session"
import { persistProfile, type ProfileFormState } from "@/lib/auth/profile-store"

/** Registro de una cuenta nueva: guarda y entra a la app. La persona sale de la sesión verificada, nunca del formulario. */
export async function saveProfile(_prev: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  const user = await requireUser()
  const r = await persistProfile(user.id, form)
  if (r.saved) redirect("/")
  return r
}
