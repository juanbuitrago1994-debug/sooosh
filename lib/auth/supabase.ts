import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

export const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
export const supabaseKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

/**
 * Cliente de Supabase Auth para el servidor. `remember` decide cómo se guardan las cookies de sesión: con «Mantener sesión iniciada»
 * duran lo que dice Supabase; sin marcar se guardan como cookies de sesión (sin `maxAge`/`expires`) y mueren al cerrar el navegador.
 * Se aplica en cada renovación del token, no solo al entrar.
 */
export function createAuthClient(opts: { getAll: () => { name: string; value: string }[]; setAll: (cookies: CookieToSet[]) => void; remember: boolean }): SupabaseClient {
  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll: opts.getAll,
      setAll: (cookies) => {
        opts.setAll(
          cookies.map(({ name, value, options }) => {
            if (opts.remember || !value) return { name, value, options }
            return { name, value, options: Object.fromEntries(Object.entries(options ?? {}).filter(([k]) => k !== "maxAge" && k !== "expires")) }
          }),
        )
      },
    },
  })
}
