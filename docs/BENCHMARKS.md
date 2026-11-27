# Mediciones (Fase F)

Máquina: Apple M4, 16 GB, macOS. Ollama 0.40.16 (runner `llamacpp`), `num_ctx` 8192, `temperature` 0, `think:false`, `keep_alive` 60 min. Todo medido el 17-nov-2026 contra el Ollama local. Reproducir: `pnpm bench` (datos crudos en `docs/bench-results.json`; `BENCH_MODELS="a,b"` elige modelos).
Calidad (0–1) = esquema válido + guardia anti-invención. CV: nombre, ≥1 puesto y fortalezas ancladas al texto. Oferta: título, ≥1 requisito, 0 descartados por la guardia y cada ítem existe en la fuente.
Una sola ejecución por celda (sin repeticiones): las diferencias de ~1 s no son concluyentes.

## Modelos (3 CVs + 3 ofertas)

| Tarea | Entrada | qwen2.5:7b-instruct | gemma4:e4b | qwen3.5:9b |
|---|---|---|---|---|
| CV | cv-tipico.txt | 1,8 s · 1,00 | 2,1 s · 1,00 | 4,6 s · 1,00 |
| CV | cv-english.txt | 2,4 s · 1,00 | 1,2 s · 1,00 | 3,1 s · 1,00 |
| CV | cv-sin-secciones.txt (método clásico) | 36,9 s · 1,00 | **489,6 s · 0,00 (timeout)** | 19,9 s · **0,67 (0 puestos)** |
| Oferta | texto.txt | 11,8 s · 1,00 | 8,1 s · 1,00 | 14,3 s · 1,00 |
| Oferta | linkedin-post-hilo (ruido) | 13,3 s · 1,00 | 6,2 s · 1,00 | 15,5 s · 1,00 |
| Oferta | main.html | 10,4 s · 1,00 | 5,8 s · 1,00 | 9,9 s · 1,00 |
| Carga en memoria | primera vez | 0,0 s (ya cargado) | 8,1 s | 4,3 s |
| `ollama ps` | | 5,1 GB · 100 % GPU | 10,0 GB · 100 % GPU | 9,0 GB · 100 % GPU |

Oferta = limpieza + estructuración (p. ej. qwen2.5 en texto.txt: 6,5 s + 5,3 s).
Lectura: con CVs con secciones (el camino habitual) los tres son rápidos y correctos. Gemma 4 es el más rápido en ofertas (≈ 6–8 s vs 10–13 s) pero **falló el CV sin secciones** (timeout de 5 min). Qwen 3.5 9B **no extrajo ningún puesto** en ese mismo CV. Solo qwen2.5 lo resolvió bien (37 s).

## Metas de la fase (con el modelo por defecto, qwen2.5:7b-instruct)

| Meta | Resultado medido |
|---|---|
| Perfil < 60 s | CV con secciones 1,8–2,4 s; escaneado (OCR) **1,0 s**; sin secciones 36,9 s |
| Oferta < 20 s | 10,4–13,3 s (limpieza + estructura); 5,5–6,7 s si el texto ya viene limpio |
| Primer cambio de reescritura < 15 s | **No medido en esta fase** (la reescritura no se tocó); queda para la Fase G |

## Experimentos

- **Carga y `think`** (tarea de 41 tokens): `think:false` en qwen3.5:9b 2,4 s vs **55,1 s** con razonamiento activo (594 tokens de «pensamiento»); en gemma4:e4b sin `think:false` el resultado no fue JSON (15,3 s, texto plano) y con `think:false` 1,1 s. qwen2.5 lo ignora (2,3 s). Por eso `think:false` va siempre (`OLLAMA_THINK=true` lo activa).
- **`num_ctx`** (qwen2.5, mismo prompt): alternar 8192 ↔ 4096 ↔ 2048 recarga el modelo y hace perder la caché de prefijo en cada cambio (8,4–8,5 s vs 0,9–1,3 s sin cambio); la velocidad de generación fue igual (≈ 11 tok/s). Decisión: **un único `num_ctx` = 8192** para todas las etapas.
- **Prefijo estable** (CV de 611 tokens, `prompt_eval`): qwen2.5 con CV primero y tarea al final: 1.ª 6,59 s → 2.ª **0,53 s** → 3.ª 0,28 s; con la tarea primero: 6,6 s en todas (no reutiliza). gemma4: 2,04 → 1,85 → 0,16 s (la 3.ª sí); qwen3.5: 6,51 → 5,70 → 0,26 s. Conclusión: ordenar el prompt como [instrucciones fijas → CV → tarea variable] permite reutilizar el CV entre llamadas (qwen2.5 desde la 2.ª; los otros desde la 3.ª). Es un efecto real pero variable por modelo.
- **Caché de resultados** (servidor real): CV 6,8 s → 0,0 s; oferta 38,1 s → 0,0 s (misma huella, mismo modelo/prompts/esquemas).
- **OCR** (`scanned.pdf`, 1 página): 0,93 s. Antes la lectura tardaba 54 s porque el OCR escribió «EXPERTENCIA» y el encabezado no se reconocía (caía al método clásico); ahora la sectorización tolera erratas → 1,0 s y 0 llamadas LLM. El paralelismo por página (límite 2, `OCR_CONCURRENCY`) está implementado pero la prueba tiene 1 página: **su ganancia no está medida**.
- **Estructurar la oferta**: pedir el JSON completo ≈ 22 s (≈ 180 tokens a ~8 tok/s); pedir solo números de línea ≈ 5,5–6,7 s (≈ 40–54 tokens), el resto se deriva sin IA y cada ítem es una línea literal.
- **Caché KV cuantizada (`OLLAMA_KV_CACHE_TYPE=q8_0`)**: **no evaluada**. Requiere reiniciar el servidor de Ollama de Juan con una variable de entorno; no lo hice sin su aprobación. Pendiente.
- Decodificación especulativa: no implementada (fuera del alcance indicado).

## Fase K4 — juez local de la rúbrica (18-nov-2026)

Modelo: `qwen2.5:7b-instruct` (el de `.env.local`), Ollama real. `bench/fit-judge.test.ts`: 3 CV de referencia (`tests/fixtures/fit-cases.ts`) × 3 repeticiones, una llamada por CV que evalúa hasta 3 criterios (fórmula del resumen, logros acción-contexto-resultado, habilidades transversales demostradas). Datos crudos: `docs/bench-fit.json`.

| Diseño del juez | Resultado medido |
|---|---|
| El modelo copia la cita textual (evidencia opcional) | 9 de 9 llamadas fallaron la validación: omitía `evidence` aunque el esquema la admitía como nula |
| El modelo copia la cita textual (evidencia obligatoria) | 5 de 9 llamadas agotaron el tiempo (entre 9 y 17 min cada una, antes de existir el límite); en las que respondió, 1 cita no era literal |
| **El modelo señala el NÚMERO del fragmento** (diseño adoptado) | **9 de 9 correctas, 0 citas descartadas, veredictos idénticos en las 3 repeticiones de cada CV** |

Tiempo por llamada del diseño adoptado: CV fuerte 25,6–36,2 s · medio 14,1–20,8 s · débil 8,4–8,9 s (la llamada es más larga cuanto más fragmentos recibe). Límite de seguridad: 90 s por llamada; si se agota, la ficha se calcula con las reglas y se avisa.

Veredictos con el diseño adoptado (global de la ficha con juez): fuerte 99 · medio 65 · débil 14; el orden coincide con el esperado.

**Lecturas honestas**
- El juez es estable, pero con este modelo es **indulgente en los logros**: calificó «cumple» la fórmula de logros del CV medio, cuyas viñetas son «Responsable de reportes en Excel», «Preparé tableros en Tableau» y «Usé SQL para consultas básicas» (sin resultado). La señal objetiva de logros (cifras, verbos) viene de las reglas, no del juez; el juez solo aporta matiz. No se debe presentar el veredicto del juez como si fuera una verdad independiente.
- La misma lección que en la lectura de ofertas: con modelos de 7B, pedirles que señalen un número es mucho más fiable que pedirles que copien texto.
- Una sola oferta y tres CV de referencia: es una prueba de integridad y estabilidad, no una medida de precisión general. Pendiente: ampliar el conjunto con CV y ofertas reales de Juan cuando los aporte.

## Fase K6 — ciclo de calidad «regenerar solo lo débil» (18-nov-2026)

Modelo: `qwen2.5:7b-instruct`, Ollama real. `bench/improve.test.ts`: reescritura de las viñetas del puesto más reciente de 2 CV de referencia (`tests/fixtures/fit-cases.ts`), cada propuesta puntuada con el motor de fit (efecto de aplicar SOLO ese cambio) y regeneración de las débiles (efecto ≤ 0), máximo 2 rondas. Datos crudos: `docs/bench-improve.json`. Una sola ejecución por CV (no hay repeticiones: es una medición de comportamiento, no de estabilidad).

| CV | Propuestas con cambio | Débiles antes | Regeneraciones (2 rondas) | Mejoraron | Descartadas (empeoraban) | Débiles después | Tiempo generar → mejorar |
|---|---|---|---|---|---|---|---|
| fuerte | 4 | 4 | 7 | 1 (efecto +1) | 1 (efecto −5) | 2 (neutras, quedan al final) | 21,7 s → 29,9 s |
| medio | 2 | 0 | 0 | — | — | 0 | 4,9 s → 0,02 s |

**Lecturas honestas**
- El ciclo sirvió para lo más importante: **detectó una reescritura del modelo que empeoraba la ficha en 5 puntos** (CV fuerte, viñeta 3) y la descartó antes de pedirle una decisión a la persona. Sin la medición, esa propuesta se habría mostrado como una mejora.
- La regeneración con un modelo de 7B **rara vez mejora**: de 7 intentos, 1 produjo una mejora medible (+1 punto). Gasta ~30 s por CV para ese resultado. Por eso las propuestas neutras no se descartan: quedan con prioridad baja.
- Con un solo CV fuerte y uno medio no se puede afirmar una tasa de mejora general. Falta medir con CV y ofertas reales de Juan.

## Fase K9-A — OCR de PDF escaneado por página completa y franjas (19-nov-2026)

PDF real de prueba (`cv-de-prueba.pdf`, 8,7 MB, 1 página de 1080×5568 pt compuesta por 4 imágenes: un banner de 5760×1056 y tres capas de ~2556×9604). Una sola ejecución por variante, Tesseract spa+eng, 2 workers.

| Variante | Nombre leído | Tiempo de extracción | Notas |
|---|---|---|---|
| Antes: solo la imagen incrustada más grande | **No** (el texto empezaba en «Bogotá, Colombia») | 18,0 s (OCR 10,7 s, de `data/timings.log`) | el banner con el nombre quedaba fuera |
| Página renderizada completa, una sola imagen | Sí | 31,5 s | perdía líneas junto al banner decorativo |
| **Renderizada + franjas de 800 px cortadas en filas vacías + filtro de ruido (adoptada)** | **Sí («Mario Quintero»)** | **19,1 s** | recupera «Acerca de mí» y todo el resumen; el banner deja unas líneas de ruido que no afectan la identidad |

Lectura honesta: una sola CV y una sola ejecución; el tiempo es comparable al anterior, no más rápido en general. El filtro de ruido solo elimina líneas y se probó con líneas reales del CV (`tests/ocr-clean.test.ts`).

## Fase K9-B/C/D — lectura estructural y segmentación asistida (19-nov-2026)

Modelo: `qwen2.5:7b-instruct`, Ollama real. Una ejecución por CV (no hay repeticiones: es comportamiento, no estabilidad). Texto del CV de Juan = salida del OCR de K9-A.

| CV | Antes | Ahora | Qué cambió |
|---|---|---|---|
| CV de Juan (diseño, OCR) | «3 puestos», 2,9 años; 41–48 s (la llamada de formación tardó 32 s) | **7 puestos, 7 empresas, 10,9 años (por fechas), 10,0 s** (2 llamadas: 1 de cabecera ambigua 2,5 s, 1 de fortalezas 6,7 s) | cada línea con rango de fechas abre un puesto; el modelo ya no se llama para la formación si alguna entrada es segura |
| Word plano sin títulos de sección, con fechas (`tests/fixtures/cv-word-plano.txt`) | método clásico (≈ 37 s en CV sin secciones, medición de K1) | **9,0 s**, 2 puestos con empresa y fechas, 3 logros, 10,8 años | el modelo solo señala números de línea (8,9 s); el resto es determinista |
| Texto corrido sin fechas ni títulos (`cv-sin-secciones.txt`) | clásico, ≈ 33 s | clásico, 36,2 s (3,3 s de segmentación descartada + 32,9 s) | sin fechas no hay forma fiable de partir; la segmentación se descarta y se usa el respaldo (costo extra ≈ 3 s) |

Lecturas honestas
- Son 3 CV (uno real y dos de prueba): demuestra el mecanismo, no una precisión general. Pendiente: probar con CVs reales de formato malo.
- Las «habilidades principales» salen de la taxonomía; algunas coincidencias son discutibles (p. ej. «Cumplimiento normativo» por «auditorías de consistencia» en un CV de diseño). Se muestran como lo que el CV nombra, pero conviene ampliar/afinar la taxonomía.
- «Itti Tecnologia» incluye la palabra de sector que el diseño pone al lado de la empresa.

## Migración a Supabase — latencia de la base en la nube (19-nov-2026)

Proyecto Sooosh (sa-east-1, São Paulo), conexión por el «Transaction pooler» desde la máquina de Juan (Colombia), driver `postgres` + Drizzle. Una ejecución, 10 repeticiones tras la primera.

| Medición | Resultado |
|---|---|
| Primera consulta (incluye abrir la conexión) | 843–991 ms |
| `loadPreferences` (2 consultas) en serie | mediana 405 ms (401–479) |
| `loadPreferences` con las 2 consultas en paralelo (adoptado) | **mediana 279 ms** (273–310) |

Lectura: cada consulta cuesta ≈ 200 ms de viaje de red. Cada reescritura de un grupo del CV paga ese costo una vez (antes, con SQLite local, era ~0). Por eso la caché de resultados (que se consulta en cada lectura de CV y de oferta) se quedó local, y la memoria se lee en paralelo. Medido contra el servicio real; no es un promedio de uso.

## Buscador L1 — analizar una oferta para tarjeta (19-nov-2026)

Servidor real (puerto 3000), `qwen2.5:7b-instruct`, Supabase real. Una ejecución con una oferta de prueba en español (≈ 1 000 caracteres, texto pegado): **13,0 s** de `/api/jobs/analyze` (limpieza + estructura con el modelo local + borrador determinista de país, regiones, modalidad y contrato). El enlace y el guardado (`/api/jobs`) responden en el orden de 0,3–1 s (una consulta a São Paulo ≈ 200 ms). Una sola oferta: no es un promedio.

## Buscador L2 — búsqueda por texto, significado y región (19-nov-2026)

Servidor real (puerto 3000), Supabase real (sa-east-1), `bge-m3` por Ollama. 5 ofertas de prueba (se borraron al terminar) y 12 consultas; una ejecución.

**Calibración del umbral semántico** (distancia coseno entre la consulta y la oferta, `jobs.embedding <=> vector`):

| Tipo de consulta | Mejor coincidencia | Peor coincidencia (de 5) |
|---|---|---|
| Relevantes («diseñador de producto», «ingeniería de datos», «data engineer», «UX research», «analista de información…») | **0,39 – 0,45** | 0,60 – 0,69 |
| Sin relación («cocinero», «abogado laboral», «enfermera», «vendedor de seguros», «contador») | **0,57 – 0,59** | 0,65 – 0,71 |

Con solo 5 ofertas el margen es estrecho: el umbral quedó en **0,54** (`MAX_SEMANTIC_DISTANCE`). Con 0,60 «cocinero» devolvía una oferta de ingeniería; con 0,54 devuelve nada. Hay que recalibrar con ofertas reales (más ofertas ⇒ más vecinos cercanos a cualquier consulta).

**Tiempos** (de la petición a la respuesta, incluida la ida a São Paulo):

| Operación | Resultado |
|---|---|
| Filtro por región/modalidad, sin texto | 285–670 ms |
| Texto + significado (incluye calcular el vector de la consulta con bge-m3) | 556–878 ms |
| Guardar una tarjeta con su vector | ≈ 1,4 s por tarjeta (5 en 6,8–8,4 s) |

Los filtros de región se verificaron con las 5 ofertas: Colombia ve las de CO y las remotas abiertas a toda Latinoamérica; México ve las de MX y esas mismas; EE. UU. y España ven solo las suyas (las remotas LATAM no se les muestran).

## Investigación de fuentes de empleo (19-nov-2026)

Una ejecución, desde la máquina de Juan; detalle y fuentes en `docs/FUENTES-DE-EMPLEO.md`.

| Medición | Resultado |
|---|---|
| Get on Board `/api/v0/search/jobs?per_page=100` (sin clave) | 979 ofertas en 10 páginas (≈ 12 s con pausa de 1,2 s): Chile 499, remotas 386, Colombia 35, Perú 32, México 25, Argentina 8 |
| Tableros ATS públicos (de ~100 tokens probados, 15 existían) | Cabify 46 (23 en la región), Clara 140 (39), Despegar 111 (38), Addi 33 (32 en Colombia), Mural 12 (5), Fintual 4 (3), Okta 366 (0) |
| `computeFit` contra el CV real, 1 000 ofertas sintéticas | 7 596 ms en total = **7,6 ms por oferta** |

## Buscador L3 — sincronización de fuentes (19-nov-2026)

Servidor real de Supabase (sa-east-1) desde Colombia; una ejecución de cada una (no hay repeticiones).

| Medición | Resultado |
|---|---|
| Get on Board, lectura completa (10 páginas de 100, pausa de 1,2 s) + normalización + guardado | **30,5 s**: 978 leídas, 2 fuera de la región, **976 nuevas** |
| Misma sincronización otra vez (idempotencia) | 30,3 s: 0 nuevas, 976 actualizadas, 0 cerradas (no duplica) |
| Empresas por tablero | Clara 139 nuevas (3,0 s), Despegar 108 de 111 (8,3 s), Addi 33 de 33 (2,0 s), Cabify 28 de 46 (1,7 s; 18 eran de Madrid u otras regiones), Mural 5 de 12 (1,8 s), Fintual 4 de 4 (2,9 s), Bold 0 de 1 |
| Total en `jobs` tras la primera carga | **1 294 ofertas activas**: LATAM 1 294, Chile 521, México 143, Colombia 137, Brasil 113, Argentina 66, Perú 39 |
| Calidad del contenido (ofertas con ≥ 2 requisitos o tareas, necesarias para estimar el encaje) | Get on Board 898 de 976, Clara 129 de 139, Addi 32 de 33, Despegar 53 de 108, **Cabify 2 de 28, Fintual 0 de 4** |
| Búsqueda sobre la base grande | Filtro por región 283–1 124 ms; texto + significado 598–3 417 ms (esta última incluye cargar bge-m3 y solo 466 de 1 294 ofertas tenían vector) |
| Vectores (bge-m3) en bloques de 24 | ≈ 1,9 ofertas por segundo (192 en 103 s) |

Lectura honesta: son una sola carga y una sola máquina. El umbral semántico de 0,54 se calibró con 5 ofertas; con 1 300 hay más vecinos cercanos a cualquier consulta y hay que recalibrarlo cuando todas tengan vector.

## Buscador — tecnología, match y encaje sobre la base grande (19-nov-2026)

Base real (1 294 ofertas), Supabase desde Colombia, `bge-m3` local; una ejecución. CV de diseño y de desarrollo escritos para la prueba (sintéticos) y el CV de `data/profile.json` (lectura vieja de Juan, «Sin nombre»).

**Clasificación por familia de cargo (reglas, sin IA)** sobre las 1 294 ofertas:

| Medición | Resultado |
|---|---|
| Solo con el título | 693 de 1 294 en tecnología (54 %); 236 ofertas en «otros» |
| Con el título + el área que declara la fuente (Get on Board «Programming», ATS «Engineering»…) | **«otros» bajó a 42** (3 %); tecnología: Get on Board 73 %, Addi 36 %, Despegar 23 %, Clara 22 %, Cabify 4 % (son en su mayoría cargos comerciales, de operación y soporte) |
| Revisión a ojo de una muestra | Cargos técnicos de Clara, Addi y Despegar bien clasificados (Product Owner, SecOps, Analytics Engineer, Tech Lead…); «Market Manager» y «Account Strategist» (comercial de viajes) quedan fuera de tecnología |

**Encaje con el CV y match ≥ 75 %** (pre-orden de candidatas por cercanía de vectores CV↔oferta; 80 candidatas puntuadas con `computeFit`):

| CV | Región | 1.ª vez | 2.ª (caché) | Mejores puntajes | Match (≥ 75) en las 80 |
|---|---|---|---|---|---|
| Desarrollo (prueba) | LATAM | 0,8 s | 0,4 s | 78, 78, 76, 71, 67 | **3** |
| Desarrollo (prueba) | Colombia | 0,5 s | 0,4 s | 76, 71, 70, 67, 67 | **1** |
| Diseño (prueba) | LATAM | 3,7 s | 0,7 s | 68, 67, 64, 64, 64 | **0** |
| Diseño (prueba) | Colombia | 2,3 s | 0,4 s | 64, 57, 54, 53, 53 | **0** |
| Lectura vieja de Juan | LATAM / Colombia | 1,5 s / 2,8 s | 0,7 s / 0,4 s | 58…54 / 54…50 | 0 / 0 |

Sin el pre-orden por vectores y con 200 candidatas, la primera vez tardaba 2,8–6,5 s (≈ 32 ms por oferta real, no los 7,6 ms de ofertas sintéticas); con 80 y vectores, 0,5–3,7 s, y con caché menos de 1 s.

Lectura honesta: con las reglas solas (sin el juez de IA) casi ninguna oferta llega a 75 % (de 3 a 0 de 80). Es un umbral exigente para este motor; el juez local de las capas de IA debería subir los puntajes de las ofertas bien alineadas, o conviene revisar el umbral con tu CV real. Son CV de prueba y una lectura vieja: hay que repetir la medición con el CV actual de Juan.

## Enriquecimiento de ofertas pobres con IA local (19-nov-2026)

`qwen2.5:7b-instruct` en Ollama local; texto compacto (≤ 60 fragmentos y ≈ 3 000 caracteres) y el modelo solo señala números de fragmento. 167 ofertas en cola (las de menos de 2 elementos entre requisitos, deseables y tareas); una sola corrida.

| Medición | Resultado |
|---|---|
| Primer diseño (`parseOfferText` con el texto completo de la oferta) | **169 s** por oferta (el modelo lee ≈ 90 tokens/s en esta máquina; el tamaño del texto manda) |
| Diseño final (texto compacto + fragmentos) | **8–17 s por oferta** (promedio por ronda de 10: 8,2 · 12,5 · 14,6 · 16,6 · 13,4 · 13,1 · 11,6 · 9,2 · 12,2 · 11,3 · 13,7 · 15,5 · 12,0 · 16,6 · 17,0 · 17,1 s); 16 rondas en ≈ 40 min |
| Resultado | **158 mejoradas**, 7 sin cambios (el modelo no señaló nada útil), 2 fallidas tras 3 intentos |
| Fallo corregido en el camino | el modelo devolvió más de 14 fragmentos y la respuesta se rechazaba: ahora se acepta hasta 60 y el código se queda con los primeros |
| Ofertas con ≥ 2 elementos de estructura (de 1 294 activas) | antes: Get on Board 898 de 976, Clara 129 de 139, Despegar 53 de 108, **Cabify 2 de 28, Fintual 0 de 4** → después: Get on Board 973 de 975, Clara 139, Despegar 96 de 108, Addi 32 de 33, **Cabify 28 de 28, Fintual 4 de 4**, Mural 5 de 5 (≈ 1 271 de 1 294) |
| Vectores (bge-m3) de las que cambiaron | 159 calculados, 0 pendientes; las 1 294 tienen vector |

Revisión a ojo de una muestra: los requisitos y tareas son frases literales del aviso (p. ej. «Título profesional de Ingeniería Civil Industrial…», «Gestionar el ciclo completo de incentivos…»). Hay avisos con solo tareas y sin requisitos (el aviso no los separa).

## Analizador de ofertas A4 — bloques, conciliación y conjunto de prueba (20-nov-2026)

Conjunto de desarrollo: 6 publicaciones con la respuesta esperada (`bench/gold/offers.json`; **5 escritas por nosotros** con la estructura de publicaciones de LinkedIn —sin cargo, con encabezados en español e inglés, en prosa— y 1 fixture existente con comentarios), 2 repeticiones por caso, `qwen2.5:7b-instruct` real, pipeline completo (limpieza + estructura). Es un conjunto pequeño de desarrollo, no una medida de precisión en el mundo real: crecerá con las publicaciones reales que se guarden. Ejecutar: `pnpm exec vitest run --config vitest.bench.config.mts bench/offers-gold.test.ts` (resultado en `docs/bench-offers.json`).

| Medición (12 muestras) | Antes de A4 | Después, sin conciliar | Después, con conciliación |
|---|---|---|---|
| Cargo correcto | 83 % | 100 % | 100 % |
| Empresa correcta | 100 % | 100 % | 100 % |
| Recall de las listas (requisitos, funciones, se valora) | 94 % | 100 % | 100 % |
| Líneas intrusas en las listas (encabezados, contacto, beneficios, hashtags) | 2 de 26 posibles | 4 de 32 | **0 de 32** |
| Vías de postulación detectadas (correo y formulario) | 83 % | 100 % | 100 % |
| Tiempo medio por publicación (limpieza + estructura, modelo local) | 12,8 s | 12,2 s | 12,2 s (la conciliación son reglas, sin llamadas al modelo) |

Qué movió cada cifra (hallazgos de la propia medición): (1) el correo tras un enlace con puntos («Apply at https://… or email talent@…») no se detectaba → nueva pista «email/correo» en `detectApply` (postulación 83 → 100 %); (2) la limpieza con el modelo descartaba a veces **una línea suelta** entre dos conservadas (un requisito de la sección) → se recupera (recall 94 → 100 %); (3) el modelo metía encabezados en inglés («What you'll do») y líneas de contacto en las listas, y mezclaba listas → la conciliación con los bloques las corrige (intrusos 4 → 0 de 32); (4) «Experiencia con Power BI o Tableau» se confundía con un encabezado → los rótulos débiles solo cuentan si son la línea completa. El «cargo» 83 → 100 % combina una expectativa corregida (un cargo sacado de «We're hiring a …» es **inferido**, no escrito) y no es mejora de código. Entre repeticiones el modelo varía (los intrusos sin conciliar fueron 8 y luego 4 en dos corridas), por eso se compara sobre la misma salida del modelo.

No se añadió una segunda pasada del modelo para verificar cada dato: con este conjunto la verificación determinista de A2 (cada dato con su frase de evidencia) ya cubre lo medido, y una pasada extra costaría otros ≈ 10 s por oferta. Se reconsidera si el conjunto, ya con publicaciones reales, muestra errores que las reglas no atrapan.

## Conexión a Supabase por el pooler de transacciones: consultas encadenadas (20-nov-2026)

Mismo guion (10 consultas simultáneas por ronda sobre `select count(*) … from jobs`, límite de 4 s por consulta), `postgres.js` contra el pooler `:6543`, con pausas para que actúe `idle_timeout`: **pool de 5 con el valor por defecto (`max_pipeline` 100): 5 de 80 respondieron; `max_pipeline: 1`: 80 de 80 (4 s); una sola conexión con `max_pipeline: 1`: 80 de 80**. Antes de encontrar la causa se midió también que recrear el pool tras un fallo y reintentar daba 48 de 48 en rondas de 8 consultas, pero bajo 10 peticiones simultáneas a la app respondía 502 en 5 de 10 → la reparación sola no basta; la causa era el encadenamiento. En la app (servidor real, 3 rondas de 10 búsquedas simultáneas separadas 22 s) con `max_pipeline: 1`: las rondas 2 y 3 respondieron las 10 en 0,8–1,8 s sin recrear conexiones (la ronda 1 aún usaba el pool anterior).

## Analizador de ofertas A5 — limpieza conservadora y datos estructurados de LinkedIn (21-nov-2026)

**Problema medido** (publicación real de Vos Consultora que guardó Juan, reproducida con el código real y `qwen2.5:7b-instruct`): la limpieza con el modelo quitaba contenido propio de la oferta. Por enlace borró la primera línea (el cargo); pegando el texto borró 4 de las 6 líneas (requisitos y la línea del correo incluidos), y «Modalidad: Remoto» terminó como una función. La página pública del post además publica en sus datos estructurados (`SocialMediaPosting`) el perfil que publica (`author: Organization «Vos Consultora»`) y la fecha real (29-oct-2026), que no se leían.

**Medición** (conjunto `bench/gold/offers.json`, ahora 7 casos —el nuevo es el texto real de esa publicación—, 2 repeticiones, 14 muestras por columna; «sin» = limpieza como antes, «con» = limpieza conservadora):

| Medición | Sin protección | Con protección |
|---|---|---|
| Recall de las listas | 86 % (la publicación real: 0 de 3 requisitos) | **100 %** |
| Líneas intrusas en las listas | 0 de 38 | 0 de 38 |
| Empresa correcta | 100 % | 100 % |
| Cargo y vías de postulación | 100 % / 100 % | 100 % / 100 % |
| Tiempo medio por publicación | 11,3 s | **7,0 s** (12 de 14 muestras no llamaron al modelo: todo era claramente propio de la oferta) |

Notas de honestidad: (1) una medición intermedia dio «empresa» 86 % en ambas columnas por «crecimiento. ¿Qué buscamos?», que salía de partir la frase de apertura por «en» y pasaba el filtro de empresas; el filtro se endureció (sin «¿?», sin punto final, sin frases en minúscula) y la cifra de la tabla es posterior a ese arreglo, por eso aplica a las dos columnas; (2) el conjunto sigue siendo de desarrollo (6 de 7 casos escritos o escogidos por nosotros); (3) la protección omite la IA solo cuando quedan menos de 3 líneas dudosas: con comentarios de otras personas (hilos) el modelo sigue decidiendo esas líneas.

**Prueba de punta a punta con la publicación real** (enlace vs texto pegado, mismos pasos que el administrador): por enlace ahora salen cargo «Diseñador/a UX/UI» (inferido), **empresa «Vos Consultora»** (perfil que publica, de los datos estructurados), **fecha 29-oct-2026**, 3 requisitos, correo como otra vía; pegando el texto salen el mismo cargo, los mismos 3 requisitos y el correo (sin empresa ni fecha: el texto pegado no las trae). Antes, por texto: 0 requisitos, sin correo y empresa «crecimiento. ¿Qué buscamos?».

## «Pedir otro asunto» del panel de correo (21-nov-2026)
Medición pequeña y puntual (2 llamadas, no un benchmark): `POST /api/email/subject` contra el Ollama local del servidor de desarrollo, con el cargo «Diseñador/a UX/UI», la empresa y un nombre de prueba.
| Llamada | Origen | Tiempo |
|---|---|---|
| 1.ª (modelo en frío) | IA | 7,5 s |
| 2.ª | IA | 2,2 s |
Con una muestra de 2 no hay mediana ni percentiles; es solo una referencia de que el botón responde en unos segundos. Pendiente: medir con más llamadas si se quiere citar una cifra.

## Propuestas del cuerpo del correo con IA local (21-nov-2026)
Medición pequeña y puntual contra el Ollama local del servidor de desarrollo: `POST /api/email/body` con 3 peticiones en paralelo (una por ángulo; el modelo las atiende de a una), cargo «Diseñador/a UX/UI», 3 requisitos y hechos de un CV de prueba.
| Ajustes | 1.ª en llegar | 2.ª | 3.ª |
|---|---|---|---|
| medio · cercano · variado (modelo recién usado con otro contexto) | 21,3 s | 35,4 s | 49,9 s |
| corto · directo · variado | 21,0 s | 28,2 s | 36,6 s |
En las 6 respuestas las 3 propuestas pasaron la verificación (ninguna cayó a plantilla). Es una sola corrida por fila: no hay mediana ni percentiles. **Hallazgo**: pasar `numCtx` distinto del predeterminado (8192) en las llamadas de esta función hacía que Ollama recargara el modelo en cada llamada (una tanda de 3 peticiones superó los 120 s); por eso estas llamadas usan el contexto predeterminado y solo limitan `numPredict`. La primera tanda con un solo `numCtx` fijo de 4096 y 3 propuestas en una llamada tardó entre 7,7 s y 39 s, y el modelo devolvía 1 propuesta por llamada (por eso hoy se piden por separado).

## Guía de redacción en el prompt del cuerpo del correo (22-nov-2026)
Pregunta: ¿agregar al prompt la guía de `docs/CONOCIMIENTO-UX-CONTENT.md` mejora las propuestas del cuerpo? Banco: `bench/email-guide.test.ts` contra el Ollama real (`qwen3.5:9b`), caso «Diseñador/a UX/UI» con hechos de un CV de prueba, 3 tonos × 3 ángulos × 2 repeticiones = 18 muestras por variante, longitud «medio», el modelo calentado antes. Métricas **por reglas** (no miden si el texto «suena mejor»): % que pasa el verificador de datos de antes, % que pasa el verificador completo (datos + estilo) y tiempo por llamada. Textos completos en `docs/bench-email-body.json` y `docs/bench-email-body-min.json`.

| Variante | Mediana | Palabras (media) | Pasa datos | Pasa completo |
|---|---|---|---|---|
| Sin guía (corrida 1) | 10,3 s | 51 | 100 % | 89 %* |
| Guía completa (≈ 170 palabras + 1 ejemplo por tono) | 12,1 s | 36 | 89 % | 61 % |
| Sin guía (corrida 2) | 10,8 s | 54 | 100 % | 100 % |
| Guía mínima (3 líneas, sin ejemplo) | 10,5 s | 52 | 94 % | 89 % |

\* 2 de 18 marcados por un falso positivo del verificador («me permiten» contado como relleno); corregido antes de la corrida 2.

**Lectura honesta**: (1) sin guía el modelo ya escribe casi limpio (0 exclamaciones, 0 emojis, 0 aperturas de relleno en 36 muestras), así que no hay margen que mejorar por reglas; (2) la **guía completa** costó ≈ 1,8 s de mediana, acortó los textos (36 palabras frente a 51: dos cayeron por debajo del mínimo de «medio») y **subió los rechazos**; (3) la **guía mínima** no cuesta tiempo ni longitud, pero tampoco mejora: 1 frase larga y 1 palabra con mayúscula no respaldada («Proyectos») en 18 muestras; (4) con 18 muestras por variante y un solo caso, diferencias de 1 o 2 muestras son ruido; (5) un caso de la guía completa tardó 49 s (probable recarga del modelo). **Decisión**: la guía va **apagada** en el prompt (opción `guide` de `suggestBodies`); se conserva el **verificador de estilo** (sin costo de tiempo), que sí descarta exclamaciones, emojis, aperturas y frases de relleno y gerundios de posterioridad. Quedan sin medir: calidad percibida por personas, otros casos de oferta, inglés y el efecto de ejemplos escritos con el tono real de Juan.

## Versión ATS · lectura profunda del CV original (A5, 23-nov-2026)
Medición propia, qwen2.5:7b-instruct local (Ollama), un CV real de 11 500 caracteres de texto OCR, 12 puestos, equipo de desarrollo de Juan. **Pocas muestras: no es un benchmark estadístico.**

| Intento | Diseño | Tiempo | Resultado |
|---|---|---|---|
| 1 | La IA copia todo (viñetas incluidas) | 219 s | Contenido bueno, pero viñetas con tareas mezcladas; 3 páginas, 89 % |
| 2 | Igual, pidiendo todos los puestos | 665 s | **Respuesta cortada por el límite de salida; sin datos** |
| 3 | La IA da números de línea de las viñetas | 175 s | Puestos bien; **viñetas mal** (el modelo no acierta números de línea) |
| 4 | La IA solo identifica puestos; el código lee viñetas por bloques | **162 s** | Puestos, fechas y 14 viñetas correctos; 3 páginas; 91 % |

Lecciones: pedirle a un modelo de 7 B que reproduzca texto largo es lento y se corta; que cuente líneas es poco fiable; que **solo identifique** y deje el copiado al código es lo que funciona. La lectura se hace una vez por CV; «Generar de nuevo» la reutiliza. Los tiempos incluyen la carga del modelo y varían con la máquina.

## Versión ATS · lectura profunda por modelo (A8, 24-nov-2026)
Medición propia: un CV real de 11 500 caracteres de texto OCR (12 puestos; 6 son los que la lectura debe encontrar), Mac M4 de 16 GB, Ollama local, `bench/ats-extract.test.ts` (el CV es un dato personal y se pasa por entorno; no está en el repositorio). **Una muestra por celda salvo donde se indica: no es un benchmark estadístico.** «Falla» = no devolvió un resultado válido dentro del límite de 5 min por llamada (`REQUEST_TIMEOUT_MS`), con reintentos.

| Modelo | Tiempo | Resultado |
|---|---|---|
| `gemma4:e4b` (9,5 GB) | **43 · 53 · 52 s** (3 corridas; una cuarta tardó 96 s con la memoria saturada por modelos anteriores) | 6 de 6 puestos con fechas, 14 viñetas, 19–20 habilidades, 7 de 7 proyectos con texto, 4 certificaciones |
| `qwen2.5:7b-instruct` (4,7 GB), el modelo anterior | 134 s (en A5: 162–220 s) | igual calidad |
| `qwen3.5:9b` (7,6 GB) | falla (183 y 330 s) | modelo con razonamiento; no devolvió JSON válido a tiempo |
| `qwen2.5:14b-instruct` (9,0 GB) | falla (300 s, dos corridas) | agota los 5 min por llamada |
| `qwen3:14b` (9,3 GB) | falla (300 s, dos corridas) | idem |
| `phi4` (9,1 GB) | falla (682–969 s) | idem |

**Modo «reducido»** (la IA solo escribe puestos, habilidades y nombres de proyecto; el código copia lo demás): con `gemma4` 47 s frente a 43 s del modo completo y peor resultado en proyectos (5 de 7 con texto); con `qwen2.5:7b` falló. **No se adoptó y se eliminó del código.**

**De punta a punta** (lectura profunda + documento + PDF + Word + verificación, con `gemma4:e4b`): **33 s** frente a 162 s con `qwen2.5:7b` (A5); formato 100 %, tasa de lectura 100 %.

**Decisión**: la versión ATS usa `gemma4:e4b` (`OLLAMA_ATS_MODEL`), con `keepAlive` de 2 min para no mantener dos modelos de ~9 GB cargados a la vez. El resto de la app sigue con `qwen2.5:7b-instruct`.

**Lecciones y límites**
- **La medición de la primera tanda salió contaminada**: con 16 GB, dejar cargados modelos de 9 GB uno tras otro (Ollama los conserva 60 min) hizo que el equipo usara el disco, y hasta `gemma4` falló en una repetición. Se corrigió descargando cada modelo antes de medir el siguiente; los números de la tabla son de la tanda corregida.
- Los modelos de 14 B no se descartan por calidad sino por tiempo: en este equipo no terminan en 5 min. En una máquina con más memoria podrían servir.
- Un solo CV, una sola máquina. El modelo y el tiempo pueden variar con otro CV (p. ej. un PDF sin texto, que pasa por OCR).

## Lectura de un PDF sin texto: Tesseract vs. modelo de visión (25-nov-2026)

Script: `scripts/ocr-bench.mjs`. Un solo CV (`juan-buitrago-cv.pdf`, 1 página, imagen sin capa de texto), un solo equipo, una corrida por motor.

| Motor | Tiempo | Resultado |
|---|---|---|
| Tesseract (como hoy: página a 2200 px, español + inglés) | 30 s | Texto real y reconocible (nombre, rol, perfil, experiencias con fechas y viñetas). Basura al inicio (decoración de fondo leída como letras) y erratas puntuales («Diseñador Ul» por «UX») |
| `gemma4:e4b` con visión (página completa a 1600 px, `temperature` 0) | 41 s | **Inventó contenido**: marcadores como «[Empresa 1]», «[Cargo 1]», «[Descripción de Figma]», un cargo («UX/UI Designer») que el CV no dice y un texto de perfil distinto del real |

**Límites**: las cifras de «recall/precision» que imprime el script **no son precisión de lectura**: el DOCX usado como referencia es otra versión del CV (la ATS) y no coincide palabra por palabra con el PDF; no se citan. `qwen3.5:9b` no se corrió. Solo se probó la página entera en una imagen; falta probar franjas más pequeñas.

**Conclusión provisoria**: un modelo de visión leyendo la página completa **no es seguro** para este producto (regla «nunca inventar datos del CV»). Si se usa, solo como apoyo para líneas dudosas y con cada dato verificado contra el texto de Tesseract.

### Afinación de Tesseract (25-nov-2026, `scripts/ocr-tune.mjs`)

Mismo CV (1 página sin texto), mismo flujo de la app (página → franjas → OCR → limpieza), una corrida por variante. «Confianza» = media de la confianza que reporta Tesseract en palabras con letras; «dudosas» = palabras con confianza < 60; «hechos» = cuántos de 12 datos conocidos del CV aparecen tras la limpieza.

| Variante | Tiempo | Confianza | Dudosas | Hechos |
|---|---|---|---|---|
| **actual** (2200 px, PSM 3, franjas de 800) | 25,1 s | 93,8 | 23 | 11/12 |
| 1600 px | 16,6 s | 92,6 | 39 | 11/12 |
| 3000 px | 26,8 s | 94,1 | 21 | 11/12 |
| PSM 6 (bloque único) | 27,7 s | 89,3 | 120 | 11/12 |
| PSM 4 (una columna) | 21,4 s | 93,5 | 30 | 11/12 |
| PSM 11 (texto disperso) | 20,5 s | 94,1 | 23 | 11/12 |
| gris con contraste | 23,4 s | 93,8 | 24 | 11/12 |
| blanco y negro (Otsu) | 22,7 s | 93,5 | 24 | 11/12 |
| franjas de 500 | 21,1 s | 93,6 | 30 | 11/12 |
| franjas de 1200 | 21,2 s | 94,0 | 20 | 11/12 |

**Lectura**: ninguna variante mejora de forma apreciable a la actual (diferencias ≤ 0,3 puntos de confianza, dentro del ruido de una sola corrida); PSM 6 y 1600 px empeoran. La configuración actual ya está cerca del techo de Tesseract para este CV. Los tiempos varían ~±5 s entre corridas (sin repetir).

**Error sistemático hallado**: «UI» sale como «Ul» («Senior Ul Designer», «Ul kit»). Se corrige en `ocr-clean.ts` solo ese token exacto (con prueba). El dato «diseñador ux» sigue sin aparecer porque el CV impreso pudo decir «Diseñador UI» (no se puede saber sin una transcripción real).

**Límites**: sin transcripción exacta de referencia; un solo CV. En CV de dos columnas las viñetas de una y otra columna se mezclan al unir las franjas (orden de lectura), y eso Tesseract + franjas no lo resuelve.

### Banco de lectura sobre la carpeta de CV de prueba (25-nov-2026, `scripts/cv-bench.mjs`)

49 archivos, una corrida por CV (2 lectores de Tesseract en paralelo). El informe completo se guarda en `data/bench-cv/informe.md` (local, fuera del repositorio: tiene datos personales). 22 PDF con capa de texto (15 versiones de un mismo diseñador de producto, 2 páginas, una en inglés; 7 ejemplos de otros oficios, 1 página) y 3 casos difíciles.

**1. OCR contra la capa de texto real** (PDF dibujado como imagen y leído con el flujo de la app):

| Medida | Resultado |
|---|---|
| Palabras de la referencia recuperadas (recall) | **96,8 %** de media (mín. 94,7 %, máx. 100 %) |
| Palabras devueltas que sí están en la referencia (precisión) | **99,5 %** de media |
| Confianza media de Tesseract | 94,4 |
| Tiempo | ~10 s por CV de 1–2 páginas (de 6 a 12 s) |

**Errores repetidos** (lo que el OCR no devuelve bien):
- **Enlaces y dominios** (nombres de redes y portafolios, «com», «net»): son lo que más falta (~45 % de las palabras perdidas). Con capa de texto no importa, pero en un CV escaneado se perdería el contacto en línea.
- **«AI» leído como «Al»** (31 veces en 7 CV): no se corrige por regla porque «al» es una palabra válida en español.
- **Tildes perdidas en nombres y títulos en mayúsculas** («ANDRÉS GÓMEZ» → «ANDRES GOMEZ», «FORMACIÓN ACADÉMICA» → «formacion academica»): afecta al nombre de la persona.
- **«FigJam» → «FigLam»** (j leída como l), y letras sueltas en siglas.

**2. Word ↔ PDF de la misma versión**: 21 de 21 pares con el 100 % de coincidencia de palabras en ambos sentidos: los PDF de esta carpeta se generaron a partir del Word y no pierden ni reordenan contenido.

**3. Casos difíciles sin referencia**:

| Archivo | Tiempo | Franjas | Líneas | Confianza |
|---|---|---|---|---|
| captura alta 1 (JPG, 1440×7999) | 45 s | 11 | 136 | 91,0 |
| captura alta 2 (PNG, 1440×6989) | 40 s | 10 | 195 | 92,6 |
| PDF de diseño sin texto (1 página) | 28 s | 16 | 239 | 89,3 |

**Límites**: los CV son de una columna, con capa de texto y plantilla casi igual (15 de 22 son de la misma persona); los 7 ejemplos parecen sintéticos. No hay dos columnas, fotos, escaneados multipágina ni otros idiomas salvo un CV en inglés. Las cifras valen para este tipo de documento; no se pueden extender a «la mayoría de CV».

### Banco de extracción con el pipeline real (25-nov-2026, `scripts/parse-bench.mjs`)

Sube cada CV al servidor local (`/api/upload` y `/api/cv/parse`), de a uno, y mide trazabilidad de lo extraído y coherencia entre el Word y el PDF de la misma versión. 46 de 47 archivos leídos (`CV type 2.pdf` pesa 11,7 MB y el límite de subida es 10 MB: no se probó). Una corrida por archivo; algunos salieron de la caché de la app (lectura de 0 s), así que los tiempos de esos no cuentan. Informe local en `data/bench-cv/informe-extraccion.md`.

| Medida | Resultado |
|---|---|
| Datos extraídos | 3789 |
| No rastreables al texto fuente | **8 (0,2 %)**: 5 son el marcador «(empresa no detectada)» que pone la propia app; 2 son «Monchis idad» y «Gopass idad» (error, ver abajo); 1 más del mismo marcador |
| Nombre, correo y teléfono encontrados | 46 de 46 |
| Coincidencia de datos Word ↔ PDF (Jaccard) | 74 %–94 % por versión (media ~80 %) |

**Defectos hallados (y corregidos, con pruebas):**
1. **Estudios con viñetas en el PDF se pegaban al primero.** El Word de las 14 versiones da 4 estudios; el PDF daba 1 (los otros 3, certificaciones con «• Título | Entidad, 2022», quedaban como «detalles» del primero). Ahora `splitEducation` abre un estudio propio cuando la viñeta tiene la forma «título | entidad» más un año.
2. **«Actualidad» dejaba «idad» pegado a la empresa** («Monchis idad»): en `dates.ts` la alternativa «actual» ganaba a «actualidad». Ahora va primero la palabra más larga, y la fecha final queda «Actualidad» completa.

**Pendiente / no verificado de punta a punta**: las dos correcciones se verificaron con pruebas unitarias; no se repitió el banco porque la caché de la app (clave = hash del archivo + versión de modelo/prompts) no se invalida con cambios del parser. Los logros por experiencia también difieren entre Word y PDF (p. ej. 14 frente a 11 en las versiones de 2 páginas) y no se investigó la causa. Límites: un solo CV por archivo, plantillas casi iguales, 7 ejemplos sintéticos.

**Seguimiento (25-nov-2026): logros y proyectos entre Word y PDF.** Causa de la diferencia de logros: con viñetas en el CV, la frase que va justo bajo la cabecera del puesto («Users team, Profitability and Accounts project.») se quedaba en la cabecera y se perdía; con el Word (sin viñetas) sí contaba como logro. Y los proyectos escritos como viñetas sin cabecera («• Proyecto (2025): descripción») no producían ningún proyecto. Corregido en `lib/cv/blocks.ts` (`splitExperienceBlocks`, `bulletItems`) y `lib/cv/pipeline.ts` (`parseProjects`), con pruebas. Verificado con el pipeline real (sin caché, vía `runCvPipeline` sobre el texto) en 3 versiones:

| Versión | Word: exp / logros / estudios / proyectos | PDF: exp / logros / estudios / proyectos |
|---|---|---|
| Nubank Product Designer | 6 / 15 / 4 / 1 | 6 / 15 / 4 / 3 |
| BICE Vida Beliv | 6 / 14 / 4 / 1 | 6 / 14 / 4 / 3 |
| Contra Labs (EN) | 6 / 9 / 4 / 1 | 6 / 9 / 4 / 3 |

Antes (PDF): logros 12, 11 y 8; estudios 1; proyectos 0. **Queda un defecto al revés**: en el Word, los proyectos escritos como párrafos sin viñetas («Nombre (2025): descripción», una línea por proyecto) se funden en un solo proyecto (1 en vez de 3). Sin corregir.

**Segundo seguimiento (25-nov-2026): Word ↔ PDF iguales en las 21 versiones.** Verificado con `runCvPipeline` sobre el texto de cada archivo (sin caché; sin pasar por la subida de la app): mismos puestos, logros, estudios y proyectos entre el Word y el PDF de cada versión (antes coincidían en 6 de 21) y 0 empresas «(empresa no detectada)» (antes 4 entradas). Se corrigió, con pruebas:
- **Mes pegado a una letra** (`dates.ts`): «Nexora Pagos 2021» leía «agos 2021» como fecha y dejaba la empresa en «Nexora P». El mes ya no puede ir pegado a una letra anterior (el día pegado al mes del OCR, «11ago», se sigue leyendo).
- **Viñeta partida que abría puestos falsos** (`blocks.ts`): las continuaciones que empiezan por «%», una cifra o una mayúscula tras una línea larga sin cierre («… alinear de / KPIs/OKRs con stakeholders») se unen a su viñeta; antes aparecían como puestos sin empresa.
- **Proyectos como párrafos en el Word** (`paragraphProjectItems`): «Nombre (año): …» una línea por proyecto, incluido «(2022 – Actualidad)» y el caso de un solo proyecto; y en el PDF, cada viñeta es un proyecto aunque una línea partida empiece en mayúscula.

**Límites**: solo plantillas casi iguales (un diseñador, 7 ejemplos sintéticos); no se repitió la subida completa a la app ni los CV escaneados. La regla de la viñeta partida («≥ 80 caracteres sin punto final») es una heurística y puede unir de más en CV con viñetas largas sin puntuación seguidas de un título sin fecha en la misma línea; el caso «título + rango en la línea siguiente» está protegido.

## Rendimiento de las vistas y la base (26-nov-2026)
Medido desde el Mac de Juan (Colombia) contra Supabase (`sa-east-1`, São Paulo) por el «Transaction pooler». Medianas de 5–9 repeticiones; `scripts` temporales, no se conservan.
- **Un viaje a la base** (`select 1`): mediana **207 ms** (mín 133, máx 350). Perfil por id: 265 ms; dispositivo por id: 173 ms; conteo de ofertas activas: 207 ms. **Lo que manda el tiempo de cada vista es cuántos viajes SEGUIDOS hace**, no lo que tarda cada consulta.
- **Dentro de la base**: `explain analyze` de «100 tarjetas más recientes» = **10,8 ms** (recorrido secuencial de 4.822 filas + orden top-N). Las consultas son baratas; el tiempo es red.
- **Peso de las tarjetas**: 100 tarjetas con el JSON de la oferta: **313 ms** (mediana); sin él: 168 ms; 1 fila: 177 ms. Hay picos aislados de ~2,5 s (red/pooler), ya conocidos (ver `reference-supabase-pooler-pipeline`). La oferta pesa de media 1,2 KB; 4.822 activas = 5,6 MB de JSON.
- **Autenticación**: el proyecto firma con ES256 (`/.well-known/jwks.json` trae 1 clave EC): `getClaims()` se verifica **sin red**. Lo que costaba era la consulta del dispositivo y luego la del perfil, una detrás de otra (≈ 2 viajes ≈ 0,35 s) en CADA página.
- **Consultas de alertas con palabras clave** (títulos de hasta 5.000 ofertas + tarjetas de las que coinciden): 0,9–1,9 s en total (2 viajes + trabajo en el servidor).
- **`/api/search`** (servidor de desarrollo, CO, 3 repeticiones): sin texto **0,41–0,49 s** → **0,008 s** con memoria de 2 min; con texto «diseñador» **0,80–0,91 s** → **0,006–0,008 s** (incluye el vector de Ollama, ahora también en memoria 30 min). La primera petición tras arrancar paga la compilación del modo desarrollo (1,3–1,6 s).

### Producción en São Paulo (26-nov-2026)
Medido desde el Mac de Juan contra `https://sooosh.vercel.app` (funciones en `gru1`) con `curl`, 3 repeticiones.
- **Viaje a la base desde la función** (`/api/db/health`, campo `ms`): **4–5 ms**, frente a **133–350 ms (mediana 207)** desde el Mac. Cada consulta seguida de una vista cuesta ~150–200 ms menos que en modo desarrollo.
- **Lo que no baja**: el recorrido navegador → borde (EE. UU., `iad1`) → función (São Paulo). Una ruta trivial (`/api/db/health`) tarda de media **0,43–0,49 s** en total con conexión nueva: ~0,19 s de conexión y TLS (3 viajes de red) y ~0,24 s hasta el primer byte (borde → São Paulo). Con la conexión ya abierta en el navegador se ahorran los 0,19 s.
- **Búsqueda sin texto** (CO, sin memoria): 0,57–2,0 s con conexión nueva (la primera tras un rato paga el arranque en frío de la función); **búsqueda distinta (MX remoto, tecnología)**: 0,67–0,68 s. Es decir: una vista de UNA consulta no gana frente a `localhost`, porque pierde en el recorrido por el borde lo que gana en la base; **ganan las vistas con varias consultas seguidas** (puerta de acceso, alertas, «Mis ofertas»), que pasan de N×~170 ms a casi 0.

### Páginas con sesión: producción (São Paulo) frente a `localhost` (26-nov-2026)
Medido desde el Mac de Juan con `curl`, reutilizando la conexión (como un navegador), con una sesión real de un usuario de prueba temporal (ya borrado; creada con la API de administración de Supabase y la cookie de dispositivo firmada con el secreto de cada servidor). Mediana de 4 repeticiones tras una de calentamiento (en `localhost` la primera compila la ruta). «Total» = hasta el último byte.

| Vista | Producción | `localhost` (dev) |
|---|---|---|
| Inicio `/` | 399 ms | 411 ms |
| Buscador `/ofertas` | 341 ms | 415 ms |
| Detalle de oferta | 442 ms | 736 ms |
| «Mis ofertas» | 518 ms | 680 ms |
| Notificaciones | 421 ms | 757 ms |
| **Resultados de una alerta** | **682 ms** | **1.641 ms** |
| Ajustes | 521 ms | 803 ms |

Todas respondieron 200 con la sesión (ninguna redirigió al login). Lo que las separa: las vistas con 2 o más consultas seguidas ganan entre 150 y 960 ms; las de casi ninguna consulta (inicio) empatan, porque producción paga el recorrido por el borde de EE. UU. Un arranque en frío de la función tras un rato inactiva suma ~1–1,5 s a la primera petición.
