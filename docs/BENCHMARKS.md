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
