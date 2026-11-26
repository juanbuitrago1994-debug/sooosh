"use server"

import { redirect } from "next/navigation"
import { sql } from "drizzle-orm"
import { requireUser } from "@/lib/auth/session"
import { dedupeRoles, profileSchema } from "@/lib/auth/profile-schema"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"

export type ProfileFormState = { error?: string; fieldErrors?: Partial<Record<"name" | "country" | "roleInterests", string>> }

/** Guarda el registro (o lo actualiza). La persona sale de la sesión verificada, nunca del formulario. */
export async function saveProfile(_prev: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  const user = await requireUser()
  const parsed = profileSchema.safeParse({
    name: form.get("name"),
    country: form.get("country"),
    roleInterests: dedupeRoles(form.getAll("role").map(String)),
  })
  if (!parsed.success) {
    const fieldErrors: NonNullable<ProfileFormState["fieldErrors"]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] === "roleInterests" ? "roleInterests" : issue.path[0] === "country" ? "country" : "name"
      fieldErrors[key] ??= issue.message
    }
    return { fieldErrors }
  }
  try {
    await getDb()
      .insert(profiles)
      .values({ id: user.id, name: parsed.data.name, country: parsed.data.country, roleInterests: parsed.data.roleInterests })
      .onConflictDoUpdate({ target: profiles.id, set: { name: parsed.data.name, country: parsed.data.country, roleInterests: parsed.data.roleInterests, updatedAt: sql`now()` } })
  } catch (e) {
    console.error("[registro]", e)
    return { error: "No se pudo guardar tu registro. Inténtalo de nuevo." }
  }
  redirect("/")
}
