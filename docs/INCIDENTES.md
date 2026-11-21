# Incidentes y lecciones

Registro corto de problemas que costaron tiempo, con su causa medida y cómo se resolvieron. Si vuelve a pasar algo parecido, empezar por aquí. Cada entrada: síntoma, causa, cómo se diagnosticó, arreglo, cómo reconocerlo si vuelve.

---

## 2026-11-20 · El buscador se quedaba cargando para siempre

**Síntoma.** `/ofertas` cargaba bien la primera vez; al recargar, el cargador giraba sin fin y nunca aparecían ofertas. Reiniciar `pnpm dev` ayudaba solo un momento. Las peticiones a la API (`/api/search`, `/api/jobs/count`) no respondían nunca (ni éxito ni error), mientras la portada `/` sí respondía.

**Causa.** `postgres.js` envía por defecto hasta 100 consultas encadenadas por la misma conexión (*pipelining*, opción `max_pipeline`). El **pooler de transacciones de Supabase (puerto 6543)** deja colgadas las consultas encadenadas. La página dispara varias peticiones a la vez (búsqueda, contador, tendencias), así que se encadenaban y se atascaban. No era lento el SQL (la búsqueda tarda 3 ms en la base) ni estaban atascadas las sesiones de Postgres.

**Cómo se diagnosticó** (en este orden; sirve de guía):
1. Servidor sano: `curl localhost:3000/` respondía en 0,3 s; `/api/jobs/count` se colgaba → el problema estaba en la ruta de la base, no en el servidor ni en el CPU.
2. Consultas lentas descartadas: `explain analyze` de la búsqueda (3 ms) y de las tendencias (0,2 ms).
3. Reproducido **fuera de la app** con un guion de `postgres.js`: 8 consultas simultáneas por el puerto 6543 → respuestas 2/8, luego 3/8, luego 0/8; el mismo guion por el puerto 5432 (modo sesión) → 8/8. Eso aisló el pooler.
4. Hipótesis descartada: «sesiones atascadas en Postgres». Se vieron 3 sesiones `active` / `ClientRead`, pero la limpieza con `pg_terminate_backend` no encontró ninguna después y el problema seguía; los registros `supavisor_logs` mostraron clientes autenticados con consultas sin respuesta.
5. Hipótesis descartada: «recrear el pool tras un fallo». Daba 48/48 en rondas de 8, pero bajo 10 peticiones simultáneas a la app respondía 502 en 5 de 10.
6. Causa confirmada: variar `max_pipeline`. Con 10 consultas simultáneas por ronda: valor por defecto (100) → **5 de 80**; `max_pipeline: 1` → **80 de 80** (en la app, 10 búsquedas simultáneas responden en 0,8–1,8 s). Ver `docs/BENCHMARKS.md`.

**Arreglo** (commits `e239f88`, `76352fc`).
- `lib/db/index.ts`: `max_pipeline: 1` (una consulta en vuelo por conexión). Es la corrección de fondo; no cambia el puerto ni `.env.local`.
- `lib/db/resilient.ts` (`withDb`): las lecturas de la búsqueda, el contador, las tendencias y la ficha tienen límite de 4 s y, si se atascan, descartan las conexiones (`resetDb`) y reintentan una vez. Red de seguridad, no solución: sola no bastaba.
- Buscador: espera máxima de 20 s y mensaje con «Reintentar» en vez de cargador infinito.
- `GET /api/db/health`: sondeo corto y contadores desde que arrancó el servidor (`timeouts`, `resets`, `recovered`, `failed`, `lastResetAt`).

**Si vuelve a pasar.**
- Abrir `http://localhost:3000/api/db/health`. `resets` en 0 = la conexión está sana. Si sube, algo vuelve a atascar la base: revisar si se añadió código que use la base desde fuera de `getDb()` (otro cliente `postgres` sin `max_pipeline: 1`) o si Supabase cambió el pooler.
- Reproducir fuera de la app con 8–10 consultas simultáneas por el puerto 6543 y comparar con el 5432 (paso 3 de arriba).
- Cualquier cliente nuevo de `postgres.js` contra el 6543 (scripts, tareas) debe llevar `prepare: false` **y** `max_pipeline: 1`.

**Lo que no se sabe.** Por qué empezó ese día con el mismo código (los registros de Postgres muestran los primeros cortes de conexión hacia las 10:00 hora de Colombia). Es probable un cambio del lado del pooler de Supabase. No se creó ningún cron de limpieza: la limpieza de sesiones no encontró nada que terminar y no habría arreglado el problema.
