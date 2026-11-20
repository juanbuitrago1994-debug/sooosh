/**
 * Límite de espera para una consulta a la base: si la conexión se atasca (pasó con el pooler de Supabase), la petición responde un error
 * en vez de quedarse colgada para siempre. No cancela la consulta en la base; solo libera a quien la espera.
 */
export class DbTimeoutError extends Error {
  constructor(ms: number) {
    super(`La base de datos no respondió en ${Math.round(ms / 1000)} s`)
    this.name = "DbTimeoutError"
  }
}

export function withDbTimeout<T>(work: Promise<T>, ms = 12_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DbTimeoutError(ms)), ms)
  })
  return Promise.race([work, limit]).finally(() => clearTimeout(timer))
}
