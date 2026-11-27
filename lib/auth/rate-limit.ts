/**
 * Límite de peticiones por ventana fija de 1 minuto y por clave (la persona). Vive en memoria del proceso: en un servidor con varias instancias cada una cuenta
 * por separado, así que es un freno contra abusos y errores en bucle, no una cuota exacta.
 */
export function createLimiter(opts: { windowMs?: number; maxKeys?: number } = {}) {
  const windowMs = opts.windowMs ?? 60_000
  const maxKeys = opts.maxKeys ?? 10_000
  const hits = new Map<string, { start: number; n: number }>()
  return function hit(key: string, max: number, now = Date.now()): { ok: true } | { ok: false; retryAfterSeconds: number } {
    const cur = hits.get(key)
    if (!cur || now - cur.start >= windowMs) {
      if (hits.size >= maxKeys) for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k)
      hits.set(key, { start: now, n: 1 })
      return { ok: true }
    }
    cur.n++
    return cur.n <= max ? { ok: true } : { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((cur.start + windowMs - now) / 1000)) }
  }
}
