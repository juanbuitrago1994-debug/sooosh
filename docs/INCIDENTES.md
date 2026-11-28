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

## 2026-11-28 (3) · El User-Agent de las fuentes llevaba tildes y Magneto365 respondía 502

**Síntoma.** Al conectar Magneto365 con el lector de portales, `robots.txt` daba **502** de forma constante desde Node, aunque `curl` recibía 200. Por la regla «ante la duda, no se entra», el lector se detenía.

**Causa.** `SOURCE_HEADERS` (`lib/sources/types.ts`) enviaba `User-Agent: SoooshBot/0.1 (buscador de ofertas; lectura de APIs públicas)`, con «ú». Un valor de cabecera HTTP debe ser ASCII; el balanceador de Magneto (`awselb`) rechaza los bytes no ASCII con 502. Mi `curl` usó la misma frase sin tilde y por eso funcionaba: la diferencia se halló comparando una petición Node real contra `curl`, variando solo las cabeceras.

**Por qué lo generamos.** El texto se escribió en español, como todo, sin pensar que una cabecera no es texto de interfaz. Ninguna prueba lo detectaba porque las pruebas usan `fetch` simulado.

**Arreglo.** UA en ASCII («lectura de APIs publicas»). También en `app/api/geo/country/route.ts` («deteccion de pais»). Repetí la sonda de los 39 sitios que habían salido bloqueados: solo cambió Magneto (los 403 de Computrabajo, OCC, Tecnoempleo, Randstad… son reales).

**Efecto posible en otras fuentes.** Si alguna fuente en producción respondía 502/403 por esto, volverá a funcionar tras desplegar. No se verificó en producción.

**Regla.** Toda cabecera HTTP que enviemos es ASCII puro. Una prueba que compare los bytes de las cabeceras de `SOURCE_HEADERS` con `/^[\x20-\x7E]*$/` sería suficiente (pendiente, por pedido de Juan de dejar las pruebas para una fase posterior).

---

## 2026-11-28 (2) · Páginas en latin-1 o windows-1252 salían con «�» y una oferta cerrada se veía viva

**Síntoma.** Ninguno reportado: se detectó al comparar con `tools/page_decode.py` de ai-job-search-dev/ai-job-search (MIT). Un portal antiguo que sirve `charset=iso-8859-1` se descargaba y se leía siempre como UTF-8: cada tilde y la «ñ» salían como «�».

**Causa.** `fetch-url.ts` (oferta por enlace), `liveness.ts` (revisión de «Mis ofertas») y `portals/portal.ts` (portales con JSON-LD) llamaban a `new TextDecoder()` o `res.text()` sin mirar el `charset`. Efectos: texto roto para la IA y el extractor, y, lo más serio, en `liveness.ts` la frase «ya no **está** disponible» no coincidía con `CLOSED_TEXT` (`est[aá]`), así que una oferta cerrada seguía figurando viva.

**Por qué lo generamos.** Se asumió UTF-8 porque todas las páginas de prueba lo eran (fixtures propios y sitios modernos). Nadie probó una página con otra codificación.

**Arreglo.** `lib/offer/decode.ts` (`decodePage`): primero UTF-8 estricto (un sitio que declara latin-1 pero sirve UTF-8 es común); si no es válido, el `charset` de la cabecera, luego `<meta charset>` o `http-equiv` en los primeros 1024 bytes, y UTF-16 por su marca de orden de bytes. Solo se aceptan códecs de una lista cerrada (windows-125x, ISO-8859-x, KOI8, japonés, coreano, chino); `utf-7` y etiquetas desconocidas se ignoran y no lanza nunca. Las tres rutas usan esa función. `tests/offer-decode.test.ts` (11 pruebas): sin la corrección fallan 6 y la de oferta cerrada en latin-1.

**Límite.** `lib/offer/short-links.ts`, `personio.ts` y `robots.ts` siguen con `res.text()`: leen XML, robots.txt o solo cabeceras de enlaces cortos, donde la codificación no afecta. Si algún día importa, se cambian.

**Regla.** Todo HTML descargado de internet se decodifica con `decodePage`, nunca con `TextDecoder()` ni `res.text()`.

---

## 2026-11-28 · Ofertas distintas se omitían por «duplicadas»: «C++», «C#» y «C» tenían la misma clave

**Síntoma.** Ninguno visible: se detectó al comparar nuestro código con `tools/job_key.py` de ai-job-search-dev/ai-job-search (MIT), que resolvió el mismo problema. No hay ofertas perdidas confirmadas en producción (no se revisó la base).

**Causa.** `dedupeKey` (`lib/sources/normalize.ts`) quitaba todo lo que no fuera `a-z0-9`, incluidos `+` y `#`: «Desarrollador C++», «Desarrollador C#» y «Desarrollador C» de una misma empresa y país daban `desarrollador c|acme|co`. `ingest` (`lib/sources/ingest.ts`) omite una oferta nueva si OTRA fuente ya tiene una activa con la misma clave, así que el «C#» de una fuente se descartaba por el «C++» de otra.

**Por qué lo generamos.** La clave se diseñó el 19-nov-2026 para que la MISMA oferta de dos fuentes coincidiera aunque cambiaran tildes, mayúsculas y signos («Ingeniero de Datos (Sr.)» ≈ «INGENIERO DE DATOS Sr», «Acme S.A.» ≈ «acme s a»). Para eso se borró todo lo que no fuera letra o número, y las pruebas de entonces usaron títulos en español sin símbolos. Nunca se preguntó qué signos CAMBIAN el puesto: en un buscador de tecnología, «+» y «#» son parte del nombre del lenguaje. Faltó una prueba de la propiedad inversa: «dos títulos distintos no pueden dar la misma clave». Normalizar para unir y distinguir para separar son dos requisitos, y solo se probó el primero.

**Cómo se diagnosticó.** Se ejecutó la función real con los tres títulos (una reimplementación aparte no basta: se confirmó con `dedupeKey` importada) y se leyó `ingest` para ver qué hace con la coincidencia. Después se escribió la prueba de punta a punta y se comprobó que FALLA sin la corrección.

**Arreglo.** `+` → «plus» y `#` → «sharp» antes de quitar los signos. «Node.js» y «Node» ya se distinguían por el «js»; «UX/UI» y «UX UI» siguen siendo lo mismo. Las claves de títulos sin `+` ni `#` no cambian (hay una prueba), así que las filas guardadas se siguen reconociendo. `tests/sources-dedupe.test.ts` incluye una versión de `jobs` para PGlite con todas las columnas de `ingest` (el vector, como texto).

**Efecto en filas existentes.** Cada sincronización reescribe `dedupe_key` (`onConflictDoUpdate`), así que las filas con `+` o `#` toman la clave nueva en su próxima sincronización. Hasta entonces, una oferta genuinamente duplicada con esos signos podría entrar una vez más desde otra fuente.

**Regla.** Una clave de duplicados debe distinguir todo lo que cambia el puesto (`+`, `#`, `.NET`…). Si un título normalizado puede quedar igual para dos puestos distintos, el error es silencioso: la oferta simplemente no aparece.

---

## 2026-11-27 (2) · Educación y certificaciones salían vacías: encabezado combinado

**Síntoma.** «Your resume» mostraba Educación vacía y no aparecían certificaciones, con un CV que tiene la sección «EDUCACIÓN Y CERTIFICACIONES» (universidad y 9 certificaciones).

**Causa.** `headingKind` solo conocía encabezados de UN tema («Educación», «Certificaciones»). «EDUCACIÓN Y CERTIFICACIONES» no coincidía con ninguno, así que todo su contenido se pegó a la sección anterior (Habilidades). Además, aun reconocido: (a) el título del estudio y su universidad iban en líneas separadas y se leían como dos estudios, el primero sin institución (se descartaba); (b) en las certificaciones, los guiones de «Jun 2026 – Ago 2026» y de «Certificate – UX Design» se tomaban como separadores y partían fechas y títulos; (c) la descripción del voluntariado (un párrafo sin viñeta) se perdía.

**Cómo se diagnosticó.** Con el texto original del mismo archivo (`sourceText` en `data/profile.json`): listar los encabezados que sí se reconocen (`splitSections`) y ver en cuál terminaba el bloque. No hizo falta IA ni el navegador.

**Arreglo.**
- `lib/cv/sections.ts`: encabezados combinados (es/en) se reconocen como estudios (`COMBINED_EDUCATION`, `isCombinedEducationTitle`).
- `lib/cv/extras.ts` (`splitEducationAndCertifications`) y `lib/cv/pipeline.ts` (`educationAndCertificationText`): una sección combinada se reparte línea por línea; certificado, curso, diplomado, bootcamp, plataforma de cursos → certificaciones (los diplomados cuentan como certificación, a pedido de Juan); lo demás → estudios.
- `lib/cv/heads.ts` (`splitEducation`): un título sin institución ni año espera a su institución de la línea siguiente.
- `lib/cv/extras.ts` (`piece`): la barra `|` es el separador principal; el rango de fechas se extrae antes de partir; «Feb 2026», «2024» y «En curso» como parte suelta son la fecha. El voluntariado conserva su descripción como viñeta.
- `LOGIC_VERSION` = 9 y la guarda (`tests/logic-version.test.ts`) ahora incluye este caso real: **la guarda anterior no lo habría detectado** porque sus textos de muestra no tenían un encabezado combinado.

**Regla nueva.** Cada vez que un CV real revele un caso que la lógica no leía, ese fragmento se agrega a `tests/logic-version.test.ts` y a una prueba propia (`tests/cv-extras.test.ts`, fragmento real de Juan). Si la guarda no falla al cambiar la lógica, sus muestras no cubren el caso.

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
