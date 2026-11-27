# Incidentes y lecciones

Registro corto de problemas que costaron tiempo, con su causa medida y cómo se resolvieron. Si vuelve a pasar algo parecido, empezar por aquí. Cada entrada: síntoma, causa, cómo se diagnosticó, arreglo, cómo reconocerlo si vuelve.

---

## 2026-11-27 · «Llenar con tu CV» no traía el titular (y el arreglo «no funcionaba»)

**Síntoma.** En «Your resume», «Llenar con tu CV» completaba nombre, contacto y ubicación pero dejaba vacío el titular; sin embargo, subiendo el mismo archivo por el flujo de validación el rol parecía estar. Tras arreglar el motor, volvió a pasar.

**Causas (eran tres, encadenadas).**
1. **El motor descartaba el titular.** La heurística de identidad aceptaba la línea bajo el nombre solo si medía ≤ 90 caracteres; el titular real («Semi Senior Product Designer | Estrategia de Producto | Design Systems | UX Research | Figma») mide 92. Ni la validación ni «Your resume» lo veían: el paso «Rol» de la validación ofrece *sugerencias* sacadas de los cargos de la experiencia, que parecían «el titular».
2. **El botón reutilizaba una lectura guardada.** Si había un CV leído y sin validar en el navegador, se usaba ese en vez de leer otra vez; una lectura hecha antes del arreglo nunca podía traer lo nuevo.
3. **El caché del servidor no se invalidó.** La huella del caché (`versionFor` en `lib/cache/results.ts`) incluye modelo, prompts, esquemas y `LOGIC_VERSION`, pero la lógica determinista NO está en la huella: se sube `LOGIC_VERSION` a mano y no se subió. El servidor seguía entregando la lectura vieja del mismo archivo.

Un hallazgo previo del mismo día: al llegar un CV leído **sin** las listas nuevas (`after[k].length` de `undefined`) la vista se rompía. Los datos guardados o en caché pueden ser de una versión anterior del esquema.

**Cómo se diagnosticó** (sirve de guía).
1. Mirar el último resultado guardado (`data/profile.json`): `header` sin `headline` → el problema estaba en la lectura, no en la vista.
2. Correr `heuristicIdentity` sobre el texto original (`sourceText` del mismo archivo): devolvía `headline: undefined` → medir la línea: 92 caracteres contra un tope de 90.
3. Tras el arreglo, la heurística ya devolvía el titular pero el botón no: revisar de dónde sale el CV que usa el botón (lectura guardada) y si el caché pudo devolver la vieja (versión sin subir).

**Arreglo.**
- `lib/cv/pipeline.ts`: el titular admite hasta 160 caracteres y no puede terminar en `.`, `:` o `;` (un párrafo no es un titular).
- `lib/profile/parse-client.ts` (`parseStoredCv`) y `components/cv/your-resume.tsx`: el botón vuelve a leer el archivo ya subido con la lógica actual; si el archivo ya no está, usa la lectura guardada; si no hay nada, pide el archivo.
- `lib/cv/merge.ts` y la vista normalizan lo leído con `cvSchema` y toleran listas ausentes.
- **Guarda automática** (`tests/logic-version.test.ts`): calcula una huella de lo que produce la lógica determinista sobre textos fijos y la compara con `GOLDEN`. Si la lógica cambia, la prueba falla hasta que se suban **a la vez** `LOGIC_VERSION` y `GOLDEN`. Verificado: alterar un número en el pipeline hace fallar la prueba.

**Reglas para que no vuelva a pasar.**
- Cambiaste la lógica de lectura (`lib/cv/*`, heurísticas, regex, topes) → sube `LOGIC_VERSION` en `lib/cache/results.ts` y actualiza `GOLDEN` (la prueba te lo exige).
- Todo código que consuma un CV guardado, en caché o leído por otra ruta debe pasarlo por `cvSchema` primero (los datos viejos no traen los campos nuevos) y usar `?? []` donde corresponda.
- Un arreglo de lectura se prueba con el **archivo real** de la persona (su `sourceText` y su primera línea), no solo con ejemplos inventados; y se prueba el camino completo (botón → servidor → caché), no solo la función.
- Un botón que «reutiliza lo ya leído» debe poder releer: lo guardado puede ser de una lógica anterior.
- Un estado local de un campo (como `TagsInput`) debe sincronizarse cuando el formulario cambia desde fuera (`form.reset`).

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
