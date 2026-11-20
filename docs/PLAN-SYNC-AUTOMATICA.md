# Plan: sincronización 100 % automática (sin acción manual)

Objetivo: las ofertas se actualizan solas cada X horas, aunque tu Mac esté apagado, y nadie tiene que pulsar nada. Hoy (`docs/SINCRONIZACION.md`) la corrida diaria depende de que tu Mac esté encendido.

## Qué impide hoy la automatización total
| Pieza | Dónde corre hoy | Problema |
|---|---|---|
| Leer fuentes, guardar, deduplicar, vencer | `pnpm sync` en tu Mac | Solo si el Mac está encendido |
| Vectores (bge-m3) | Ollama en tu Mac | Necesita un Ollama |
| Estructurar ofertas pobres (qwen2.5:7b) | Ollama en tu Mac | Necesita un Ollama potente (≈ 12 s por oferta en tu Mac) |

La idea clave: **separar la corrida en dos fases** que se hablan por la base de datos (la cola ya existe):
- **Fase A — Traer** (sin IA): leer fuentes, ingerir, vencer, purgar. Barata, sin GPU, corre en cualquier lado.
- **Fase B — IA**: estructurar con el LLM y calcular vectores. Drena la cola de la base; si no hay Ollama disponible, no pasa nada: la oferta ya está visible y se completa después.

## Opciones para ejecutar la Fase A sin tu Mac
| Opción | Costo | Frecuencia | Veredicto |
|---|---|---|---|
| **GitHub Actions** (`schedule`) | 0 (repo público: ilimitado; privado: 2 000 min/mes) | Cada 5 min o más (UTC) | **Recomendada.** Corre `pnpm sync --phase=fetch` con `DATABASE_URL` como secreto. Avisa por correo si falla |
| Supabase `pg_cron` + Edge Function | 0 | Cualquiera | Descartada: los lectores están en Node (portales tardan minutos; las funciones gratuitas cortan a ~150 s) |
| Vercel Cron | 0 | **1 vez al día** en plan gratis | Insuficiente, y obliga a desplegar la app |
| VM gratuita (Oracle Always Free) | 0 | Cualquiera | Sirve para fase A **y B** (ver abajo), pero exige una cuenta con tarjeta y mantenimiento |
| launchd en tu Mac (ya hecho) | 0 | Diaria | Se queda como **respaldo** de la fase B |

## Qué hay que construir (en código)
1. **Dividir `runDaily`** en `--phase=fetch` y `--phase=ai` (el script ya acepta `--only`; falta la fase y que `fetch` no toque Ollama).
2. **Cadencia por fuente** en lugar de «20 h para todas»: Get on Board y empresas cada 6 h; portales cada 12 h (poco ritmo, por respeto); Remotive/Jobicy/Himalayas cada 12 h (Remotive permite ≤ 4 al día, Jobicy responde 429 si se abusa). Cada fuente guarda su próxima hora en `sync_runs`.
3. **Candado** (`pg_try_advisory_lock`) para que dos corridas (Actions + tu Mac) nunca se pisen.
4. **Reintentos y aislamiento**: una fuente caída no frena a las demás (ya ocurre); tras 3 fallos seguidos se marca «degradada» en vez de reintentar sin fin.
5. **Salud visible**: en `/admin/ofertas`, una línea «Última sincronización: hace X h · N fuentes con error» leída de `sync_runs`; el workflow falla (y GitHub te escribe) si una fuente clave lleva > 36 h sin éxito.
6. **Degradación sin vectores**: mientras una oferta no tiene vector, la búsqueda por texto y filtros la muestran igual; solo el orden «Para mí» la usa cuando ya lo tiene (comprobar y probar).
7. **Workflow** `.github/workflows/sync.yml`: `cron: "0 */6 * * *"`, `pnpm install --frozen-lockfile`, `pnpm sync --phase=fetch`; secreto `DATABASE_URL`. (Mantener actividad: GitHub desactiva crons de repos públicos sin commits en 60 días.)

## Fase B (IA) sin intervención: tres niveles
1. **Vectores en el propio workflow** (gratis): instalar Ollama en el runner, `bge-m3` en caché, calcular lo que falte tras cada traída (CPU; ~100 ofertas por corrida es razonable). Así **ninguna oferta nueva queda sin vector**.
2. **Estructurado con LLM**: sigue en tu Mac vía launchd (cuando está encendido drena la cola; el resto de las ofertas ya se ven y se pueden encajar con reglas). Es lo único que no será 100 % autónomo.
3. **Opcional, si quieres 100 %**: una VM gratuita con Ollama (`qwen2.5:7b`, lenta en CPU, ≈ 1–2 min por oferta, pero va de fondo). **Decisión tuya**: tu regla dice «solo Ollama local»; un Ollama en tu propia VM sigue siendo Ollama (no hay API de pago), pero ya no es tu máquina.

## Seguridad y reglas
- El workflow solo maneja ofertas públicas y la clave de la base; **ningún CV ni dato personal** pasa por él. `DATABASE_URL` va como *secret* de GitHub (nunca en el repo ni en el chat).
- Misma identificación `SoooshBot`, mismos límites y respeto de `robots.txt`; sin saltar bloqueos.
- Costo cero: GitHub Actions gratuito, Supabase plan gratuito.

## Orden propuesto
1. Dividir fases + cadencia por fuente + candado + salud en el panel (código, con pruebas).
2. Workflow de GitHub con la fase A cada 6 h y vectores con Ollama en el runner.
3. Alerta por fallo y verificación de 48 h seguidas sin intervención.
4. (Opcional) VM gratuita para la IA pesada.

## Lo que sí requiere una acción tuya, una sola vez
- Subir el repo a GitHub (¿ya lo está? el repositorio local no tiene remoto) y añadir el secreto `DATABASE_URL`.
- Decidir: ¿repo **privado** (2 000 min/mes: alcanza para fase A cada 6 h sin Ollama en el runner, pero no para vectores en el runner) o público (ilimitado, pero el código queda visible)?
- Decidir si quieres el nivel 3 (VM).

## Decisiones tomadas (20-nov-2026)
1. **Repositorio público, cron cada 3 h**: es posible y gratis (los minutos de GitHub Actions son ilimitados en repos públicos; 8 corridas al día de ≈ 3–8 min). El cron real cae en el minuto 17 para evitar la saturación de GitHub. Se cumple con la cadencia por fuente: aunque el cron pase cada 3 h, cada fuente se lee solo cuando le toca (3, 6 o 12 h).
2. **IA: sin VM por ahora.** Motivos: tu regla «solo Ollama local», el modelo de 7B en CPU gratuita tardaría 1–2 min por oferta, exige tarjeta y mantenimiento, y la ganancia de experiencia es pequeña (las ofertas ya se ven y se encajan con reglas mientras tanto). Queda así: **vectores en el runner** (`bge-m3`, solo sobre ofertas públicas: así toda oferta nueva puede entrar a «Para ti» en ≤ 3 h) y **estructurado con LLM en tu Mac** (launchd, cuando esté encendido). Principio: *los datos personales (CV) solo pasan por tu Ollama local; las ofertas, que son públicas, pueden procesarse en el runner.* Se revisa más adelante si el atraso del estructurado se nota.
3. **Repo**: el entorno no tiene `gh`; se da el paso a paso (ver informe de la Fase 2).
