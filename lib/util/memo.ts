/**
 * Memoria de corta vida en el servidor, con las peticiones iguales que llegan a la vez agrupadas en una sola. Para lo que es público y cambia poco
 * (las ofertas cambian cada ~3 h con la sincronización): evita repetir consultas idénticas a la base (~150 ms cada viaje) y llamadas a Ollama.
 * Vive en el proceso: si el servidor se reinicia o hay varias instancias, cada una tiene la suya (solo pierde ahorro, nunca corrección).
 */
export function createMemo<T>(opts: { ttlMs: number; max: number }) {
  const store = new Map<string, { at: number; value: Promise<T> }>()
  /** `keep`: si devuelve false para el resultado (p. ej. «Ollama no estaba»), no se guarda y la próxima petición vuelve a intentarlo. */
  return async function memo(key: string, load: () => Promise<T>, keep?: (v: T) => boolean): Promise<T> {
    const hit = store.get(key)
    if (hit && Date.now() - hit.at < opts.ttlMs) return hit.value
    const value = load()
    store.set(key, { at: Date.now(), value })
    // Un fallo no se guarda: la próxima petición vuelve a intentarlo.
    value.then((v) => keep && !keep(v) && store.get(key)?.value === value && store.delete(key), () => store.get(key)?.value === value && store.delete(key))
    if (store.size > opts.max) store.delete(store.keys().next().value as string)
    return value
  }
}
