import "server-only"
import { sql } from "drizzle-orm"
import { dedupeRoles, profileSchema } from "@/lib/auth/profile-schema"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"

export type ProfileFormState = { error?: string; saved?: boolean; fieldErrors?: Partial<Record<"name" | "country" | "city" | "roleInterests", string>> }

/** Valida y guarda (o actualiza) el perfil de una persona. Sirve al registro y a Ajustes; quien llama pone el `userId` de la sesión verificada. */
export async function persistProfile(userId: string, form: FormData): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse({ name: form.get("name"), country: form.get("country"), city: form.get("city") ?? "", roleInterests: dedupeRoles(form.getAll("role").map(String)) })
  if (!parsed.success) {
    const fieldErrors: NonNullable<ProfileFormState["fieldErrors"]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] === "roleInterests" ? "roleInterests" : issue.path[0] === "country" ? "country" : issue.path[0] === "city" ? "city" : "name"
      fieldErrors[key] ??= issue.message
    }
    return { fieldErrors }
  }
  const { name, country, city, roleInterests } = parsed.data
  try {
    await getDb().insert(profiles).values({ id: userId, name, country, city, roleInterests }).onConflictDoUpdate({ target: profiles.id, set: { name, country, city, roleInterests, updatedAt: sql`now()` } })
  } catch (e) {
    console.error("[perfil]", e)
    return { error: "No se pudo guardar. Inténtalo de nuevo." }
  }
  return { saved: true }
}
