/**
 * QUIÉN puede llamar a cada ruta `/api/*` (decisión del 27-nov-2026). Por defecto TODA ruta exige sesión válida en este dispositivo (lo aplica `proxy.ts`);
 * solo se abre lo que está marcado «publica» aquí. Una prueba (`tests/api-policy.test.ts`) exige que cada ruta de `app/api` esté en esta tabla: agregar una
 * ruta sin decidir su acceso hace fallar la suite.
 *  - publica: sin sesión (solo la comprobación de salud).
 *  - sesion: cualquier persona con sesión.
 *  - admin: sesión Y la clave de administrador (`x-admin-token`), que comprueba la propia ruta (`requireAdmin`).
 * `pesada`: trabaja mucho (archivos, IA, descargas): límite de peticiones más estricto.
 */
export type ApiAccess = "publica" | "sesion" | "admin"
export type ApiRule = { route: string; access: ApiAccess; pesada?: boolean }

export const API_POLICY: ApiRule[] = [
  { route: "/api/db/health", access: "publica" },

  { route: "/api/ats", access: "sesion", pesada: true },
  { route: "/api/changes", access: "sesion" },
  { route: "/api/consent", access: "sesion" },
  { route: "/api/cv/parse", access: "sesion", pesada: true },
  { route: "/api/cv/profile", access: "sesion" },
  { route: "/api/email/body", access: "sesion", pesada: true },
  { route: "/api/email/subject", access: "sesion", pesada: true },
  { route: "/api/events", access: "sesion" },
  { route: "/api/export", access: "sesion", pesada: true },
  { route: "/api/improve", access: "sesion", pesada: true },
  { route: "/api/jobs/[id]/fit", access: "sesion" },
  { route: "/api/jobs/count", access: "sesion" },
  { route: "/api/judge", access: "sesion", pesada: true },
  { route: "/api/learning", access: "sesion" },
  { route: "/api/learning/decisions", access: "sesion" },
  { route: "/api/learning/rules", access: "sesion" },
  { route: "/api/match", access: "sesion" },
  { route: "/api/offer", access: "sesion", pesada: true },
  { route: "/api/rebuild", access: "sesion", pesada: true },
  { route: "/api/rewrite", access: "sesion", pesada: true },
  { route: "/api/search", access: "sesion" },
  { route: "/api/sources/status", access: "sesion" },
  { route: "/api/trending", access: "sesion" },
  { route: "/api/upload", access: "sesion", pesada: true },
  { route: "/api/warmup", access: "sesion" },

  { route: "/api/enrich", access: "admin", pesada: true },
  { route: "/api/jobs", access: "admin" },
  { route: "/api/jobs/[id]", access: "admin" },
  { route: "/api/jobs/analyze", access: "admin", pesada: true },
  { route: "/api/jobs/embed", access: "admin", pesada: true },
  { route: "/api/sources", access: "admin" },
  { route: "/api/sources/[id]", access: "admin" },
  { route: "/api/sources/catalog", access: "admin" },
  { route: "/api/sources/health", access: "admin" },
  { route: "/api/sources/sync", access: "admin", pesada: true },
]

/** Peticiones por minuto y por persona: en general, y en las rutas pesadas. */
export const RATE_PER_MINUTE = { general: 300, pesada: 40 } as const

const segments = (p: string) => p.split("/").filter(Boolean)
const matches = (rule: string, path: string) => {
  const a = segments(rule)
  const b = segments(path)
  return a.length === b.length && a.every((s, i) => (s.startsWith("[") && s.endsWith("]") ? !!b[i] : s === b[i]))
}

/** La regla de una ruta; si varias encajan (`/api/jobs/count` y `/api/jobs/[id]`), gana la más específica (más segmentos fijos). `undefined` = ruta que no está en la tabla. */
export function policyFor(pathname: string): ApiRule | undefined {
  const fixed = (r: ApiRule) => segments(r.route).filter((s) => !s.startsWith("[")).length
  return API_POLICY.filter((r) => matches(r.route, pathname)).sort((x, y) => fixed(y) - fixed(x))[0]
}
