import { getDb, resetDb, type Db } from "./index"
import { DbTimeoutError, withDbTimeout } from "./timeout"

/**
 * Consultas de LECTURA que se curan solas. El pooler de Supabase (puerto 6543) a veces deja conexiones que no responden: la consulta no falla,
 * se queda esperando. Aquí cada intento tiene un límite de espera; si se agota (o la conexión se cae), se descartan las conexiones y se reintenta con unas
 * nuevas. Solo para lecturas: reintentar una escritura podría repetirla. Los contadores permiten saber cada cuánto pasa (ver `dbHealth`).
 */
export const stats = { timeouts: 0, resets: 0, recovered: 0, failed: 0, lastResetAt: null as string | null }

const CONNECTION_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "EPIPE", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECT_TIMEOUT", "57014", "57P01", "08006"])

export function isConnectionProblem(e: unknown): boolean {
  if (e instanceof DbTimeoutError) return true
  const code = (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code
  return !!code && CONNECTION_CODES.has(code)
}

export async function withDb<T>(fn: (db: Db) => Promise<T>, opts: { timeoutMs?: number; retries?: number } = {}): Promise<T> {
  const { timeoutMs = 4000, retries = 1 } = opts
  for (let attempt = 0; ; attempt++) {
    const db = getDb()
    try {
      const out = await withDbTimeout(fn(db), timeoutMs)
      if (attempt > 0) stats.recovered++
      return out
    } catch (e) {
      if (!isConnectionProblem(e)) throw e
      if (e instanceof DbTimeoutError) stats.timeouts++
      if (resetDb(db)) {
        stats.resets++
        stats.lastResetAt = new Date().toISOString()
        console.warn("[db] conexión sin respuesta: se recrean las conexiones y se reintenta")
      }
      if (attempt >= retries) {
        stats.failed++
        throw e
      }
    }
  }
}

/** Estado de la conexión: un sondeo corto y los contadores desde que arrancó el servidor. */
export async function dbHealth(): Promise<{ ok: boolean; ms: number | null } & typeof stats> {
  const t0 = Date.now()
  try {
    await withDb((db) => db.execute("select 1" as never), { timeoutMs: 3000, retries: 0 })
    return { ok: true, ms: Date.now() - t0, ...stats }
  } catch {
    return { ok: false, ms: null, ...stats }
  }
}
