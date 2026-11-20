# Sincronización automática de ofertas

Una corrida al día, en tu Mac, sin servidores ni costo: `pnpm sync` habla directo con Supabase y con Ollama (usa `.env.local`).

## Qué hace, en orden
1. **Fuentes** (cada una con su cadencia: Get on Board 3 h, empresas 6 h, portales y remotas 12 h; se omiten si aún no toca. Tras 3 fallos seguidos se pausan 12 h. Remotive pide ≤ 4 lecturas al día): Get on Board → empresas del directorio (Greenhouse, Lever, Ashby, Workable, Recruitee, SmartRecruiters, Personio) → portales (Chiletrabajos, Trabajando.cl; solo ofertas nuevas de tecnología, 100 por corrida) → remotas (Remotive, Jobicy, Himalayas).
2. **Vencimiento**: cierra lo que dejó de valer. Vigencia declarada vencida; remotas no vistas en 21 días; ofertas de portales de más de 60 días. Get on Board y las empresas cierran solas lo que ya no aparece (lectura completa). Cerrar no borra: la oferta deja de mostrarse y revive si la fuente la vuelve a traer.
3. **Privacidad**: borra los eventos de más de 90 días.
4. **IA local**: estructura las ofertas pobres en cola (presupuesto de 20 min; si Ollama no responde se detiene sin error) y calcula los vectores que falten.

Cada fuente deja una fila en `sync_runs` (qué leyó, cuántas nuevas/actualizadas/cerradas, error) y el texto va a `data/sync.log`.

## Comandos
| Comando | Qué hace |
|---|---|
| `pnpm sync` | Corre lo que toque |
| `pnpm sync --phase=fetch,vectors` | Solo esas fases (`fetch` = leer fuentes y vencer; `vectors`; `enrich` = IA que estructura) |
| `pnpm sync --check` | Revisa la salud; sale con error si Get on Board o las empresas llevan demasiado sin sincronizar |
| `pnpm sync --force` | Todas las fuentes, aunque se hayan leído hoy |
| `pnpm sync --only=remote:jobicy,portal:trabajando` | Solo esas |
| `pnpm sync --minutes=30` | Presupuesto de tiempo para la IA local |
| `pnpm sync:install` | Programa la corrida diaria a las 03:30 (launchd; si el Mac estaba dormido, corre al despertar) |
| `pnpm sync:uninstall` | Quita la programación |

## Límites conocidos
- Solo corre con el Mac encendido o al despertar; la IA local necesita Ollama abierto (si no, las fuentes se sincronizan igual y la IA queda para el día siguiente).
- Cuando la app esté desplegada con cuentas, esto pasa a un cron del servidor; el código de `lib/sources/schedule.ts` se reutiliza tal cual.

## Una corrida a la vez
Un candado en la base (`sync_locks`, caduca a los 90 min) impide que dos corridas (GitHub y el Mac) se pisen: la segunda se retira sin error. El estado por fuente se ve en `/admin/ofertas` → «Sincronización automática».

## Dónde corre cada cosa (20-nov-2026)
- **GitHub Actions** (`.github/workflows/sync.yml`, cada 3 h, minuto 17): empresas, portales y fuentes remotas + vectores con Ollama en el runner + revisión de salud. Medido en la primera corrida real: 593 s para leer fuentes, 164–176 s para 147–237 vectores.
- **Tu Mac** (`pnpm sync:install`, cada 3 h mientras esté encendido): todo lo anterior si toca, más el estructurado con el LLM local (lo único que necesita tu Mac).
- **Get on Board** responde 403 al cliente HTTP de Node desde GitHub, pero 200 a `curl` con la misma identificación SoooshBot. Con autorización de Juan (20-nov-2026) su adaptador reintenta una vez con `curl` (`fetchWithCurlFallback`), así que corre también en la nube. Para desactivarlo: `SYNC_CURL_FALLBACK=0`.
- Los 403 de Ashby/Workable y el 429 de Himalayas de la primera corrida eran de ráfaga (con pausas y reintentos cortés pasan): Himalayas ya trajo 147 ofertas nuevas desde GitHub.

## Reloj propio en Supabase (20-nov-2026)
GitHub no disparó su cron programado en este repositorio (sondas de 28 min y la ventana de las 15:17 UTC sin corridas; las manuales sí funcionan). Por eso la base de datos lanza el workflow:
- `pg_cron` ejecuta `public.trigger_sync_workflow()` a los minutos 17 de cada tercera hora (UTC, trabajo `sooosh-sync-dispatch`), que llama con `pg_net` a la API de GitHub (`workflow_dispatch` de `sync.yml`, respuesta 204). Migración `0015`.
- El token de GitHub (fine-grained, solo el repo `sooosh`, permiso *Actions: Read and write*) está en **Supabase Vault** con el nombre `github_dispatch_token`; nunca en el repositorio. Sin el secreto la función no hace nada. Prueba real del 20-nov-2026: 204 y una corrida lanzada.
- Si GitHub vuelve a disparar su propio cron, no pasa nada: cada fuente tiene su cadencia y el candado impide corridas simultáneas.
- Para quitarlo: `select cron.unschedule('sooosh-sync-dispatch');` y revocar el token en GitHub.
- Pendiente recomendado: el token se creó sin fecha de caducidad; conviene reemplazarlo por uno con caducidad (y actualizar el secreto en el Vault).
