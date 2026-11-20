# Estado del proyecto

Bitácora por fase (la más reciente arriba). Desde el 16-nov-2026 Juan pidió: avanzar A–E en orden sin detenerse entre fases, documentar cada una aquí, y **hacer él la revisión visual y de accesibilidad directamente en la app** (yo verifico con lint, tsc, build y tests).

## Fase K — paso K7: vista previa y descarga en varios formatos (18-nov-2026)

**Hecho**
- Formatos: **PDF** (plantilla existente), **Word .docx** (`docx`, librería abierta; una columna, estilos estándar de título y lista, sin tablas ni imágenes), **texto plano** (variante ATS de máxima compatibilidad) y **Markdown**. TXT, Markdown y Word salen del mismo modelo (`lib/export/model.ts`), así dicen exactamente lo mismo, y los cuatro respetan el orden de secciones que la persona aceptó (`CV.sectionOrder`). `POST /api/export` acepta `format`; el nombre es `CV-<nombre>-<empresa>.<ext>`.
- Paso Exportar rediseñado en v2 (sin Card ni Alert): resumen de lo aplicado («Tu CV con N cambios aplicados y M rechazados. Encaje con la oferta: A → B»), selector de formato con una línea de ayuda, **vista previa del formato elegido** (la hoja para PDF/Word; el texto para TXT/Markdown), idioma de los títulos y un solo botón primario «Descargar <formato>». El shell usa `rebuildCv` (K6): avisa si algún cambio se dejó fuera por incluir datos que no están en el CV y señala los textos escritos por la persona.
**Verificado**: lint 0 errores, tsc y build sin errores, 336 tests en verde (nuevos: `tests/export-formats.test.ts`, 8 tests: orden de secciones, TXT y Markdown con todo el contenido, inglés, **el .docx se vuelve a leer como lo haría un ATS (mammoth) y conserva todo el texto en el orden elegido, sin tablas, con viñetas reales**, ningún formato añade palabras que el CV no tenga, nombres de archivo y la ruta entrega cada tipo con su cabecera). Los PDF de 1–2 páginas ya estaban cubiertos por los tests de la Fase 6.
**Límites**: el PDF y la vista previa HTML siguen la plantilla de siempre (no se copia el diseño del archivo original, como pediste); el Word usa fuente Arial y márgenes fijos, sin personalización; no revisé la pantalla en el navegador (la revisión visual es tuya); no probé abrir el .docx en Microsoft Word, solo con el lector de mammoth.
**Para revisar por Juan** (claro y oscuro; escritorio y 375 px)
1. Llega al último paso (o reabre una adaptación desde el historial). Mira el marco: sin tarjeta, texto de resumen arriba con el encaje «A → B».
2. Cambia entre PDF · Word · Texto plano · Markdown: la vista previa cambia (hoja con títulos y viñetas / texto) y el botón dice «Descargar <formato>»; el nombre de archivo cambia de extensión.
3. Descarga cada formato y ábrelo: el Word en Word o Google Docs (¿se ve ordenado y editable?), el TXT y el MD en un editor. Confirma que el orden de secciones es el que aceptaste.
4. A 375 px: pestañas de formato legibles sin scroll horizontal, vista previa a ancho completo.
5. Dime si el marco tenue de la vista previa te parece bien o prefieres otro tratamiento (ver nota en DESIGN-PATTERNS v2).

---

## Fase K — paso K6: reconstrucción del CV final y ciclo de calidad (18-nov-2026)

**Hecho**
- `rebuildCv` (`lib/rebuild/build.ts`, `POST /api/rebuild`): CV final = original + solo lo aceptado. Tres comprobaciones: (1) cada texto escrito por el modelo se verifica contra la fuente; si inventa algo se **bloquea y no llega al CV**, con aviso; (2) integridad: empresas, puestos, fechas, contacto, educación, idiomas y datos de proyectos no cambian; (3) verificación del CV completo (cifras, fechas, nombres y términos de la oferta que el CV no dice). Lo que la persona escribe (ediciones y respuestas a brechas) es suyo: se permite y queda marcado como «escrito por ti». El informe trae resultado por cambio (aceptado, editado, rechazado, pendiente, bloqueado), ficha antes/después y mejora por dimensión.
- `improveWeak` (`lib/rebuild/improve.ts`, `POST /api/improve`, `regenerateOne` en `lib/ai/rewrite-cv.ts`): antes de que la persona revise, vuelve a puntuar cada propuesta de texto y regenera SOLO las que no mejoran la ficha (máx. 2 rondas, con el mismo verificador anti-invención). Si una propuesta empeora la ficha se descarta; si es neutra se conserva con prioridad baja. Nunca toca lo que la persona ya aceptó.
**Interpretación que tomé** (dime si no era lo que querías): «regenerar solo lo débil» lo apliqué a las *propuestas*, antes de la revisión, y no al CV ya aprobado; regenerar algo que la persona aceptó cambiaría lo que ella aprobó.
**Verificado**: lint 0 errores, tsc y build sin errores, 328 tests en verde (nuevos: `tests/rebuild.test.ts`, 12 tests: sin decisiones el CV queda idéntico, aceptar lo estructural no inventa nada, un texto con datos inventados se bloquea y no llega al CV, lo escrito por la persona se permite y se marca, brechas sin respuesta no añaden nada, integridad, informe, y el ciclo de calidad: regenera solo lo débil, descarta candidatas con datos inventados, máx. 2 rondas, tolera fallos del modelo). Medición real en `docs/BENCHMARKS.md` (sección K6): de 7 regeneraciones con el modelo local, 1 mejoró la ficha (+1 punto) y el ciclo **descartó una reescritura que la empeoraba en 5 puntos**.
**Límites**: la regeneración con un modelo de 7B rara vez mejora y cuesta ~30 s por CV; la medición es una sola ejecución con 2 CV de referencia, sin CV reales de Juan; el CV completo se verifica por palabras (cifras, nombres, términos de la oferta), no por significado; la interfaz que muestra el informe llega en K7/K8.
**Para revisar por Juan**: sin interfaz. Decide: ¿el ciclo de regeneración vale ~30 s extra por análisis con este modelo? Si prefieres, lo dejo como paso opcional («mejorar propuestas») en vez de automático.

---

## Fase K — paso K5: cambios atómicos para aceptar o rechazar (18-nov-2026)

**Hecho**
- `lib/changes/propose.ts`: 9 tipos de cambio. Los de siempre (resumen y viñetas reescritos con el modelo, quitar relleno, añadir habilidad) quedan etiquetados con su tipo y criterio. Nuevos, deterministas y sin modelo: **reordenar habilidades** (lo que pide la oferta primero), **reordenar viñetas** de los 3 puestos más recientes, **reordenar secciones** (educación primero con menos de 2 años de experiencia; habilidades antes de la experiencia si la oferta es muy técnica), **titular** (sin titular, tu último puesto tal cual; con titular, se completa solo con habilidades de tu propia lista) y **brechas** (lo obligatorio que el CV no dice).
- Cada cambio trae criterio de la rúbrica, motivo, evidencia literal, riesgo y **efecto estimado**: se aplica solo ese cambio y se recalcula la ficha con el mismo motor (`impactOf`). Las brechas muestran el efecto como hipotético.
- **Las brechas no se rellenan solas**: son una pregunta («¿tienes experiencia real con X?…»). Aceptar sin escribir nada no cambia el CV; si la persona escribe su respuesta, se añade a habilidades.
- `applyDecisions` entiende operaciones estructurales y reordena por índice ORIGINAL (no se pisa con editar/quitar/añadir en la misma lista). `CV.sectionOrder` (nuevo) lo respeta la plantilla del PDF.
- Memoria por tipo (`lib/changes/bias.ts`): 3 rechazos de un tipo sin ninguna aceptación → prioridad baja (se muestra al final, nunca se oculta). Visible y simple, no es entrenamiento del modelo.
- Nuevo criterio de rúbrica `tec-ubicacion` (¿lo más importante está en el titular, resumen, primeras viñetas o primeros 3 elementos de cada grupo de habilidades?), que es lo que hace medible el efecto de reordenar.
- `POST /api/changes`: devuelve los cambios con efecto y la ficha actual; determinista y rápido (sin modelo).
**Verificado**: lint 0 errores, tsc y build sin errores (aparece `/api/changes`), 316 tests en verde (nuevos: `tests/changes.test.ts`, 11 tests: reordenar sin añadir ni quitar nada, convivencia con editar/quitar, secciones y orden en el PDF, titular solo con elementos del CV, brechas sin relleno automático, efecto recalculado y determinismo, memoria por tipo).
**Límites**: aún no se conecta la reescritura con modelo a `/api/changes` desde la interfaz (K8); el efecto de reordenar secciones no se refleja en la ficha (mejora la lectura, no un criterio medido); la respuesta a una brecha se añade como habilidad (no genera una viñeta nueva); reordenar viñetas solo mira los 3 puestos más recientes.
**Para revisar por Juan**: sin interfaz. Dime si algún tipo de cambio te parece mal planteado (por ejemplo, ¿quieres que el titular se complete así: «Analista de Datos | SQL · Python · Power BI»?).

---

## Fase K — paso K4: motor de fit multicapa y juez local (18-nov-2026)

**Hecho**
- `lib/analysis/fit.ts` (`computeFit`): produce la FICHA de las 9 dimensiones con hallazgos por criterio, citas literales del CV o mediciones del documento, y `overall` solo como resumen. Capas: cobertura de la oferta (alias de taxonomía, léxico y capa semántica opcional del matching existente; herramientas, certificaciones e idiomas nunca por parecido), calidad de la evidencia (en contexto o solo en lista), seniority/años/recencia, estructura y ATS. Mismo motor antes y después (`fitDelta`). Una dimensión que la oferta no pide queda `applicable: false` y no cuenta.
- `lib/analysis/judge.ts`: juez local de una sola llamada para 3 criterios cualitativos. El modelo señala el NÚMERO del fragmento (la cita sale del CV tal cual); sin cita no hay veredicto favorable; límite de 90 s; si falla, se calcula con reglas y se avisa (`fitWithJudge`).
- Ajustes: la rúbrica admite `basis: "medicion"` y `applicable`; el perfil de la oferta ya no trata la línea de educación como un término técnico; alias de «comuniqué/comunicar» para comunicación.
**Verificado**: lint 0 errores, tsc y build sin errores, 305 tests en verde (nuevos: `tests/fit.test.ts`, 16 tests del conjunto de referencia y del juez); `docs/BENCHMARKS.md` (sección K4) tiene las mediciones reales del juez (9/9 llamadas correctas con el diseño adoptado, veredictos estables, 8–36 s por llamada) y lo que NO funcionó (copiar citas: 9/9 fallos de validación, luego 5/9 tiempos agotados).
**Límites**: el juez de 7B es indulgente con los logros (ver BENCHMARKS); el conjunto de referencia es 1 oferta × 3 CV, sin CV reales de Juan; la capa semántica aún no está cableada a la ruta `/api/match` (llega en K8); el criterio de lectura por ATS (`est-lectura`) se evalúa sobre el archivo exportado en K7.
**Para revisar por Juan**: sin interfaz. Si me das 1–2 CV reales (puedes borrar datos personales) y 1–2 ofertas que te interesen, los uso como conjunto de referencia para medir si la ficha te parece justa.

---

## Fase K — paso K3: perfil del CV por secciones (18-nov-2026)

**Hecho**: `lib/analysis/cv-profile.ts` (`buildCvProfile(cv, now?)`). Sin IA y determinista, calcula lo que las reglas de la rúbrica necesitan: datos de contacto faltantes; resumen (nº de frases y palabras, clichés con cita literal, años que declara); cada puesto con duración en meses, si es actual y hace cuántos años terminó; huecos de más de 6 meses entre puestos (la evidencia es la fecha literal del puesto que sigue); cronología (inversa, directa, mixta); años totales sin contar solapes; viñetas con cifras reales (un año como «2021» no cuenta como resultado), verbo de acción, si empiezan como tarea («Responsable de…») y longitud; habilidades que aparecen dentro de un logro frente a las que solo están en la lista; nivel educativo más alto; idiomas; secciones presentes; extensión estimada (palabras / 500 por página).
**Detalle que corregí**: una fecha de fin con solo el año («2018») se toma como diciembre; con enero se habrían inventado 11 meses de hueco. (`lib/cv/dates.ts#totalYears` conserva su criterio anterior y podría subestimar años cuando las fechas son solo años; no lo toqué porque lo usa el diagnóstico.)
**Verificado**: lint 0 errores, tsc y build sin errores, 289 tests en verde (nuevos: `tests/cv-profile.test.ts`, 8 tests: esquema, determinismo, años y duración, cronología y huecos con evidencia literal, viñetas y cifras, clichés literales, habilidades en contexto, contacto/educación/secciones, CV vacío).
**Límites**: los verbos de acción y los clichés son heurísticas (lista + terminaciones es/en); ante la duda no penalizan. Aún no está conectado a la ficha ni a la interfaz (K4).
**Para revisar por Juan**: nada visual. Si quieres, dime 2–3 frases típicas de tu CV (viñetas que empiecen de formas poco comunes) y compruebo que se clasifiquen bien.

---

## Fase K — paso K2: oferta enriquecida (18-nov-2026)

**Hecho**: `lib/analysis/offer-profile.ts` (`buildOfferProfile(offer, rawText?)`) y `lib/taxonomy/skills.ts`. A partir de la oferta ya estructurada produce, sin IA y de forma determinista: términos con necesidad (obligatorio / deseable / contexto), categoría, peso (necesidad × énfasis «indispensable/se valora» × veces que la oferta lo nombra), años exigidos por habilidad, frase exacta de la oferta (ATS), alias es/en; más rol, seniority, años, educación (nivel, carreras, si es obligatoria), certificaciones y dominios. Lo que la taxonomía no conoce se conserva con su texto. Nombres ambiguos (Swift, Notion, Slack…) solo cuentan con mayúscula inicial. Aún NO está conectado al motor de matching ni a la interfaz (eso es K4).
**Verificado**: lint 0 errores, tsc y build sin errores, 281 tests en verde (nuevos: `tests/offer-profile.test.ts`, 12 tests: esquema, determinismo, necesidad, categorías, pesos, frase y años, alias es/en, ambiguos, términos desconocidos, educación/idiomas/certificaciones/dominio, «nunca añade habilidades que la oferta no nombra», integridad de la taxonomía sin alias repetidos).
**Límites conocidos (honestos)**: la taxonomía es una semilla de ~190 alias; habilidades fuera de ella quedan como texto libre y se compararán por palabras y embeddings. Aún no se ha medido la calidad sobre ofertas reales (eso llega con el banco de K4).
**Para revisar por Juan**: abre `lib/taxonomy/skills.ts` y dime qué herramientas, certificaciones o industrias de tu mercado faltan (por ejemplo del sector en que buscas trabajo); las añado. Sin interfaz en este paso.

---

## Fase K — paso K1: rúbrica y criterios (18-nov-2026)

**Hecho**: `docs/RUBRICA.md` y `lib/analysis/rubric.ts` (9 dimensiones con pesos que suman 100, criterios con tipo de comprobación regla/juez/mixto, esquema de ficha con evidencia textual obligatoria, `unverifiedEvidence()` anti-invención, `overallScore`/`levelOf`). Plan de la Fase K (K1–K8) en `docs/PLAN.md`, incluido el ajuste: vista previa del CV final y descarga en PDF, Word, TXT y Markdown; se descarta replicar el diseño original.
**Verificado**: lint 0 errores, tsc y build sin errores, 269 tests en verde (nuevo `tests/rubric.test.ts`, 7 tests).
**Para revisar por Juan**: lee `docs/RUBRICA.md` (9 dimensiones y sus pesos) y confirma o corrige: ¿falta alguna dimensión o criterio que un reclutador mire? ¿Los pesos te parecen razonables? Sin interfaz en este paso.

---

## Fase UI-2 — Rediseño v2, pantalla 1: Entrada (17-nov-2026) — pendiente de tu visto bueno

**Hecho**
- Reglas nuevas en CLAUDE.md y PLAN.md (auditoría visual de Juan; sin capturas mías; excepciones `AmbientBackground` y `GlassPanel`; tipografía y botones). `docs/DESIGN-PATTERNS.md` tiene la sección «v2» (imagen leída una sola vez).
- `AmbientBackground` (solo variables del tema con `color-mix`/color relativo; claro cálido+frío, oscuro desaturado y neutro; se intensifica con opacity al arrastrar), `GlassPanel` (creado, aún sin usos), una sola familia Geist (Newsreader eliminada; `--font-heading` → Geist; `StepHeader` ahora `text-lg font-medium`), botones `h-9` de radio completo con área táctil de 44 px por pseudo-elemento en punteros táctiles, `MatrixLoader size="sm"`.
- Entrada rediseñada: `components/wizard/entry-screen.tsx` + `useCvDropzone` (`components/dropzone.tsx`). Sin Card, sin borde punteado; toda la página es zona de soltar; «1 de 5»; «Suelta tu CV» + «o elige un archivo» + «Tomar foto»; leyendo = matriz pequeña + texto de estado con «respiración» por palabra. Cubre las fases de subida, lectura y error; al terminar la lectura el shell pasa al layout anterior (aún no rediseñado).

**Verificado (resultados reales)**: `pnpm lint` 0 errores (2 avisos previos en `scripts/shots-loader.mjs`), `tsc` sin errores, `pnpm build` OK, `pnpm test` 24 archivos / 261 tests en verde (nuevo `tests/ui-v2-entry.test.ts`: sin font-serif/Card/border-dashed/sombras, solo xs–lg, sin pesos ≥600, sin valores arbitrarios, sin colores literales en el fondo). DOM en :3000 (sin capturas): fuente calculada del body = Geist; 0 `data-slot="card"`; 0 bordes punteados; tamaños en la Entrada 12/14/18 px (+16 px heredado del contenedor); botones de 36 px de alto.

**Notas / decisiones**
- «Continuar» no aparece en la Entrada: el CV se lee automáticamente al soltarlo, así que no hay estado «con CV» en esta pantalla (el botón vive en el layout siguiente). Tampoco hay botón primario hasta que hay algo que confirmar (solo «Reintentar» en el error).
- El brillo del texto de estado usa la onda de opacidad por palabra (regla de motion: solo opacity/blur/translate) en vez de animar `background-position`.
- El área táctil de 44 px se logra con un pseudo-elemento (`pointer-coarse`), no con padding, para no agrandar los botones.
- Los botones ahora son `h-9`/redondos en TODA la app (cambio en `components/ui/button.tsx`); los pasos 2–5 aún conservan su Card.
- `scripts/a11y.mjs`, `lib.mjs`, `shots.mjs` tienen cambios tuyos sin commit; no los toqué.

**Ajuste 17-nov (a pedido de Juan)**: se quitó «Tomar foto» y «o elige un archivo» (solo arrastrar y soltar en toda la pantalla). El marco v2 (degradado, cabecera mínima, «N de 5 · Paso», pie sin borde ni tarjeta) ahora cubre TODOS los pasos, y «Así leímos tu CV» pasó a v2 (sin cajas ni Alert). Los pasos 2–5 comparten el marco pero su contenido interno aún es el anterior. Ver también: con un PDF escaneado (OCR) el nombre puede salir vacío («Sin nombre»); la app lo pregunta, pero la extracción del nombre en OCR es mejorable.

**Para revisar por Juan** (claro y oscuro; escritorio y 375 px)
1. Abre `/`: degradado cálido/frío (claro) y oscuro neutro sin azul; sin tarjeta ni borde; marca pequeña a la izquierda, tres íconos fantasma a la derecha; «1 de 5», ícono tenue, «Suelta tu CV», enlace «o elige un archivo», «Tomar foto» de texto; columna estrecha con mucho aire.
2. Arrastra un archivo sobre cualquier parte de la página: el degradado se intensifica suavemente (sin recuadro) y el título pasa a «Suéltalo aquí».
3. Suelta un PDF: estado «Leyendo…» con la matriz pequeña a la izquierda y el texto que respira; «Cancelar» discreto.
4. Suelta un archivo no admitido: mensaje de error en rojo bajo el título. Con Ollama apagado: pantalla «No pudimos leer tu CV» con «Reintentar».
5. A 375 px: sin scroll horizontal, los íconos y enlaces se pulsan sin esfuerzo (44 px).
6. Tras la lectura el layout cambia al diseño anterior (esperado hasta que apruebes y rediseñemos la pantalla 2).

---

## Extra (fuera de fases) — MatrixLoader en los loaders de IA (17-nov-2026)

**Hecho**: `components/ai/matrix-loader.tsx`: matriz 4×4 de puntos que pulsan solo con opacidad (inspirada en el «Matrix dot loader» de transitions.dev, reimplementada con `motion`, tokens y constantes de `lib/motion.ts`; sin copiar su CSS). Reemplaza al `Spinner` en `AiStage`; el patrón (ola, onda, barrido, espiral) cambia con el paso real del análisis (`patternForStep`). Decorativa (`aria-hidden`); quieta con movimiento reducido.
**Verificado**: lint, tsc, build y 251 tests en verde (nuevo test: 16 puntos, 4 patrones distintos, movimiento reducido). `pnpm shots:loader` (nuevo, usa :3000): 375/768/1280 en claro y oscuro → matriz anima, 16 puntos, sin scroll horizontal; con movimiento reducido queda quieta. Capturas leídas en `docs/shots/loader/`.
**Pendiente / avisos**
- `pnpm shots` y `pnpm a11y` están **desactualizados desde la Fase C** (el simulado devuelve JSON sin etapas ni diagnóstico y esperan mensajes antiguos como «Leyendo tu CV con el modelo local»). No los rehice; hay que reescribirlos antes de la próxima fase con cambios de interfaz grandes.
- Tu servidor `pnpm dev` sirve un CSS oscuro **azul marino (`#080e1b`)** que no está en el repo: `app/globals.css` y el build dan `#0a0a0a`. Es caché vieja del servidor de desarrollo; reinícialo (`pnpm dev`) para ver el tema neutro.
**Para revisar por Juan**: reinicia `pnpm dev`, sube un CV y mira la matriz en cada etapa (cambia de patrón con cada etapa); prueba también con «Reducir movimiento» activado en el sistema.

---

## Fase F — Rendimiento y banco de pruebas — terminada (17-nov-2026)

**Hecho**
- `keep_alive` 60 min, `num_ctx` único (8192), `think:false` por defecto (reintenta sin el campo si el modelo no lo admite) y precarga del modelo al abrir la app (`/api/warmup`).
- Caché de resultados por huella (SHA-256 del archivo/texto + versión modelo|prompts|esquemas|lógica) en SQLite (`results`). Se apaga en tests con `RESULT_CACHE=off`.
- OCR por página en paralelo con límite (`OCR_CONCURRENCY`, 2) y duración reportada (`timings.ocr`).
- Encabezados de CV tolerantes a erratas de OCR (coincidencia aproximada solo en palabras de 7+ letras).
- Oferta: la estructuración pide al modelo solo los números de línea y deriva herramientas/idiomas/seniority/años sin IA (respaldo al JSON completo).
- `pnpm bench` + `docs/BENCHMARKS.md` (3 CVs × 3 ofertas × 3 modelos, `ollama ps`).

**Verificado (resultados reales)**: lint, tsc y build en verde; 250 tests pasan; cifras en `docs/BENCHMARKS.md`: CV escaneado 54 s → 1,0 s; misma lectura repetida 6,8 s → 0,0 s; oferta estructurada ~22 s → 5,5–6,7 s; limpieza+estructura 10–13 s. Capturas: no aplican (fase sin cambios de interfaz).

**No hecho / límites**: caché KV q8_0 sin evaluar (hay que reiniciar Ollama con `OLLAMA_KV_CACHE_TYPE`; necesito tu OK); ganancia del OCR en paralelo sin medir (fixture de 1 página); meta «primer cambio de reescritura < 15 s» sin medir (Fase G); una sola ejecución por celda del banco; el CV sin secciones sigue en 37 s.

**Propuesta de modelo (NO aplicada, decide Juan)**: mantener `qwen2.5:7b-instruct`. gemma4:e4b es más rápido en ofertas (6–8 s vs 10–13 s) pero hizo timeout (490 s) en el CV sin secciones y ocupa 10 GB; qwen3.5:9b no es más rápido ni más fiable (0 puestos en ese CV). Solo qwen2.5 sacó 1,00 en las 6 pruebas.

**Para revisar por Juan**
1. `pnpm bench` (tarda ~15 min; no uses la app mientras corre) y compara con `docs/BENCHMARKS.md`.
2. Sube dos veces el mismo CV en la app: la segunda lectura debe ser instantánea.
3. Sube `tests/fixtures/scanned.pdf`: debe leerse en ~1 s y mostrar «Leído con OCR».
4. Dime si autorizas probar `OLLAMA_KV_CACHE_TYPE=q8_0` (implica reiniciar tu Ollama) y si quieres cambiar de modelo.
5. Cuando estés conforme: `/siguiente-fase` (Fase G).

---

## Fase actual
**Fase E — terminada.** Fases A–E completas (código, tests y pruebas reales); la revisión visual de A–E la haces tú en la app.

---

## Fase E — Reescritura, revisión por decisión y aprendizaje

### Qué se hizo
- **Cambios por sección: cambiar, quitar y añadir.** *Cambiar*: el modelo reformula resumen y viñetas (conserva el estilo del CV con la frase del diagnóstico). *Quitar*: viñetas demasiado cortas o repetidas (determinista). *Añadir*: herramientas/habilidades que tu experiencia ya demuestra con las mismas palabras de la oferta pero faltan en tu lista de habilidades (determinista, usa el resultado del Análisis).
- **Cada cambio trae original, propuesta, motivo, evidencia y riesgo** (`lib/rewrite/describe.ts`, sin gastar tokens): la evidencia son fragmentos **exactos** del CV (el original + el fragmento que respalda cada término de la oferta incorporado). Sin evidencia no se propone; el **verificador anti-invención** sigue rechazando todo lo que no esté en la fuente de verdad inmutable (Fase C). Riesgo bajo/medio/alto según términos nuevos y crecimiento del texto.
- **Pantalla de revisión nueva** (`components/steps/step-review.tsx`): **una tarjeta por cambio**, con aceptar / rechazar / editar, **atajos de teclado visibles** (`Kbd`: A, R, E, ← →; no actúan mientras escribes), avance automático al siguiente pendiente, "Aprobar los N de bajo riesgo", motivo opcional al rechazar, y edición verificada (no deja guardar datos que no están en tu CV). El pie de "Continuar" pasa a ser la acción primaria solo cuando no quedan pendientes. Lo pendiente no se aplica.
- **Aprendizaje local** (Drizzle + SQLite, `data/learning.db`): cada decisión (tipo, sección, original, propuesta, decisión, texto editado, motivo opcional, y motivo del sistema) se guarda en `/api/learning/decisions` (cambiar de opinión actualiza la fila). **Cada `LEARN_EVERY` = 10 decisiones nuevas** el modelo resume hasta 8 reglas de preferencias (saneadas: sin correos/URLs/duplicados), que junto con **pocos ejemplos aceptados/editados** se inyectan en el prompt de reescritura (las reglas de no inventar siguen mandando).
- **Panel "Lo que he aprendido"** (icono del cerebro en la cabecera): reglas visibles, editables (editar una aprendida la vuelve tuya y el resumen ya no la pisa), desactivables, borrables, con alta manual y **"Reiniciar lo aprendido"**. Aclara en la interfaz y en el README que es **memoria de preferencias, no entrenamiento del modelo**.

### Qué se verificó (resultados reales)
- `pnpm lint` y `pnpm exec tsc --noEmit` sin errores · `pnpm build` OK (aparecen `/api/learning`, `/decisions`, `/rules`) · `pnpm test`: **238/238** (23 nuevos: decisiones y upsert, ejemplos, reglas editables/manuales, reinicio, resumen cada N con modelo simulado y saneado, preferencias en el prompt sin la regla desactivada, motivo/evidencia/riesgo, quitar/añadir sin inventar —Docker no se añade—, `applyDecisions` con los tres tipos y la tarjeta de revisión: una sola tarjeta, Kbd, "bajo riesgo").
- **Prueba real** contra tu servidor: guardar una decisión (editada), crear una regla, leer contadores y reiniciar todo → la base SQLite local responde bien (dejé la memoria en 0, sin datos de prueba).
- Un test detectó que mi umbral de riesgo bajo (+25 % de largo) era demasiado estricto para incorporar un término respaldado; ahora +35 %.
- **No verificado / límites**: no probé el ciclo completo con tu CV real ni el resumen de reglas con el modelo real (solo simulado); la reescritura por modelo no se re-midió en esta fase; el idioma de salida distinto del CV está soportado por el prompt pero la interfaz aún no lo ofrece; las tarjetas y el panel no se revisaron visualmente.

### Para revisar por Juan
1. Recorre el flujo con tu CV y una oferta reales hasta **Revisión** y pulsa "Proponer cambios": verás una tarjeta por cambio. ¿El motivo y la evidencia son claros y son tuyos?
2. Prueba el teclado: **A** acepta, **R** rechaza, **E** edita, **←/→** navegan. Prueba "Aprobar los N de bajo riesgo".
3. Rechaza uno, vuelve a él con **←** y escribe un motivo opcional.
4. Intenta **Editar** escribiendo una tecnología que no tienes: debe negarse a guardar.
5. Toma 10 decisiones y abre el icono del cerebro: deben aparecer reglas aprendidas (tardan unos segundos tras la décima). Edita una, desactívala, bórrala y prueba "Reiniciar lo aprendido".
6. Reescribe otra oferta: ¿notas que respeta tus reglas?

---

## Fase D — Matching y análisis de brecha

### Qué se hizo
- **Términos desde la oferta estructurada, no desde n-gramas** (`lib/match/terms.ts`): cada requisito, deseable, herramienta, habilidad blanda, idioma exigido y función es un término tal cual lo dice la oferta (pesos: obligatorio 3 · herramienta/idioma/deseable 2 · blanda 1,5 · función 1; sin duplicados). Se eliminó el motor viejo (`lib/keywords/extract.ts` y `coverage.ts`), que generaba basura como "shows", "fine" o "around" (hay test de regresión con esas palabras).
- **Evidencia del CV** (`lib/match/units.ts`): cada viñeta, frase del resumen, habilidad, estudio, idioma y proyecto es un fragmento con su sección. Toda evidencia que se muestra es un fragmento real del CV (test).
- **Motor de matching** (`lib/match/engine.ts`) en tres capas: (1) **léxico**: mismas palabras (sin tildes/plurales), equivalencias es/en de la tabla versionada de sinónimos, y términos compuestos por unión de claves ("Strong SQL and advanced Excel" vale si SQL y Excel están); (2) **semántico**: embeddings locales **bge-m3** (multilingüe) *proponen* candidatos con umbrales distintos para frases de logro (0,50) y fragmentos cortos (0,66); (3) un **modelo local juzga** cada candidato con salida mínima (`mismo` / `relacionado` / `ninguno`, con ejemplos en el prompt). Respaldo: sin bge-m3 usa `nomic-embed-text` traduciendo los términos al idioma del CV con el LLM; sin ninguno de los dos, solo léxico y avisa.
- **Estados por término**: *cubierto* (mismas palabras) · *cubierto con otro nombre* (sinónimo o idioma distinto) · *reformulable* (hay evidencia relacionada) · *ausente* (brecha). Cada uno con una explicación corta en español y su evidencia.
- **Cobertura ponderada**: cubierto y otro nombre = 1, reformulable = 0,5, brecha = 0, multiplicado por el peso (lo obligatorio pesa más que lo deseable).
- **Tres grupos de salida**: "Ya encaja", "Se puede reformular con lo que ya dices" y "No está en tu CV" (brechas: **no se agregan ni se inventan**; si de verdad las tiene, el usuario las añade con «Corregir»).
- **Regla anti-invención**: una **herramienta o idioma NUNCA se promueve por parecido semántico** (dos herramientas de BI se parecen, pero una no es la otra): solo cuenta por palabras o sinónimos; lo más cercano se muestra como «lo más cercano en tu CV es X, pero no es lo mismo. No se agregará.». Lo descubrió un test: con embeddings, "Tableau" quedaba cubierto por "Power BI".
- **`POST /api/match`** y **paso "Análisis"** rediseñado: arranca solo al llegar al paso (cero entradas), con el estado de IA ("Comparando tu CV con la oferta"), porcentaje, brechas y reformulables a la vista y "Ya encaja" plegado; sin barras de progreso. El resultado se guarda en el wizard (lo usará la Fase E).
- La guardia anti-invención de la reescritura ahora usa términos derivados de la oferta estructurada (`injectionTerms`).
- Se descargó el modelo **`bge-m3`** (1,16 GB) en tu Ollama con `ollama pull`/API; el README lo documenta (`ollama pull bge-m3`).

### Qué se verificó (resultados reales)
- `pnpm lint` y `pnpm exec tsc --noEmit` sin errores · `pnpm build` OK (aparece `/api/match`) · `pnpm test`: **215/215** (el motor viejo se reemplazó: 36 tests nuevos de términos, evidencia, léxico, semántico con embeddings/juez simulados, tope de consultas al juez, degradación sin embeddings, cobertura ponderada, determinismo y la pantalla).
- **Prueba real** (bge-m3 + qwen2.5:7b por tu servidor): CV típico en español contra una oferta **en inglés** con 8 herramientas, 6 requisitos, 3 deseables, 3 blandas, 3 funciones y 2 idiomas → **13,8 s**, 60 % de cobertura. Resultado: SQL/Excel/Power BI/Tableau/Python cubiertos por palabras; "English B2", "Communication", "Leadership" cubiertos con otro nombre (es↔en); "5+ years of experience in data analysis" respaldado por el resumen; "Prepare weekly reports for management" reformulable con la viñeta de informes; **brechas correctas: Kubernetes, Docker, JS, alemán, PMP, Machine learning, Stakeholder management**.
- Calibración (similitudes reales de bge-m3): los términos cortos se parecen demasiado entre sí ("Kubernetes"↔"Python" 0,60 vs "data visualization"↔un tablero real 0,61), por eso el coseno solo *propone* y decide el juez. Un tope inicial de 8 consultas al juez dejaba frases válidas como brecha; subió a 16.
- **No verificado / límites**: probado con CV y ofertas ficticios, no con los tuyos reales. El juez (7B) es conservador entre idiomas: "Data visualization" quedó como brecha aunque el CV tiene tableros (prefiero ese error a inventar). No se evalúan aún los años de experiencia ni el seniority pedidos por la oferta contra los del CV. La interfaz nueva del paso Análisis no se revisó visualmente.

### Para revisar por Juan
1. Con tu CV ya leído, pega una **oferta real** (idealmente en otro idioma que tu CV) y avanza a "Análisis": arranca solo, tarda unos 10–20 s y muestra el porcentaje.
2. Lee **"No está en tu CV"**: ¿son brechas reales? Si alguna sí la tienes y no aparece, dime cuál (puede ser un sinónimo que falte en la tabla) y la añado.
3. Lee **"Se puede reformular"**: ¿la evidencia que cita es realmente tuya y relacionada?
4. Abre **"Ya encaja"** y comprueba que nada esté marcado como cubierto sin que lo tengas.
5. Si prefieres que lo dudoso se muestre como brecha o como reformulable, es un ajuste de umbrales en `lib/match/engine.ts` (`THRESHOLDS`).

---

## Fase C — Perfil: de formulario a diagnóstico automático

### Qué se hizo
- **Se eliminó el formulario como paso obligatorio y el panel "Texto original".** Al subir el CV el pipeline lo analiza solo y se muestra una **tarjeta de diagnóstico de solo lectura** (`components/cv/diagnosis-card.tsx`): nombre y titular; idioma, seniority y número de puestos; una frase de estilo ("Primera persona, verbos en pasado, con viñetas; 6 de 10 viñetas con cifras."); "Lo más sólido" (2), "Para mejorar" (3) y un plegable con todo lo demás (más fortalezas/mejoras, riesgos ATS, secciones detectadas en orden, base del seniority). La corrección manual es una acción opcional **"Corregir"** (diálogo con el formulario de antes).
- **Diagnóstico** (`lib/cv/diagnosis.ts`, `lib/schemas/diagnosis.ts`), casi todo determinista: idioma; secciones y su orden; estilo (tono, persona gramatical, tiempos verbales, formato de viñetas, uso de métricas, longitud media); seniority percibido (años reales sumando puestos sin contar solapes + cargo); fortalezas; problemas (frases genéricas, viñetas sin cifras, relleno, estructura); riesgos ATS (sin correo/teléfono, puestos sin fechas, encabezados no estándar, CV muy largo, columnas/tablas); confianza por dato clave.
- **Como máximo UNA pregunta dirigida**, solo si la confianza de un dato clave es baja, por prioridad: nombre → ¿tiene experiencia? → idioma. Se responde en la propia tarjeta.
- **Pipeline por etapas** (`lib/cv/pipeline.ts`): todo lo que se puede resolver sin IA se resuelve sin IA — secciones por encabezados (es/en), contacto por regex, fechas, viñetas, **cabeceras de puesto y de estudio** (`lib/cv/heads.ts`: "Cargo — Empresa", "Empresa | Cargo (fechas)", "X at Y"…), habilidades, idiomas, proyectos y métricas. El modelo solo se usa si una cabecera es ambigua, la formación no se identifica o falta el nombre, y para elegir las **fortalezas como números de viñeta** (salida de ~12 tokens: el texto es el del propio CV, no se puede inventar). Cada dato del modelo se verifica contra el texto fuente. Sin encabezados reconocibles, respaldo al método clásico (una llamada).
- **Ollama**: `stream: true`, `keep_alive` (30 min), `num_predict` por llamada y tiempo al primer token; sin cambios de `num_ctx` entre llamadas (cada cambio **recarga el modelo**, medido: +3 s) y llamadas en serie.
- **Progreso real**: `POST /api/cv/parse` responde en **NDJSON** con un evento por etapa; el `ThinkingTicker` avanza con ellas ("Leyendo el archivo" → "Detectando las secciones" → … → "Analizando tu perfil").
- **Tiempos por etapa medidos y registrados**: consola (`[cv] fortalezas 1852 ms`, `[cv/parse] total=…`), `meta.timings` en la respuesta y `data/timings.log` (una línea JSON por lectura; `data/` no se sube a git).
- **Fuente de verdad inmutable** (`lib/cv/source.ts`): el texto y el CV tal como se leyeron están **congelados** (`Object.freeze` profundo, copia independiente) y la guardia anti-invención de la reescritura compara contra ese texto original **+ solo lo que el propio usuario corrigió a mano** (`guardCorpus`), no contra el CV editable. `/api/rewrite` acepta el campo `guard`.

### Qué se verificó (resultados reales)
- `pnpm lint` y `pnpm exec tsc --noEmit` sin errores · `pnpm build` OK · `pnpm test`: **210/210** (36 nuevos: sectorización, contacto, fechas, bloques, cabeceras en 5 formatos, estudios, habilidades/idiomas, idioma, pregunta única, tarjeta de diagnóstico, lector del stream, pipeline completo con modelo simulado —cuántas llamadas hace, qué verifica, respaldo clásico, error de Ollama— y la fuente de verdad).
- **Rendimiento real con Ollama** (`qwen2.5:7b-instruct`, por tu servidor :3000):
  | CV | Antes | Ahora |
  | --- | --- | --- |
  | Típico en español (3 puestos, estudios, proyecto) | **207 s** (1.ª versión del pipeline) / **212 s** (original) | **11,3 s** en frío, **1,8 s** con el modelo caliente (1 llamada) |
  | Inglés | — | 3,1 s |
  | PDF / DOCX / Markdown de ejemplo | — | **0,1 s, 0 llamadas al modelo** |
  | Sin encabezados (método clásico) | ~212 s | 40 s (1 llamada grande) |
  **Objetivo < 60 s: cumplido en todos los casos medidos.**
- **Lo que aprendí midiendo**: mi primera versión del pipeline tardó 207 s igual que el original. Medí Ollama directamente: el modelo genera ~8 tokens/s (cada token cuesta ~0,12 s) y cada cambio de `num_ctx` recarga el modelo. Por eso el diseño final minimiza los **tokens generados**, no el número de llamadas.
- Defectos encontrados y corregidos en el camino: el modelo omitía la empresa (→ ahora la cabecera se interpreta sin IA); el correo generaba un falso enlace "laura.me"; `\b` no funciona con letras acentuadas (los verbos en pasado "Diseñé" no se detectaban); la formación perdía un estudio; los años de experiencia contaban 11 meses en vez de 12.
- **No verificado / límites**: probado con CV ficticios y los de ejemplo del repo, **no con CV reales de personas** (formatos muy creativos, dos columnas, tablas o fotos pueden fallar en la sectorización; ahí cae al método clásico). El método clásico puede devolver textos como "Sin especificar" en campos obligatorios. Los selectores de OCR (CV escaneados) no se midieron en esta fase. La interfaz nueva del paso Perfil **no se revisó visualmente** (lo haces tú).

### Para revisar por Juan
1. `pnpm dev` y abre la app; sube **tu CV real**. Mientras lee debes ver el aura y el mensaje cambiando con cada etapa ("Detectando las secciones"… "Analizando tu perfil"); debería tardar segundos, no minutos.
2. En la tarjeta: ¿están bien tu nombre, titular, idioma, seniority y número de puestos? ¿La frase de estilo describe cómo escribes? ¿"Lo más sólido" son logros tuyos de verdad?
3. Abre "Ver el diagnóstico completo": ¿las secciones y el orden son los de tu CV? ¿Los riesgos ATS y las mejoras tienen sentido?
4. Pulsa **Corregir** y cambia algo (p. ej. una empresa mal leída): al guardar la tarjeta se actualiza.
5. Si alguna lectura sale mal (puestos sin empresa, estudios perdidos, nombre equivocado), dime el formato exacto de esa parte de tu CV y ajusto `lib/cv/heads.ts`.
6. Mira `data/timings.log` para ver los tiempos de cada lectura.

---

## Fase B — Limpieza de oferta por URL o texto

### Qué se hizo
- **Capa 1 · extracción determinista** (`lib/offer/extract.ts`, con `linkedom` + `@mozilla/readability`, gratuitas): JSON-LD `JobPosting` → selectores por sitio (LinkedIn empleo y publicación, Indeed, Greenhouse, Lever, Workable, Computrabajo) → Readability → heurística. Antes de leer el texto se elimina el ruido conocido: comentarios, reacciones, compartir, cookies, publicidad, "ofertas similares", inicio de sesión.
- **Capa 2 · limpieza con el modelo local** (`lib/offer/clean.ts`): un prefiltro de líneas basura (es/en) y después el LLM recibe las líneas **numeradas** y devuelve solo los **números** de las que son contenido propio de la oferta. Así el texto resultante son líneas del original tal cual: **no puede inventar**. Textos largos van en trozos con numeración global; si Ollama falla o el modelo deja casi nada, se conserva el prefiltro y se avisa.
- **Capa 3 · guardia anti-invención** (`lib/offer/guard.ts`, `guardOffer`): cada requisito, deseable, función, herramienta, habilidad blanda e idioma devueltos por el modelo debe existir en el texto fuente (subcadena sin tildes/signos o casi todas sus palabras); lo demás se descarta y se informa. Empresa inventada → se quita; título no literal → se conserva y se avisa; seniority solo si hay palabras que lo respalden ("Semi Senior" ya no cuenta como "senior"); años de experiencia solo si las cifras aparecen en el texto.
- **Esquema de oferta** ampliado (`lib/schemas/offer.ts`): + `seniority`, `yearsExperience {min,max}`, `tools`, `softSkills`, `languagesRequired` (todos opcionales: no rompen el resto del código).
- **`POST /api/offer`**: `{url}` → capas 1+2, devuelve el texto limpio para revisarlo (`method`, `site`, `removed`); `{text}` → capa 2 (si no viene ya limpio) + estructuración + guardia, devuelve `{offer, text, dropped, cleaning}`.
- **Interfaz**: al traer una URL o analizar, el cuadro de texto pasa a mostrar el **texto ya limpio** con un aviso ("Se quitaron N líneas que no eran de la oferta…", "Se descartaron N datos que el modelo propuso y no estaban escritos…"). Si la URL exige sesión, mensaje claro para pegar el texto.

### Qué se verificó (resultados reales)
- `pnpm lint` y `pnpm exec tsc --noEmit` sin errores · `pnpm build` OK · `pnpm test`: **174/174** (31 nuevos: extracción por sitio con 6 fixtures, comentarios que no pasan —incluye "10 años de experiencia en Spark" dicho por otra persona—, limpieza con modelo simulado, fallos del modelo, trozos largos, guardia y esquema).
- **Prueba real con Ollama** (`qwen2.5:7b-instruct`, por tu servidor :3000) sobre un post de LinkedIn pegado como texto con hilo de comentarios: 41 s, **20 líneas quitadas, 0 fugas** (ni comentarios, ni nombres de otros, ni "Spark/Kubernetes"), oferta estructurada correcta, sin descartes de la guardia.
- Defectos encontrados por los tests y corregidos: un punto final impedía reconocer una frase existente; "Semi Senior" se aceptaba como "senior".
- **No verificado / límites**: los selectores de LinkedIn, Indeed, etc. están escritos de memoria sobre la estructura típica de sus páginas y **no se probaron contra páginas reales** (muchos sitios exigen sesión o cargan con JavaScript; en ese caso se pide pegar el texto). Las 3 ofertas de `~/Projects/cv-tailor-material` no existían (carpeta vacía). El modelo no rellenó `seniority`/`yearsExperience` en la prueba (son opcionales); mejorable en la Fase D.

### Para revisar por Juan
1. En el paso "Pega la oferta", pega el texto de **un post de LinkedIn tal como lo copias, con comentarios**, y pulsa "Analizar oferta": el cuadro debe quedar solo con la oferta y avisar cuántas líneas se quitaron.
2. Prueba "Desde URL" con una oferta pública (Indeed, Computrabajo, una página de empresa) y con un enlace de LinkedIn: si exige sesión debe pedirte pegar el texto.
3. **Qué dejar en `~/Projects/cv-tailor-material`** (opcional): archivos `.txt` (o `.md`/`.html`) con el texto de ofertas reales, uno por archivo. Basta con copiar y pegar el texto de la oferta en un bloc de notas y guardarlo ahí. `pnpm test` los usa solo.

---

## Fase A — Referentes, base de UI minimalista y movimiento

### Qué se hizo
- **A1** `docs/DESIGN-PATTERNS.md`: leí las 4 referencias una por una; análisis por referencia, patrones recurrentes vs únicos, 10 principios, traducción a componentes/tokens de shadcn, lista de "no hacer" y reglas de movimiento (con la investigación). Es la fuente de verdad visual.
- **A2 Shell**: se **eliminó el Sidebar** (`components/ui/sidebar.tsx`, `app-sidebar`, `use-mobile`). Ahora hay una *stage* centrada con **una sola tarjeta** (`rounded-3xl`, sombra suave), cabecera mínima (marca, historial y tema), **segmentos de paso** (`StepDots`) y un pie con la acción primaria. Cada paso pierde sus tarjetas anidadas: título serif (`StepHeader`) + contenido directo.
- **Una acción primaria por pantalla**: el botón del pie es primario solo cuando el paso está completo; mientras tanto la acción primaria es la del propio paso (Analizar oferta, Reescribir, Descargar PDF) y el resto es secundario/ghost.
- **Historial**: pasó del Sidebar a un **diálogo** (icono de la cabecera), con filas en vez de tarjetas.
- **Tema** aplicado por el mecanismo oficial (`docs/theme-cv-tailor.json` → `shadcn add`): claro con grises fríos; **oscuro neutro** (negros sin tinte azul, pedido de Juan); acento violeta en `primary`, `accent` y `chart-*`; radio `0.875rem`. Títulos en **serif** (Newsreader) solo en `font-heading`.
- **Progreso solo con IA**: se quitaron todos los `Progress` decorativos (cabecera, cobertura, "revisados", subida de archivo → `Spinner`) y la barra *falsa* de estimación al leer el CV. Se quitaron toasts innecesarios ("Archivo guardado", "CV leído"…).
- **A3 Movimiento** (`motion`; `lib/motion.ts`; `components/ai/`): `AiAura` (luz ambiental lenta; **reemplaza al haz `AiBeam`**, que Juan descartó por llamativo), `ThinkingTicker` (palabra por palabra + onda de opacidad; cambia solo con el paso real), `AiStage` (atenúa/desenfoca apenas el contenido, aura, `Spinner`, "Cancelar"), `StepTransition` y relleno con resorte de `StepDots`. Solo opacity, blur y translate; `prefers-reduced-motion` respetado.
- **AiStage integrado** en los estados reales de IA: leer CV (un mensaje honesto), analizar oferta (idem) y reescritura (el ticker avanza con cada grupo real: "Reescribiendo: Resumen" → "Reescribiendo: <cargo>").
- Se quitó el indicador "N" de `next dev` (`devIndicators: false`).
- `scripts/shots.mjs` y `scripts/a11y.mjs` se adaptaron a la nueva UI y quedan en el repo, pero **ya no forman parte de la definición de "terminado"**.

### Qué se verificó (resultados reales)
- `pnpm lint`: sin errores · `pnpm exec tsc --noEmit`: sin errores · `pnpm build`: OK · `pnpm test`: **143/143** (11 nuevos del sistema de movimiento: ticker, AiStage, y reglas por código — sin `scale`, sin giros/bordes animados, solo opacity/filter/x/y, `useReducedMotion` presente, constantes únicas, aura solo con variables del tema).
- En una corrida anterior de `pnpm shots` (haz de la primera versión) comprobé con Playwright: IA trabajando ⇒ aura/haz visible y desaparece en reposo; con movimiento reducido no se mueve; descargas reales del PDF y del historial correctas; sin scroll horizontal; fuente serif aplicada. Revisé a ojo la stage, la lectura con IA, oferta analizada, análisis, error de Ollama, revisión, exportar, historial y 404 contra las referencias. **Después de cambiar el tema oscuro y el movimiento no repetí las capturas** (a petición tuya).
- Pendiente de revisar por Juan: oscuro neutro y movimiento nuevo.

### Para revisar por Juan
1. `pnpm dev` y abre http://localhost:3000 en **oscuro**: ¿fondo y tarjeta son negro/gris neutro, sin azul? El violeta solo en el botón primario, el segmento activo y el spinner.
2. Sube un CV: mientras lo lee debe verse el **aura** (luz tenue que deriva), el mensaje "Leyendo tu CV con el modelo local" entrando palabra por palabra y "respirando", y el contenido atenuado detrás. ¿Es lo bastante sutil? Si no, dime qué ajustar (en `lib/motion.ts`: `waitBlur`, `waitOpacity`, `drift`, `wave`).
3. Cambia de paso: la pantalla debe subir/desenfocarse suavemente (sin saltos) y el segmento de progreso llenarse con un resorte.
4. En Revisión pulsa "Reescribir": el mensaje cambia con cada puesto real.
5. Prueba el historial (icono de reloj arriba a la derecha) y 375 px de ancho.
6. Con "Reducir movimiento" activado en el sistema, no debe haber desplazamientos ni deriva.

## Fase K9-A — lectura de PDF escaneado (19-nov-2026)

### Qué se hizo
- `lib/extract`: el PDF sin texto ahora se **renderiza completo** (`unpdf` + `@napi-rs/canvas`, dependencia nueva, local y gratuita) en vez de usar solo la imagen incrustada más grande; se parte en franjas (`strips.ts`, cortes en filas sin contraste) y se hace OCR por franja. Si el render falla, cae al método anterior.
- `ocr-clean.ts`: elimina líneas de ruido del OCR (decoraciones/íconos); solo borra, no edita.
- `heuristicIdentity`: prefiere el nombre con formato Título sobre el ruido en mayúsculas y quita restos pegados («Mario Quintero 9» → «Mario Quintero»).

### Qué se verificó
- Con el PDF real de prueba: nombre «Mario Quintero», titular «Ssr. Product designer», ubicación «Bogotá, Colombia», sección de resumen reconocida; 19,1 s (ver `docs/BENCHMARKS.md`).
- `pnpm lint` (0 errores; las 3 advertencias ya existían) · `pnpm exec tsc --noEmit` OK · `pnpm build` OK · `pnpm test` 345/345.

### Pendiente (siguientes pasos del plan)
- B: puestos, empresas y años por línea «empresa + fechas» (hoy sigue mostrando «3 puestos / 2,9 años»). C: segmentación con IA para CVs sin formato. D: pantalla «Perfil» corta.

### Para revisar por Juan
- Sube de nuevo `cv-de-prueba.pdf` (la caché es por huella; si ves el resultado viejo, usa «Cambiar» y vuelve a subirlo): el nombre debe salir sin pedirlo. Los puestos y años seguirán mal hasta el paso B.

## Fase K9 (B, C y D) — lectura estructural, segmentación con IA y pantalla «Perfil» corta (19-nov-2026)

### Qué se hizo
- **B · puestos y años**: `splitExperienceBlocks` (cada línea con rango de fechas abre un puesto; el rango suelto o junto a la ubicación se une al título; frases tras la cabecera = logros si el CV no usa viñetas; `+`/`«` como viñeta del OCR). Fechas con día (`11ago 2025`, `06 nov 2026`). Una línea corta sin palabra de cargo se trata como empresa (cuentas anidadas) y se le pregunta al modelo. «Puesto no indicado» en vez de inventar un cargo.
- **Contacto** buscado en todo el texto (teléfono con etiqueta, correo y enlaces conocidos al final del CV); nombre robusto (Título sobre mayúsculas de ruido; ubicación ≠ titular); OCR: `ñ` leída como `fi` en raíces seguras.
- **C · segmentación con IA** (`lib/cv/segment.ts`): si no hay encabezados, el modelo recibe el CV con líneas numeradas y solo devuelve en qué línea empieza cada sección (diseño medido en K4). Se valida todo y solo se acepta si la experiencia trae puestos con fechas; si no, método clásico.
- **D · pantalla «Perfil» corta** (`components/cv/profile-summary.tsx`, `lib/cv/overview.ts`): nombre, titular, ubicación, contacto, idioma, años por fechas, nº de puestos, perfil (2 frases), empresas, habilidades principales (taxonomía) y secciones del CV. Sin fortalezas, «para mejorar» ni diagnóstico. `DiagnosisCard` se conserva (su `styleSentence` lo usa la revisión).
- Quitada la llamada al modelo para la formación cuando alguna entrada es segura (era 32 s en el CV de Juan). Alias «formacion» fuera de «Docencia» en la taxonomía.

### Qué se verificó
- `pnpm lint` (0 errores; 3 advertencias previas) · `pnpm exec tsc --noEmit` OK · `pnpm build` OK · `pnpm test` **363/363** (nuevos: `cv-b-c-d.test.tsx`, `ocr-clean.test.ts`, `identity-ocr.test.ts`, 2 de segmentación en `cv-pipeline.test.ts`).
- Con Ollama real: ver `docs/BENCHMARKS.md` (CV de Juan 10,0 s, 7 puestos, 10,9 años; Word plano 9,0 s).

### Para revisar por Juan (QA)
1. Sube `cv-de-prueba.pdf` (si aparece el resultado viejo, «Cambiar» y vuelve a subir): ¿nombre, titular, Bogotá, correo y teléfono bien? ¿7 empresas (Itti, Ueno Bank, Monchis, Gopass, Alumnus, Iris Neobanco, Zurich)? ¿«11 años»? ¿perfil y secciones?
2. Sube un Word sin títulos de sección (p. ej. `tests/fixtures/cv-word-plano.txt` pegado en un .docx): debe leerse en ~10 s con puestos y fechas.
3. Un CV muy desordenado, sin fechas: debe tardar ~35 s y avisar de lo que no pudo leer; revisa «Corregir».
4. La pantalla Perfil en oscuro/claro, 1280 y 375 px (solo texto, badges y un botón «Corregir»).
5. Conocido: habilidades discutibles por la taxonomía; «Itti Tecnologia» con la palabra de sector.

## Ajuste de UI — fondo sólido (19-nov-2026)
- Fondo sólido neutro tomado de transitions.dev (`--bg`: claro `#fdfdfd`, oscuro `#121212`) expresado en los tokens del tema (`--background` claro `oklch(0.994 0 0)`, oscuro `oklch(0.182 0 0)`). En oscuro se subieron `--card`, `--popover` y `--sidebar` para conservar el contraste con el fondo más claro.
- `AmbientBackground` ya no se renderiza (ni en Entrada ni en el wizard); el componente sigue en el repo (la excepción documentada en CLAUDE.md queda sin uso). El aviso de arrastre sigue en el título («Suéltalo aquí»).
- Para revisar por Juan: Entrada y los 5 pasos en claro y oscuro (1280 y 375 px): ¿contraste de tarjetas, paneles de vidrio y bordes sobre el fondo nuevo?

## Ajuste de UI — marca «Sooosh» (19-nov-2026)
- Nombre visible: «Sooosh» (cabecera, título de la pestaña y metadatos de los archivos exportados). Logo: `components/brand/logo.tsx`, a partir de `logoipsum-393.svg` (solo la marca; el texto es HTML con la fuente de la app). El cuadrado y el «amanecer» son capas separadas (el amanecer es un hueco con máscara = silueta − 7 piezas del original; coincide con el logo original en el 99,97 % de los píxeles).
- Hover: al entrar el puntero en logo + nombre, el amanecer da una vuelta (1,1 s, curva `MOTION.ease`); el cuadrado no se mueve. Sin movimiento si el sistema pide reducirlo. **Excepción documentada** a «solo opacity/blur/translate»: la rotación del logo la pidió Juan.
- Color: `currentColor` (tema), no el rojo del archivo.
- Para revisar por Juan: cabecera en claro/oscuro y 375 px; sensación del giro (duración/curva en `SPIN` de `logo.tsx`); si quieres el favicon con la marca, se hace aparte.

### Ajuste: microinteracción del logo (19-nov-2026)
- Se reemplazó la vuelta de 360° por «plegar y volver a crecer», como el referente (transitions.dev): al entrar el puntero, el amanecer se recoge hacia el centro en 0,32 s (curva 0.4/0/0.2/1, tamaño 1→0,3 con un giro de −40°) y vuelve a crecer hasta 1,4 s con la curva suave `MOTION.ease`, deshaciendo el giro. Giro neto 0: termina exactamente en reposo. El cuadrado no se mueve; sin animación con «reducir movimiento».
- Medido (área rellena del logo, 200 px): reposo 21 078 px → plegado 35 926 px → de nuevo 21 078 px; el amanecer se contrae y vuelve sin saltos.
- Parámetros en `BUILD` de `components/brand/logo.tsx` (duración, plegado, tamaño mínimo, giro).
- Para revisar por Juan: pasa el mouse sobre «Sooosh» varias veces (en claro y oscuro). Si quieres más recogida (rayos más cortos) o más giro, se cambia `minSize`/`twist`.

### Ajuste: rayos escalonados en el logo (19-nov-2026)
- El amanecer se separó en **12 rayos** (cada uno es el amanecer recortado por una cuña desde el centro). Al hover, cada rayo se recoge hacia el centro (0,26 s, curva 0.4/0/0.2/1, hasta 22 % de su largo) y vuelve a salir (curva suave de la app), **uno tras otro cada 60 ms, en círculo** empezando por arriba. No hay giro: la sensación de movimiento circular la da la onda de largos. Un rayo conserva su ancho y solo cambia de largo. Ciclo total ≈ 1,55 s.
- Verificado: en reposo coincide con el logo original en el 99,96 % de los píxeles; la onda avanza rayo a rayo (medido por instante) y todo termina en largo 1. Las cuñas se solapan 2° para evitar costuras de antialias.
- Parámetros en `WAVE` y `RAYS` de `components/brand/logo.tsx` (duración, desfase, largo mínimo, orden/ángulos).
- Para revisar por Juan: pasa el mouse sobre «Sooosh»: ¿la onda se siente fluida y circular? Si quieres otra dirección, más/menos desfase o rayos que recojan menos, se ajusta ahí. Posible costura clara entre rayos en reposo (no debería verse): avísame si la ves.

## Migración a Supabase (19-nov-2026)

### Qué se hizo
- Proyecto **Sooosh** (Supabase, plan gratuito, sa-east-1). `CLAUDE.md`: Supabase permitido solo para datos (decisión de Juan); IA sigue 100 % local.
- **Migraciones** (`db/migrations/`, aplicadas con el conector): `0001_memory` (decisions, rules, meta), `0002_jobs` (tabla `jobs`: regiones, modo de trabajo, oferta estructurada en jsonb, vector(1024) para bge-m3, búsqueda de texto en español sin tildes), `0003` (revoca `rls_auto_enable()` a anon/authenticated, por el asesor de seguridad), `0004` (GRANT SELECT de `jobs`: los proyectos nuevos ya no dan permisos por defecto).
- **Seguridad (verificada con la clave pública)**: anon NO puede leer ni escribir `decisions`/`rules`/`meta`; sí puede LEER `jobs` activas (HTTP 200) y NO puede insertar (401). Asesor de seguridad de Supabase: solo quedan 3 avisos INFO esperados (RLS sin políticas = nadie desde el navegador).
- **Código**: `lib/db` ahora es Postgres (`getDb()` con `DATABASE_URL`, conexión guardada en `globalThis`); la **caché de resultados** sigue local (`data/cache.db`, `lib/db/cache.ts`): contiene texto del CV y se regenera. Pruebas con **PGlite** (Postgres en memoria, misma migración 0001). `enabled` de las reglas es booleano.
- **Datos migrados**: la base local `data/learning.db` tenía 0 decisiones, 0 reglas, 0 contadores y 18 filas de caché (regenerable): no había nada que copiar. (Puedes borrar `data/learning.db`.)
- CV subidos (`data/uploads`) y `profile.json`: se quedan locales hasta que haya cuentas de usuario.

### Qué se verificó
- `pnpm lint` (0 errores) · `tsc` OK · `pnpm build` OK · `pnpm test` 366/366 (memoria sobre PGlite).
- Contra Supabase real: guardar/actualizar decisión (upsert), estadísticas, reglas (alta, edición), ejemplos, reinicio, insertar/buscar/borrar una oferta; la búsqueda ignora tildes («Ingeniería… Bogotá» ↔ «ingenieria bogota»). Latencia en `docs/BENCHMARKS.md` (~200 ms por consulta).

### Para revisar por Juan
- En el dashboard de Supabase, Table Editor: `decisions`, `rules`, `meta` y `jobs` con RLS activado (candado).
- Usa la app normal (reescritura y «Lo que he aprendido»): debe funcionar igual; si Supabase falla, la reescritura sigue sin memoria.
- Siguiente: tarjeta de oferta desde un enlace (paso 1 del buscador).

## Fase L1 — cargar una oferta y guardarla como tarjeta (19-nov-2026)

### Qué se hizo
- **Panel `/admin/ofertas`** (`components/jobs/jobs-admin.tsx`): entra con la clave `ADMIN_TOKEN` (ya agregada a tu `.env.local`; se pide una vez por pestaña). Pestañas «Enlace» / «Pegar texto» (con enlace original opcional), análisis con el modelo local, **tarjeta editable** (título, empresa, ubicación, país, modalidad, nivel, contrato, restricción del remoto y regiones), guardar/actualizar, y lista de tarjetas con interruptor visible/oculta, enlace al original y eliminar.
- **API** (`/api/jobs/analyze`, `/api/jobs`, `/api/jobs/[id]`): todas exigen la clave (sin `ADMIN_TOKEN` configurado responde 503, nunca deja pasar). `analyze` reutiliza `fetchOffer` → `cleanOfferText` → `parseOfferText` (pipeline de coincidencia) y NO guarda; guardar es un paso aparte tras la revisión.
- **Deducción sin IA** (`lib/jobs/`): país y regiones por diccionario de países y ciudades (`geo.ts`; las ciudades ambiguas como Valencia o Santiago solo cuentan si aparece su país; un puesto híbrido o presencial solo abre su país), modalidad, contrato, alcance del remoto (frase literal) y habilidades de la taxonomía (`draft.ts`); dirección canónica sin rastreadores para no duplicar (`url.ts`: LinkedIn por id, Indeed por `jk`). Datos estructurados `JobPosting` (ubicación, teletrabajo, países del candidato, contrato, fechas) tienen prioridad cuando la página los publica (`lib/offer/html.ts`).
- Nada se inventa: lo que no se deduce queda vacío para completarlo a mano.

### Qué se verificó
- `pnpm lint` (0 errores; 3 advertencias previas) · `tsc` OK · `build` OK (3 rutas API + `/admin/ofertas`) · `pnpm test` **386/386** (nuevos: `tests/jobs.test.ts`, 21).
- De punta a punta contra el servidor, Ollama y Supabase reales: sin clave y con clave falsa → 401; analizar una oferta de prueba → 200 en 13 s con país CO, regiones CO+LATAM, híbrido, tiempo completo, senior y habilidades Figma/Jira; guardar crea la tarjeta; re-analizar el mismo enlace la detecta como existente y re-guardar NO duplica; ocultar, id/estado inválidos (400), eliminar y eliminar otra vez (404); la lista final quedó en 0 (la tarjeta de prueba se borró).
- Limitación: LinkedIn suele pedir iniciar sesión; en ese caso el análisis por enlace avisa y se usa «Pegar texto» (con el enlace en su campo).

### Para revisar por Juan
1. Abre http://localhost:3000/admin/ofertas (claro/oscuro, escritorio y 375 px). La clave está en `ADMIN_TOKEN` de `.env.local`.
2. Pega una oferta real (texto + enlace de LinkedIn) y mira la tarjeta: ¿país, regiones, modalidad y habilidades son correctos? ¿qué corriges más?
3. Guárdala, apágala con el interruptor, vuelve a pegar el mismo enlace (debe avisar que ya existe) y elimínala.
4. Siguiente: L2, el buscador público con filtro de región y orden por encaje con tu CV.

## Fase L2 — buscador público de ofertas (19-nov-2026)

### Qué se hizo
- **Página `/ofertas`** (`components/jobs/job-search.tsx`) y acceso «Buscar ofertas» (ícono de lupa) en la cabecera de la app: región, texto, modalidad y orden; lista con etiquetas (modalidad, restricción del remoto, contrato, 3 habilidades) y, si hay CV, «% de encaje»; al abrir una oferta: requisitos, deseables, responsabilidades, **«Postular»** (enlace al original) y **«Adaptar mi CV a esta oferta»**.
- **Región sin pedir ubicación**: se deduce de la zona horaria (la más fiable) y del idioma del navegador (`lib/jobs/region.ts`); la persona la cambia y se recuerda. Un país latinoamericano ve las ofertas de su país y las remotas abiertas a toda Latinoamérica; EE. UU. y España solo las suyas.
- **Búsqueda** (`lib/jobs/search.ts`): texto sin tildes y con raíces en español (columna `search` + coincidencia parcial en título/empresa) **y** por significado con `bge-m3` (vector de 1024 dimensiones guardado al guardar la tarjeta; `/api/jobs/embed` calcula los que falten), mezclados con Reciprocal Rank Fusion. Si Ollama no responde, sigue por texto. Búsqueda pública solo de ofertas activas y no vencidas; los valores van como parámetros (probado con comillas y SQL).
- **Encaje con el CV** (`lib/jobs/rank.ts`): reutiliza `computeFit` (reglas del motor de coincidencia, sin IA); muestra «Tu CV no muestra: …» con primero las habilidades reconocibles. El CV se toma del último leído en este equipo (`GET /api/cv/profile`, solución de un solo usuario hasta las cuentas de L5).
- **De la tarjeta al flujo de adaptación**: «Adaptar mi CV a esta oferta» deja la oferta (texto reconstruido solo con lo extraído) en `sessionStorage`; la pantalla de inicio la recoge y avisa; tras subir el CV, el paso «Oferta» ya viene lleno.
- Corregido (también en `/admin/ofertas`): los botones que son enlaces usan `<a>`/`Link` con `buttonVariants` (Base UI marcaba error por `render` sin botón nativo, y un enlace debe anunciarse como enlace).

### Qué se verificó
- `pnpm lint` (0 errores; 3 advertencias previas) · `tsc` OK · `build` OK · `pnpm test` **401/401** (nuevos: `tests/job-search.test.tsx`, 15).
- Contra el servidor, Supabase y Ollama reales (ver `docs/BENCHMARKS.md`): filtros por región/modalidad correctos para CO, MX, LATAM, US, ES, AR; «diseno» sin tilde encuentra «Diseñador»; «dise» (fragmento) también; consulta sin relación devuelve vacío; región inválida y falta de región → 400; la respuesta pública no trae el vector. Umbral semántico calibrado a 0,54 (hay que recalibrar con ofertas reales).
- En el navegador (aserciones de DOM, zona horaria America/Bogota): el buscador abre en Colombia, cambiar región/modalidad cambia la lista, abrir una oferta muestra su detalle y el enlace de postulación, «Adaptar mi CV…» vuelve a la app con el aviso y la oferta consumida; sin scroll horizontal; sin errores en la consola.

### Para revisar por Juan
1. Abre http://localhost:3000/ofertas (claro/oscuro, escritorio y 375 px). ¿La región inicial es la tuya?
2. Carga 3 o 4 ofertas más en `/admin/ofertas` (de distintos países, remotas y presenciales) y prueba: filtros, búsquedas con y sin tilde, «ordenar por encaje con mi CV».
3. Abre una oferta → «Adaptar mi CV a esta oferta» → sube tu CV → en «Oferta» debe estar lista.
4. Dime qué búsquedas no devuelven lo que esperas: con más ofertas reales se ajusta el umbral semántico.
5. Pendiente de L3: conectores de fuentes con API pública (Greenhouse, Lever, Get on Board).

## Fase L2.5 — tarjeta y detalle de oferta, y camino de postulación (19-nov-2026)

### Qué se hizo
- **Datos**: migración `0005` (columnas `apply` y `salary` en `jobs`). `lib/jobs/apply.ts` deduce **cómo se postula** sin IA: enlace de postulación de la fuente → sitio de la oferta (LinkedIn, Indeed, Computrabajo, Get on Board… = «Se aplica en X»; Greenhouse, Lever, Ashby… = «Formulario de la empresa») → correo con verbo de postulación en el texto («envía tu CV a…») → si no se sabe, «Ver la oferta original» (no adivina). `lib/jobs/salary.ts`: salario solo con moneda explícita y palabra de salario (un «$» suelto no se interpreta); también `baseSalary` del JSON-LD. `lib/jobs/facts.ts`: solo los datos que existen (experiencia, salario, modalidad, contrato, nivel, fecha de la fuente).
- **Tarjeta** (`components/jobs/job-card.tsx`): título, empresa · ubicación · fecha, **hasta 3 datos clave con etiqueta** (si no hay, no aparecen), 4 habilidades y, abajo, el camino de postulación con su ícono; encaje con el CV solo si la oferta tiene al menos 2 requisitos o tareas (si no, un porcentaje sería relleno).
- **Detalle interno** `/ofertas/[id]` (`components/jobs/job-detail.tsx`, enlace compartible): encabezado, datos clave, «Cómo se postula» con una frase de qué ocurre al pulsar, encaje con el CV (qué muestra tu CV y qué no) con las habilidades marcadas si tu CV las tiene, secciones «Qué harás / Qué piden / Se valora» solo si tienen contenido, fuente y enlace al original, y barra fija con **«Postular en LinkedIn» (según el camino)** y «Adaptar mi CV a esta oferta».
- **Administración**: el borrador permite corregir cómo se postula (tipo, portal, enlace o correo) y el salario.
- `LOGIC_VERSION` de la caché de CV subió a 4 (la lógica de lectura cambió en la Fase K9 y la caché podía servir lecturas viejas).

### Qué se verificó
- `pnpm lint` (0 errores; 3 advertencias previas) · `tsc` OK · `build` OK · `pnpm test` **419/419** (nuevos: `tests/job-ux.test.tsx`, 17).
- En el navegador (aserciones de DOM) con 3 ofertas de prueba de distinta completitud (ya borradas): la completa muestra 3 datos clave y «Se aplica en LinkedIn»; la parcial solo «Modalidad» y «Formulario de la empresa»; la mínima no muestra datos ni habilidades y dice «Se aplica por correo». En el detalle: el botón principal cambia según el camino («Postular en LinkedIn» abre en otra pestaña, «Enviar mi CV por correo» es un `mailto:`), no hay secciones vacías, la barra queda fija, no hay scroll horizontal y un id inexistente muestra «No encontramos esa página».
- Arreglo en el camino: el módulo nuevo de la ruta de encaje quedó desactualizado en el servidor de desarrollo (error «no es una función»); se movió `hasEnoughForFit` a su propio archivo y funcionó sin reiniciar.

### Pendiente de tu decisión
- **Regla de `CLAUDE.md`**: `GlassPanel` solo se permite en 3 sitios (línea de tiempo, tarjeta de cambio, menús y diálogos) y la tarjeta de oferta es un cuarto uso. No edité `CLAUDE.md` por mi cuenta: si apruebas el cuarto uso, añádelo a la lista (o dime y lo hago).
- Las referencias que enviaste usan tipografía con serifa; la regla vigente es una sola familia sans (Geist) y se respetó.

### Para revisar por Juan
1. Carga 2 o 3 ofertas (una de LinkedIn, una de Greenhouse/Lever y una sin enlace) en `/admin/ofertas` y mira `/ofertas`: ¿la tarjeta se ve bien con pocos y con muchos datos? ¿la frase «Se aplica en…» es clara?
2. Abre una oferta (escritorio y 375 px, claro y oscuro): ¿el detalle y la barra fija se leen bien?
3. El encaje usa el último CV analizado guardado en `data/profile.json`; si es viejo, vuelve a subir tu CV.

## Fase L3 — puerto de fuentes, perfil de búsqueda y 4.º uso de GlassPanel (19-nov-2026)

### Qué se hizo
- **Perfil de búsqueda explícito** (`lib/profile/search-profile.ts`, `components/jobs/search-profile-panel.tsx`): el buscador compara cada oferta con **un CV que la persona elige a propósito**, no con «el último»; adaptar otros CV a otras ofertas no lo cambia. El primer CV que se lee pasa a ser el perfil; en la pantalla Perfil hay «Usar este CV para buscar ofertas»; en `/ofertas` se puede **subir el CV ahí mismo** (se lee con el mismo pipeline, local), cambiarlo o quitarlo. Corregir ese mismo archivo lo actualiza. Vive en este navegador (con cuentas pasará a la cuenta). Se quitó el `GET /api/cv/profile`.
- **Puerto de fuentes** (`lib/sources/`): cada fuente es un adaptador que entrega ofertas en un formato común (`ExternalJob`); `normalize.ts` las vuelve tarjetas **sin IA** (país y regiones, modalidad, requisitos y tareas por títulos y viñetas, años de experiencia, nivel, habilidades de la taxonomía, camino de postulación) y **descarta lo que no es de Latinoamérica**; `ingest.ts` guarda de a 100 (una sola consulta por bloque), no duplica (clave = enlace canónico + título/empresa/país entre fuentes), respeta lo que Juan oculta, reactiva lo que reaparece y **cierra lo que desaparece** de la fuente (solo si la lectura fue completa). Cortesía: cabecera `SoooshBot`, pausa de 1,2 s entre páginas.
- **Adaptadores**: Get on Board (API pública sin clave; no entrega moneda del salario, así que no se muestra), Greenhouse, Lever (trae `applyUrl` → «Formulario de la empresa») y Ashby.
- **Directorio de empresas** (`source_companies`, migración `0006`): se agrega a mano o **solo**, al cargar una oferta con enlace de Greenhouse/Lever/Ashby. Panel «Fuentes» en `/admin/ofertas`: sincronizar Get on Board, una empresa o todas, pausar, quitar y ver el informe (leídas, fuera de región, repetidas, nuevas, actualizadas, cerradas).
- Migración `0006`: columnas `source_key`, `external_id`, `last_seen_at`, `dedupe_key`, `origin` en `jobs`.
- **4.º uso de `GlassPanel`** (tarjeta de oferta) aprobado por Juan: añadido a la lista cerrada de `CLAUDE.md`.
- La lista sin búsqueda ahora ordena por fecha de la oferta (la de la fuente si existe).
- `embedMissing` calcula vectores de a 24 por llamada.

### Qué se verificó
- `pnpm lint` (0 errores; 3 advertencias previas) · `tsc` OK · `build` OK · `pnpm test` **442/442** (nuevos: `tests/sources.test.ts` 19, `tests/search-profile.test.ts` 4).
- **Carga real** (ver `docs/BENCHMARKS.md`): Get on Board 976 ofertas nuevas en 30,5 s y la segunda corrida 0 nuevas / 976 actualizadas / 0 cerradas (idempotente); Clara 139, Despegar 108, Addi 33, Cabify 28, Mural 5, Fintual 4; **1 294 ofertas activas** (Chile 521, México 143, Colombia 137, Brasil 113, Argentina 66, Perú 39). Cabify, Despegar y Fintual traen poco contenido (Cabify 2 de 28 permiten estimar encaje): lo cubrirá el enriquecimiento con IA del plan.
- Búsquedas reales sobre esa base: por región 283–1 124 ms; «diseñador UX» en Colombia, «analista de datos» en Argentina y «python» remoto devuelven ofertas coherentes.

### Para revisar por Juan
1. **Reinicia `pnpm dev`** (Ctrl+C y vuelve a correrlo): el servidor de desarrollo conservó en memoria el esquema anterior y las rutas `/api/sources` fallan hasta entonces. La carga de 1 294 ofertas la hice sin pasar por esas rutas (con las mismas funciones) y ya está en la base.
2. En `/admin/ofertas` → «Fuentes»: prueba «Sincronizar» en una empresa y mira el informe; agrega otra empresa con su nombre de tablero.
3. En `/ofertas`: sube tu CV ahí (o usa «Usar este CV…» en el Perfil) y ordena por «Encaje con mi CV»; abre un par de ofertas de distintas fuentes.
4. Las ofertas de Get on Board «remotas» se tratan como abiertas a Latinoamérica (supuesto: es una bolsa latinoamericana; su API no dice el alcance). Si ves una que no, dímelo.
5. Los vectores de las ofertas nuevas se calculan en segundo plano (≈ 2 por segundo); mientras tanto la búsqueda por significado cubre solo las que ya tienen.
6. `docs/PLAN-IA.md`: el plan para integrar IA en el recorrido, para que lo discutamos.

## Buscador — Tecnología primero, match ≥ 75 % y encaje sobre miles (19-nov-2026)

### Qué se hizo
- **Familia de cargo y filtro «Tecnología»** (`lib/jobs/classify.ts`, migración `0007`): cada oferta se clasifica sin IA (título → área que declara la fuente → habilidades) en 19 familias; 10 son de tecnología (desarrollo, datos, diseño digital, producto, infraestructura, calidad, seguridad, gestión de TI, soporte TI, consultoría TI/ERP). El buscador **abre con «Tecnología» activado** (se puede cambiar a «Todas las áreas»; se recuerda). Las adaptadores pasan el área de la fuente. Se volvieron a sincronizar las 1 294 ofertas para clasificarlas.
- **Match = encaje ≥ 75 %** (`lib/jobs/match.ts`): insignia «Match 82 %» (con ✓) en la tarjeta, interruptor **«Solo los que hacen match»** y encaje en el detalle. Una oferta con menos de 2 requisitos o tareas no tiene encaje, así que nunca es match.
- **Orden por encaje real**: ahora se puntúan hasta 80 candidatas (antes solo las 30 que traía la búsqueda), elegidas por cercanía de vectores entre el CV y la oferta (`embedProfile`) cuando no hay texto de búsqueda; el encaje se **guarda en caché** por (CV, oferta). La respuesta informa cuántas hacen match entre las candidatas.
- **Corrección**: una clase arbitraria de Tailwind (`sm:grid-cols-[1fr_auto_auto]`) que dejé en el buscador rompía la regla de no usar valores arbitrarios; se reemplazó.
- **Consentimiento**: propuesta en `docs/CONSENTIMIENTO.md` (aún sin construir). Decisiones del plan de IA registradas en `docs/PLAN-IA.md`.

### Qué se verificó
- `pnpm lint` (0 errores; 3 advertencias previas) · `tsc` OK · `build` OK · `pnpm test` **483/483** (nuevos: `tests/classify.test.ts`, 41).
- Contra Supabase real (ver `docs/BENCHMARKS.md`): «otros» bajó de 236 a 42 al usar el área de la fuente; filtros Tecnología/Todas distintos en CO, CL y AR; «diseñador UX» en tecnología devuelve diseñadores UX/UI; con CV de desarrollo hay 3 match en LATAM; encaje 0,4–3,7 s.

### Para revisar por Juan
1. **Reinicia `pnpm dev`** (el servidor conserva el esquema anterior: la búsqueda y las rutas nuevas pueden fallar hasta entonces).
2. Sube tu CV actual en `/ofertas` (el de `data/profile.json` es una lectura vieja) y mira cuántas ofertas hacen match con 75 %. Con los CV de prueba salieron muy pocas (0 a 3 de 80): dime si quieres bajar el umbral o esperar al juez de IA.
3. Mira «Tecnología» vs «Todas las áreas» en Colombia, Chile y Argentina: ¿falta o sobra algún tipo de cargo?
4. `docs/CONSENTIMIENTO.md`: aprueba o ajusta la propuesta (momento, niveles, retención, texto de búsqueda).

## Consentimiento y medición de uso (19-nov-2026)

### Qué se hizo
- **Franja de permiso** (`components/privacy/consent-banner.tsx`): aparece tras la **primera búsqueda** en `/ofertas`, fija abajo sin tapar los resultados (se deja espacio al final). Dos casillas («Para mí», «Para todos»), «Aceptar las dos» (o «Guardar mi elección» si marcó algo), «Solo lo necesario», «Ver qué guardamos» y una X. Si la cierra sin elegir vuelve **una vez** la semana siguiente y no insiste. Sin respuesta, no se guarda nada.
- **Diálogo «Privacidad»** (`privacy-dialog.tsx`), siempre disponible al pie de `/ofertas` y del detalle: interruptores para cambiar la elección, qué se guarda y qué nunca, cuánto tiempo, y **«Borrar mis datos»** con confirmación (borra en el servidor todo lo de ese identificador y apaga la medición).
- **Eventos** (`lib/events/`): `search`, `impressions`, `open`, `apply_click`, `adapt_cv`, `save`, `dismiss`, cada uno con una **lista cerrada de campos** (lo demás se descarta); el texto de la búsqueda se guarda en minúsculas, sin tildes y **solo si no parece un dato personal** (correo, enlaces, números largos, frases largas). `track()` **no hace nada** sin consentimiento vigente; el servidor **vuelve a comprobarlo** en cada envío (403 si no), limita a 300 eventos/hora por identificador y borra lo de más de 90 días. Si el servidor no pudo registrar el permiso, la medición no se activa.
- **Para qué sirven ya**: (1) «Para mí» reordena **suavemente** la lista por relevancia con lo que la persona abrió, guardó, adaptó, postuló o descartó (con menos de 3 señales no cambia nada; el orden de relevancia pesa más que el gusto); (2) «Para todos» alimenta las **«Populares»** del buscador, solo con ≥ 5 personas distintas.
- **Guardar y descartar** (nuevo, para tener esas señales): en el detalle, «Guardar» y «No me interesa»; las descartadas dejan de aparecer, las guardadas llevan un marcador y se ven con el interruptor «Solo mis guardadas» (vive en este navegador).
- Migración `0008` (`events`, `consent_log`, RLS activo y sin políticas).

### Qué se verificó
- `pnpm lint` (0 errores; 3 advertencias previas) · `tsc` OK · `build` OK · `pnpm test` (nuevos: `tests/events.test.ts`, 21: saneado, lista cerrada, consentimiento y retiro, límite por hora, borrado, purga de 90 días, tendencias con umbral de 5, orden suave y el flujo del navegador con cronómetros falsos).
- **De punta a punta contra Supabase real** (llamando a las rutas): sin consentimiento 403; con «Para mí» se guardan 4 de 5 eventos (el inválido se rechaza; el campo extra y la búsqueda con correo no llegan a la base: texto en `null`); la búsqueda con 3 señales sale `personalized: true` y sin identificador `false`; «solo guardadas» devuelve las existentes; 5 identificadores distintos con «Para todos» hacen aparecer la búsqueda popular en Colombia y no en México, y al borrar a uno (quedan 4) desaparece; «Borrar mis datos» elimina todo y un nuevo envío da 403; al final `events` y `consent_log` quedaron en 0.

### Para revisar por Juan
1. **Reinicia `pnpm dev`** (necesario: el servidor conserva el esquema anterior y no conoce las tablas nuevas).
2. En `/ofertas` haz una búsqueda: debe salir la franja abajo. Prueba «Ver qué guardamos», «Aceptar las dos», abre una oferta, «Guardar» y «No me interesa», y luego «Privacidad» → «Borrar mis datos».
3. Mira la franja a 375 px (que no tape los resultados) y en claro/oscuro.
4. Antes de producción: que un abogado revise el texto (Colombia Ley 1581 de 2012, Argentina Ley 25.326, Chile Ley 19.628) y se defina el responsable del tratamiento y el canal para ejercer derechos.

## Enriquecimiento con IA de ofertas pobres y lector de portales sin API (19-nov-2026)

### Qué se hizo
- **Enriquecimiento** (`lib/enrich/`, migración `0009`, `POST /api/enrich`, botón «Enriquecer 10» en `/admin/ofertas`): al sincronizar, las ofertas «pobres» (menos de 2 elementos entre requisitos, deseables y tareas) entran a una cola con su texto original; el modelo local recibe el texto **compacto** (fragmentos numerados) y solo **señala números**; el código arma las listas con **fragmentos literales** (más herramientas, idiomas, años y nivel derivados sin IA) y los mezcla **sin pisar lo que ya estaba bien**. El texto original se borra al terminar. Si Ollama no responde, se detiene sin marcar fallos. Resultados en `docs/BENCHMARKS.md`: 158 mejoradas de 167, ≈ 1 271 de 1 294 ofertas ya con estructura, todas con vector.
- **Lector de portales sin API** (L4, `lib/sources/portals/`): lee `robots.txt` (con comodines y regla más específica; si el sitio ni deja leerlo, **no entra**), usa los sitemaps que el sitio publica, elige solo ofertas **nuevas de tecnología** por el cargo de la dirección y lee solo el JSON-LD `JobPosting` que la página publica para buscadores; se identifica como SoooshBot, una página por vez con pausa, y **se detiene ante 401/403/429/5xx**. Portales activos: **Chiletrabajos** y **Trabajando.cl** (ambos de Chile). Botones en `/admin/ofertas` → «Fuentes».
- **Lo que NO se pudo incluir** (investigado el 19-nov-2026 con nuestras reglas): Computrabajo responde 403 incluso a su `robots.txt` (bloquea lectores automáticos); elempleo prohíbe sus ofertas en `robots.txt`; Bumeran/Zonajobs/Laborum cargan el contenido con JavaScript (sin datos en la página; haría falta renderizar o usar su API interna). Por eso L4 **no aporta ofertas de Colombia ni Argentina**; para eso: descubrimiento masivo de empresas con tablero público y pedir feeds de socio.

### Qué se verificó
- `tests/enrich.test.ts`, `tests/enrich-lines.test.ts` (12) y `tests/portals.test.ts` (8: robots con comodines y 403, sitemaps con CDATA, solo tecnología nueva, respeto del robots, detención ante 403, un sitio que bloquea su robots no se toca).
- En vivo: ver `docs/BENCHMARKS.md` (enriquecimiento) y la corrida de portales abajo.

### Para revisar por Juan
1. **Reinicia `pnpm dev`** (esquema nuevo: tablas `job_enrichment` y columnas de fuentes).
2. En `/admin/ofertas` → «Fuentes»: prueba «Enriquecer 10» (si no hay pendientes, queda desactivado) y «Sincronizar» en Chiletrabajos.
3. Decide qué hacer con Navent (Bumeran/Zonajobs/Laborum) y Computrabajo: pedir feed de socio, o un lector con navegador (más pesado y con más riesgo).
4. Pendiente del plan: descubrimiento masivo de empresas con tablero público, más sistemas de selección con API (Workable, Recruitee, SmartRecruiters, Personio), fuentes remotas (Himalayas, Jobicy, Remotive) y sincronización automática diaria.

## Descubrimiento masivo de empresas y 4 sistemas de selección más (19-nov-2026)

### Qué se hizo
- **Barrido de empresas** (≈ 1 100 nombres × 3 sistemas, a ritmo bajo y con identificación SoooshBot): 71 tableros públicos con ofertas en la región. Se agregaron los de ≥ 3 ofertas regionales (menos los solo de Brasil): Nubank, Toku, Xepelin, Airtm, Wizeline, VTEX, EBANX, Belvo, Consensys, Paxos, Stripe, MongoDB, Datadog, Databricks, Brex, Airbnb… Resultado: 44 fuentes sincronizadas, **487 ofertas nuevas**; 5 219 quedaron fuera de región (se descartan por diseño).
- **Nuevos lectores** (`lib/sources/adapters/`): **Workable**, **Recruitee**, **SmartRecruiters** (pide el detalle solo de avisos de la región o remotos) y **Personio** (feed XML). Migración `0010` amplía la lista de sistemas; el directorio y el panel ya los aceptan, y reconocen sus enlaces.
- Con ellos se sumaron Platzi, Bitfinex, Endava, Wise y Tapi (otras 65 ofertas, aprox.). SmartRecruiters trae el nivel en inglés: se traduce y lo no reconocido queda vacío.
- Estado de la base: **1 905 ofertas activas** de 48 fuentes (1 077 de tecnología): CL 580, MX 234, CO 129, AR 85. Todas con vector.

### Qué se verificó
- `tests/ats-more.test.ts` (5) con los cuatro lectores y los enlaces nuevos; corridas reales de sincronización y vectores.

### Para revisar por Juan
1. Reinicia `pnpm dev`. En `/admin/ofertas` el selector «Sistema» ahora lista los siete.
2. Colombia y Argentina siguen con pocas ofertas (129 y 85): el barrido solo encuentra empresas con tablero público; el resto depende de feeds de socio o de portales (ver L4).
3. Siguiente del plan: fuentes remotas (Himalayas, Jobicy, Remotive) y sincronización automática diaria.

## Fuentes remotas con API gratuita (19-nov-2026)

### Qué se hizo
- `lib/sources/adapters/remote.ts`: **Remotive**, **Jobicy** y **Himalayas**. Solo se conservan las ofertas abiertas a Latinoamérica: la restricción de ubicación debe decir «worldwide/anywhere/LATAM» o nombrar un país de la región (un «USA only» se descarta aunque el texto hable de Latinoamérica); sin restricción cuenta como abierta.
- **Términos que se cumplen** (los tres piden lo mismo): la ficha muestra «Fuente: …» con enlace; el botón de postular lleva a la dirección que la fuente entrega (no al sitio de la empresa); no se reenvían a otros agregadores; pocas lecturas por día (Remotive pide ≤ 4). Lectura de Remotive por 6 categorías de tecnología; Jobicy por zonas `latam`, `anywhere`, `argentina`, `mexico` (Colombia/Chile/Perú/Uruguay no existen como zona y responden 400; además responde 429 si se le pide seguido, por eso hay 4 s de pausa); Himalayas por búsqueda por país (CO, AR, CL, MX, PE, UY), 5 páginas de 20.
- Panel `/admin/ofertas` → «Ofertas remotas»: un botón por fuente. Las fuentes no cierran ofertas por «no aparecer» (lectura parcial).

### Qué se verificó
- `tests/remote-sources.test.ts` (4). Corrida real: Remotive 10, Jobicy 131 (22 con salario), Himalayas 219 (30 con salario) nuevas; todas con enlace de la fuente y con vector. Base: **2 265 ofertas activas, 1 240 de tecnología**.
- 144 de ellas quedaron en la cola de enriquecimiento con IA (el texto viene en inglés y sin secciones).

### Para revisar por Juan
1. Reinicia `pnpm dev`. En `/admin/ofertas`: «Ofertas remotas» y, después, «Enriquecer 10» (varias veces) para estructurar las 144 en cola (≈ 12 s por oferta).
2. En una oferta remota: «Fuente: Himalayas · ver la publicación original» y el botón de postular debe abrir la página de la fuente.
3. Pendiente del plan: sincronización automática diaria (hoy todo es manual).

## Sincronización automática diaria (20-nov-2026)

### Qué se hizo
- `pnpm sync` (`scripts/sync.mjs` + `lib/sources/schedule.ts`): una corrida al día que lee Get on Board, el directorio de empresas (7 sistemas), los portales y las 3 fuentes remotas; cada fuente se omite si se leyó con éxito hace < 20 h (`sync_runs`, migración `0011`). Después vence ofertas (`lib/sources/expire.ts`: vigencia vencida, remotas no vistas en 21 días, portales de > 60 días), borra eventos de > 90 días, estructura con IA local lo pendiente (presupuesto de 20 min; si Ollama no responde, solo se detiene) y calcula vectores.
- No necesita servidor: `scripts/ts-alias.mjs` deja a Node ejecutar los módulos TypeScript del proyecto. `pnpm sync:install` programa la corrida a las 03:30 con launchd (al despertar si el Mac dormía); `pnpm sync:uninstall` la quita. Detalle en `docs/SINCRONIZACION.md`.

### Qué se verificó
- `tests/sync-schedule.test.ts` (2). Corrida real de `pnpm sync --only=remote:remotive`: 10 actualizadas, 4 ofertas estructuradas con IA, 4 vectores, 153 s; la segunda corrida la omite («ya sincronizada hace menos de 20 h»). No corrí todas las fuentes de nuevo para no repetir lecturas de ayer: la primera corrida completa será la programada o `pnpm sync`.

### Para revisar por Juan
1. Ejecuta **`! pnpm sync:install`** (cambia tu Mac: crea `~/Library/LaunchAgents/app.sooosh.sync.plist`; lo quitas con `pnpm sync:uninstall`).
2. Mañana revisa `data/sync.log` y la tabla `sync_runs` en Supabase.
3. Pendiente fuera de este plan: lector para Navent/Computrabajo (feed de socio), Colombia y Argentina siguen con pocas ofertas.

## Plan de sincronización automática — Fase 1: fases, cadencia, candado y salud (20-nov-2026)

### Qué se hizo
- `pnpm sync --phase=fetch,vectors,enrich`: la corrida se divide en fases; `fetch` (leer fuentes, vencer, purgar) no usa IA y es la que irá a la nube.
- **Cadencia por fuente**: Get on Board 3 h, empresas 6 h, portales y remotas 12 h (con 20 min de tolerancia para un cron que no cae exacto); tras 3 fallos seguidos una fuente se pausa 12 h.
- **Candado** en la base (`sync_locks`, migración `0012`): dos corridas simultáneas no se pisan (comprobado contra Supabase: la segunda y la tercera no lo obtienen; tras soltarlo, sí).
- **Salud**: `GET /api/sources/health`, sección «Sincronización automática» en `/admin/ofertas` y `pnpm sync --check` (sale con error si Get on Board o las empresas llevan > 12 h sin éxito).

### Qué se verificó
- 535 pruebas, lint, tsc y build en verde. Corrida real: Remotive se omitió («no toca todavía»), Jobicy corrió (27 nuevas, 107 actualizadas) y `--check` lo reflejó.

### Impacto en la app y la experiencia
- Las ofertas ya no dependen de que alguien pulse un botón y cada fuente se lee con respeto (ni de más ni de menos). Con el cron de 3 h, una oferta nueva de Get on Board aparece en ≤ 3 h; de empresas, ≤ 6 h; de portales/remotas, ≤ 12 h.
- Una fuente caída no frena a las demás ni se martilla; y se ve en el panel cuál está atrasada.

## Plan de sincronización automática — Fase 2: repositorio público y workflow (20-nov-2026)

### Qué se hizo
- **Auditoría para publicar**: el código no contiene claves (sin `sb_secret`, contraseñas, tokens ni `.env`; `.env.local` y `data/` están ignorados; ni el historial). Sí había datos personales: un teléfono real y el nombre completo del dueño en pruebas, comentarios y docs → reemplazados por datos ficticios (pruebas en verde). Las 5 imágenes de referencia de terceros (`docs/referencias/`) dejan de versionarse (siguen en tu disco).
- **Workflow** `.github/workflows/sync.yml`: cron `17 */3 * * *` + botón manual; lee fuentes (`--phase=fetch`), mira si hay vectores pendientes (`--pending`) y solo entonces instala Ollama (con caché de `bge-m3`) y calcula vectores; termina con `--check` (falla y GitHub avisa por correo si Get on Board o las empresas están atrasadas). Una corrida a la vez; permisos mínimos.
- `pnpm sync` ya no exige `.env.local` (en GitHub la clave entra como secreto).

### Qué se verificó
- YAML válido; `pnpm sync --pending` en vivo (27 ofertas sin vector); lint/tsc/build/test en verde. **El workflow aún no corrió en GitHub** (el repo no está publicado): se verifica en la Fase 3.

### Impacto en la app y la experiencia
- Hasta no publicar, nada cambia para las personas. Al publicar: ofertas nuevas visibles en ≤ 3 h aunque tu Mac esté apagado, y con vector (orden «Para ti») en esa misma corrida.
- Queda pendiente por la privacidad del historial: el historial antiguo trae el teléfono y el nombre (ver «Para revisar por Juan»).

### Para revisar por Juan
1. Decidir cómo publicar el historial (ver el informe): recomendado empezar con historial limpio.
2. Pasos en GitHub (crear repo público, secreto `DATABASE_URL`, activar Actions) — en el informe.

## Plan de sincronización automática — Fase 3: primera verificación en GitHub (20-nov-2026)

### Qué se hizo
- Repositorio público publicado (historial limpio), secreto `DATABASE_URL` y workflow `Sincronizar ofertas` (cron `17 */3 * * *`). Cuatro corridas manuales; la cuarta terminó en verde.
- Hallazgos de las corridas reales: (1) un módulo mal armado en el código comiteado (función dentro de un arreglo) rompía la carga: corregido; (2) los 403 de Ashby/Workable y el 429 de Himalayas eran de ráfaga: se añadió lectura cortés (reintento con espera, pausas de 1,2 s entre empresas y 3 s en Himalayas) y Himalayas trajo 147 ofertas nuevas; (3) **Get on Board responde 403 al cliente de Node desde GitHub** (con `curl` y la misma identificación, 200): no se rodea el bloqueo, esa fuente se lee desde el Mac (`runner: "home"`, launchd cada 3 h).
- Medido en GitHub: leer fuentes 145–593 s; vectores 147–237 en 164–176 s (Ollama + bge-m3 en el runner).

### Qué falta verificar
- 24 y 48 h de corridas programadas sin intervención (`sync_runs` y la pestaña Actions). La Fase 3 no se da por cerrada hasta entonces.

### Para revisar por Juan
1. `! pnpm sync:install` para que el Mac lea Get on Board (y estructure con el LLM) cada 3 h.
2. Mañana: pestaña Actions (corridas cada 3 h en verde) y `/admin/ofertas` → «Sincronización automática».
3. Decidir si se autoriza `curl` para Get on Board y llevarlo a la nube.

## Mejoras de diseño y experiencia — 1: insignia «Nueva» (20-nov-2026)

### Qué se hizo
- Get on Board ya corre en la nube: su adaptador reintenta una vez con `curl` (autorizado por Juan); la corrida de GitHub lo leyó con éxito.
- Insignia **«Nueva»** con llama (`components/jobs/new-badge.tsx`) en la tarjeta y en la ficha de la oferta mientras haya entrado a Sooosh hace menos de 48 h. El servidor lo calcula en la base (`isNew`), no el navegador; la llama entra con un acercamiento de 300 ms solo si no se pidió reducir el movimiento.

### Qué se verificó
- lint, tsc, build y 536 pruebas en verde (incluye la de la tarjeta con y sin `isNew`).

### Impacto en la app y la experiencia
- Se ve de un vistazo qué ofertas son frescas. Hoy muchas llevarán la insignia porque la importación masiva ocurrió en las últimas 48 h; con el tiempo solo la tendrán las que entren en cada sincronización.

### Para revisar por Juan
1. Reinicia `pnpm dev`. En `/ofertas`: tarjetas con «🔥 Nueva» arriba a la derecha (junto al encaje) en claro/oscuro, escritorio y 375 px; y la insignia sobre el título en la ficha de una oferta reciente.

## Mejoras de diseño y experiencia — 2: búsqueda en vivo (20-nov-2026)

### Qué se hizo
- Búsqueda **en dos tiempos**: con 2 o más letras, ~200 ms después de la última tecla aparecen los resultados por texto (`fast`: sin tocar Ollama); tras una pausa de 700 ms o al pulsar **Enter** se suma la búsqueda por significado. Cada petición cancela la anterior.
- Medición: solo la búsqueda completa cuenta como «búsqueda» (antes cada pausa corta de escritura podía registrarse); no se guardan las teclas intermedias.
- Mientras llega una respuesta, los resultados anteriores se quedan visibles con una atenuación suave (150 ms) en vez de saltar al esqueleto. Las tarjetas nuevas entran con un fundido y un desplazamiento mínimo, escalonadas 20 ms (las primeras 8); sin movimiento si el sistema pide reducirlo.

### Qué se verificó
- lint, tsc, build y 538 pruebas en verde (nueva `tests/search-fast.test.ts`: la ruta no calcula el vector en modo `fast` y sí en el completo).

### Impacto en la app y la experiencia
- Se siente inmediata: sin esperar a que Ollama calcule un vector por cada pausa; el significado «enriquece» la lista un instante después. Menos carga en Ollama y en Supabase.

### Para revisar por Juan
1. Reinicia `pnpm dev`. En `/ofertas` escribe despacio «diseñ…»: los resultados deben ir cambiando mientras escribes, sin parpadeos; al hacer una pausa pueden reordenarse un poco (se suma el significado). Prueba Enter, borrar todo el texto, y claro/oscuro y 375 px. Con «reducir movimiento» activado en el sistema no debe haber animación de entrada.

## Mejoras de diseño y experiencia — 3: filtros guardados (20-nov-2026)

### Qué se hizo
- **«Mis filtros»** (`components/jobs/saved-filters-bar.tsx`, `lib/profile/saved-filters.ts`): botón «Guardar estos filtros» (región, área, modalidad, orden y «solo match»); una vez guardados aparecen «Aplicar mis filtros» (un toque; queda como «Mis filtros aplicados» y desactivado cuando ya coinciden), «Actualizar mis filtros» y «Quitar», más el interruptor **«Aplicar mis filtros al abrir»** para que el buscador arranque ya con ellos.
- Solo en este navegador (sin cuentas ni consentimiento; no sale de aquí). No guarda el texto buscado ni «solo guardadas». Un valor roto o una región desconocida se descarta entero (mejor sin filtros que con filtros rotos). Avisos con Sonner y aparición con fundido de 150 ms (sin movimiento si se pidió reducirlo).

### Qué se verificó
- lint, tsc, build y 543 pruebas en verde (nueva `tests/saved-filters.test.tsx`: guardar/leer, conservar «al abrir» al actualizar, quitar, validación de valores raros, comparación, y la barra sin guardados).

### Impacto en la app y la experiencia
- Se acabó reconfigurar todo cada vez que se recarga la página: configuras una vez y vuelves a tus filtros con un toque, o ni eso.
- Mientras no existan cuentas viven en el navegador (otro dispositivo no los ve); con cuentas pasarán a Supabase.

### Para revisar por Juan
1. Reinicia `pnpm dev`. En `/ofertas`: cambia región/área/modalidad/orden → «Guardar estos filtros» (toast). Cambia algo y pulsa «Aplicar mis filtros» (vuelve a lo guardado; el botón queda «Mis filtros aplicados»). Activa «Aplicar mis filtros al abrir», cambia otros filtros, recarga: debe abrir con los guardados. Prueba «Quitar». Mira claro/oscuro, escritorio y 375 px.

## Mejoras de diseño y experiencia — 4: estado de las fuentes (20-nov-2026)

### Qué se hizo
- Botón **«Fuentes»** en la cabecera del buscador que abre un panel (Drawer de shadcn; lateral en pantallas anchas, desde abajo en el móvil) con las 7 fuentes agrupadas: Get on Board, Empresas con tablero público, Chiletrabajos, Trabajando.cl, Remotive, Jobicy y Himalayas. Cada fila muestra su estado (Al día / Con incidencias / Atrasada / En pausa / Sin lecturas), el tipo y cuántas ofertas activas aporta.
- Al tocar una fuente: estado, ofertas activas, última lectura con éxito, **historial de 30 días** («Extrajo 16 ofertas · 3 nuevas, 13 actualizadas» con fecha y hora; o «La fuente bloqueó la lectura»), y para «Empresas» el desglose por empresa.
- `GET /api/sources/status` (público, cacheable 60 s; `lib/sources/status.ts`): **los errores técnicos nunca se muestran** (se traducen a mensajes simples). El historial se purga a los 30 días en cada corrida de sincronización.
- Contenedor: GlassPanel (5.º uso aprobado) aplicado al panel; entrada de las filas con fundido de 150 ms y cambio lista↔detalle con deslizamiento de 200 ms (sin movimiento si se pidió reducirlo).

### Qué se verificó
- lint, tsc, build y 547 pruebas en verde (nueva `tests/sources-status.test.tsx`: traducción de errores —incluido que una cadena con contraseña no se filtra—, frases del historial, los 5 estados y el botón). Lectura real contra Supabase: 7 fuentes, todas «Al día», con 10 a 973 ofertas activas.

### Impacto en la app y la experiencia
- Transparencia: la persona ve de dónde salen las ofertas y si alguna fuente falla (sin tecnicismos), y sabe que las ofertas ya traídas siguen mientras no venzan.

### Para revisar por Juan
1. Reinicia `pnpm dev`. En `/ofertas` pulsa **Fuentes** (arriba a la derecha): lista de fuentes con estado y conteos; toca una → detalle e historial; vuelve con la flecha; cierra con deslizar/Escape. Mira claro/oscuro, escritorio (panel derecho) y 375 px (desde abajo).

### Ajuste de la mejora 4 tras la revisión de Juan (20-nov-2026)
- El panel ahora sigue el patrón **Responsive de shadcn**: ventana (Dialog) en escritorio y panel desde abajo (Drawer) en el móvil. Las fuentes son una **cuadrícula de tarjetas casi cuadradas** (shadcn `Item`, 4:3; 2 columnas en móvil, 3 en escritorio) que se desplaza dentro del panel cuando haya muchas.
- Cada tarjeta: tipo, estado, nombre, ofertas activas y cuántas son nuevas (llama). Al tocarla, la **ficha** suma datos nuevos de la base: qué es la fuente (una frase) y enlace «Visitar la fuente», ofertas activas, nuevas en 48 h, oferta más reciente, % de tecnología, % con salario publicado, % remotas, países principales y cargos que más trae; más el historial de 30 días (y el desglose por empresa en «Empresas»).
- Tablas: las fuentes **no tienen tabla propia** (son adaptadores en código; en la base solo están `source_companies` —directorio de empresas—, `sync_runs` —historial— y `jobs.source_key`). Los datos nuevos se calculan al vuelo con agregaciones sobre `jobs`. Propuesta pendiente de decisión: tabla `sources` (nombre, tipo, sitio, descripción, atribución, activa) para añadir fuentes sin tocar el código.

## Mejoras de diseño y experiencia — 5: microinteracciones (20-nov-2026)

### Qué se hizo
- **Lista de resultados** (`@formkit/auto-animate` 0.10.2, MIT, 2,5 M descargas/semana, sin dependencias, versión fija; alta en el lockfile de solo 8 líneas): las altas, bajas y cambios de orden se animan solos en 180 ms —al escribir en la búsqueda en vivo, al cambiar un filtro o al descartar una oferta («No me interesa»)—. La primera carga hace un fundido de 200 ms. Se retiró el escalonado por tarjeta de la mejora 2 (chocaba con esta animación).
- **Tarjeta de oferta**: al pasar el cursor sube 2 px (sin sombra) y vuelve al pulsarla; el marcador «guardada» aparece con un acercamiento de 200 ms.
- **Ficha de la oferta**: entra con un fundido y un desplazamiento mínimo (200 ms); al guardar, el marcador se rellena con un pequeño acercamiento.
- Ya existentes de las mejoras anteriores: llama de «Nueva» (300 ms), atenuación suave mientras carga (150 ms), botones de filtros guardados (150 ms), tarjetas del panel Fuentes (150 ms) y cambio lista↔ficha (200 ms).
- Todo respeta «reducir movimiento» (`motion-safe:` y el modo propio de auto-animate); ninguna animación pasa de 300 ms, sin rebotes; sin valores arbitrarios de Tailwind.

### Qué se verificó
- lint, tsc, build y 548 pruebas en verde.

### Impacto en la app y la experiencia
- La lista deja de «saltar» cuando cambian los resultados: lo que entra, sale o se reordena se desliza en un instante; guardar y abrir una oferta da respuesta táctil sin estorbar.

### Para revisar por Juan
1. Reinicia `pnpm dev`. En `/ofertas`: escribe en el buscador y mira cómo la lista se reacomoda; cambia Región/Modalidad/Orden; descarta una oferta («No me interesa» en su ficha) y vuelve; pasa el cursor y pulsa una tarjeta; guarda una oferta en su ficha. Con «reducir movimiento» activado en el sistema no debe moverse nada.

## Catálogo de fuentes — tabla `sources` (20-nov-2026)

### Qué se hizo
- **Tabla `sources`** (migración `0013`, ya aplicada en Supabase; RLS activa y sin permisos para anónimos): clave (el id de la fuente en la sincronización), nombre, tipo, sitio, descripción, **atribución** que piden los términos, **cadencia propia** (1–168 h o la del código), **interruptor «activa»** y fecha de la última revisión de términos. Sembrada con las 7 fuentes. El adaptador sigue en el código; la tabla manda sobre lo que se muestra y sobre dos mandos de operación.
- La sincronización lee el catálogo en cada corrida: una fuente **pausada se omite** (y nunca se marca «atrasada»); la cadencia propia manda sobre la del código; sin tabla o sin fila todo sigue como antes (valores del código).
- El panel público «Fuentes» toma nombre, descripción, sitio y atribución del catálogo, y muestra «Pausada» para las pausadas.
- En `/admin/ofertas` → «Sincronización automática», cada fuente tiene un **interruptor para pausarla o reanudarla** (`PATCH /api/sources/catalog`, solo administrador; también acepta la cadencia).

### Qué se verificó
- lint, tsc, build y 554 pruebas en verde (nueva `tests/sources-catalog.test.ts` con una base PGlite que aplica la migración: siembra de las 7 fuentes, pausar/reanudar, rango de cadencia, cadencia efectiva, estado «off» y RLS activa). `pnpm sync --check` contra Supabase funciona con el catálogo.

### Impacto en la app y la experiencia
- Se puede pausar una fuente que moleste o falle sin publicar código, y añadir una fuente nueva es una fila más (más su adaptador). Cada fuente muestra la atribución que exigen sus términos.

### Para revisar por Juan
1. `/admin/ofertas`: interruptor junto a cada fuente (pausa/reanuda; avisa con un toast). En `/ofertas` → Fuentes: una pausada aparece como «Pausada», y en su ficha se ve el texto de atribución.
2. Siguiente aprobado: tabla `source_daily_stats` (foto diaria por fuente).

## Foto diaria por fuente — tabla `source_daily_stats` (20-nov-2026)

### Qué se hizo
- **Tabla `source_daily_stats`** (migración `0014`, aplicada en Supabase; RLS activa, sin permisos para anónimos): una fila por día (UTC) y fuente con ofertas activas, de tecnología, con salario, remotas, **completas** (≥ 2 elementos entre requisitos, deseables y tareas), edad media en días y las lecturas del día (cuántas, cuántas con éxito, ofertas leídas, nuevas y cerradas). Sin datos personales; se conserva 400 días.
- `lib/sources/snapshots.ts`: `snapshotSourceStats` (idempotente: cada corrida sobrescribe la fila del día; la última lectura queda como la foto) se ejecuta al final de la fase `fetch` de la sincronización (GitHub y Mac). `activeTrend` devuelve la evolución de 30 días.
- Ficha pública de cada fuente («Fuentes»): una **gráfica de tendencia** de ofertas activas (shadcn Chart; aparece cuando hay ≥ 3 días de fotos) con «De X a Y (+Z) desde el …».

### Qué se verificó
- lint, tsc, build y 557 pruebas en verde (nueva `tests/source-snapshots.test.ts` sobre PGlite con una tabla `jobs` mínima: agrupa las empresas de los 7 sistemas en «companies», cuenta tecnología/salario/remotas/completas, ignora cerradas, toma las lecturas del día de `sync_runs`, no duplica al repetir y limita la ventana de la tendencia).
- Foto real contra Supabase (7 fuentes), p. ej. Get on Board: 973 activas, 713 de tecnología, 897 completas, edad media 81 días; Himalayas: 366 activas, 275 completas, edad media 1,3 días.

### Impacto en la app y la experiencia
- Desde hoy se acumula historia: en unos días la ficha de cada fuente mostrará su tendencia, y el negocio podrá comparar calidad (frescura, % completas, % con salario) y rendimiento de cada fuente; siguiente paso posible: cruzar con eventos de abrir/postular (solo «Para todos», k ≥ 5).

### Para revisar por Juan
1. Reinicia `pnpm dev`. La gráfica de tendencia aparecerá en la ficha de las fuentes a partir del tercer día de fotos (hoy hay una); no hay nada nuevo que ver hasta entonces salvo que todo siga funcionando.
2. Dato curioso a mirar: Get on Board solo publica salario en 1 de 973 ofertas; Chiletrabajos en 0 de 129.

## Ajuste de UI: pantalla de búsqueda más limpia, hojas de tamaño fijo y color principal blanco (20-nov-2026)

### Qué se hizo
- **Cabecera como la de inicio**: marca a la izquierda y acciones a la derecha, a todo el ancho y pegadas arriba. Las acciones son íconos: **Subir mi CV** (con un punto cuando ya hay uno cargado), **Fuentes** y tema.
- **Pantalla de búsqueda limpia**: una barra de búsqueda centrada con el botón de **Filtros** dentro (con el número de filtros activos), una sola línea con lo que está activo («Tecnología · Latinoamérica · Híbrido») y, debajo, solo las ofertas. Se quitó el título, el subtítulo, el bloque del CV, los selects y los interruptores de la pantalla.
- **Hojas** (`components/jobs/responsive-sheet.tsx`): Filtros, Mi CV y Fuentes comparten **un tamaño fijo**: en escritorio, ventana de ancho 3xl y 3/4 de la altura; en móvil, panel inferior de 4/5 de la altura. La cabecera no se mueve y el contenido se desplaza. Filtros reúne Área, Región, Modalidad, Orden, «Solo con match», «Solo mis guardadas» y «Mis filtros» (guardar/aplicar/aplicar al abrir), con un botón «Ver ofertas».
- **Textos**: se quitaron las descripciones sobrantes (títulos de pantalla, explicaciones de los interruptores, frases largas del CV y de Fuentes).
- **Color principal blanco** (`app/globals.css`): en oscuro `--primary` es blanco (texto oscuro encima). En claro el principal es el casi negro neutro: un botón blanco sobre fondo blanco no se vería. También se neutralizaron los tonos morados de acento, anillo de foco y gráficas.

### Qué se verificó
- lint, tsc, build y 557 pruebas en verde (se actualizaron 2 pruebas por los textos nuevos).

### Para revisar por Juan
1. Reinicia `pnpm dev`. `/ofertas` en oscuro y claro, escritorio y 375 px: cabecera pegada arriba con íconos; barra centrada; botón de filtros con contador; abre Filtros, Mi CV y Fuentes y compara que midan lo mismo; el interruptor y los botones principales ahora son blancos en oscuro (casi negros en claro).

## Microinteracción: entrada de abajo hacia arriba entre vistas (20-nov-2026)

### Qué se hizo
- Nuevo componente reutilizable `components/motion/rise.tsx` (`Rise`, con la librería `motion` ya instalada y las constantes de `lib/motion`): los elementos de una vista aparecen con un fundido mientras **suben 16 px**, en **0,42 s**, con la curva de desaceleración suave de toda la app y **70 ms de retardo entre un elemento y el siguiente**. Solo anima opacidad y desplazamiento; con «reducir movimiento» no anima.
- **Inicio (soltar CV)**: sube primero «1 de 5» y después el bloque de soltar/subiendo/leyendo/error (cada estado vuelve a subir al cambiar).
- **Búsqueda**: la cabecera queda fija (es el marco común de las dos vistas); suben la barra de búsqueda con su resumen y, después, el conteo con la lista de ofertas cuando llegan los resultados. Los cambios posteriores de la lista siguen con la animación de auto-animate (sin repetir la subida).

### Qué se verificó
- lint, tsc, build y 559 pruebas en verde (nueva `tests/rise.test.tsx`: arranca invisible y desplazado, y respeta los límites de duración, recorrido y retardo).

### Para revisar por Juan
1. Reinicia `pnpm dev`. Ve de inicio a `/ofertas` (ícono de buscar) y de vuelta (logo): los elementos deben subir suave y escalonados, sin saltos; la cabecera no se mueve. Con «reducir movimiento» activado no debe moverse nada.

## Portada del buscador y distintivo «Ofertas encontradas» (20-nov-2026)

### Qué se hizo
- **Buscador 20 % más grande** (definido): escritorio hasta `max-w-2xl` (672 px, antes 576) y altura `h-13` (52 px, antes 44), texto `text-base`, ícono `size-5`; móvil: todo el ancho útil (`px-4`) con la misma altura de 52 px.
- **Título y subtítulo** sobre la barra («Tu próximo trabajo, más cerca» / «Juntamos ofertas de muchas empresas y portales en un solo lugar, las actualizamos varias veces al día y te mostramos cómo postular a cada una.»): `text-3xl` en móvil y `text-4xl` desde `sm`, peso 500 (excepción tipográfica anotada en `CLAUDE.md`). El bloque título + subtítulo + barra queda **centrado verticalmente en la primera pantalla** (cabecera superpuesta arriba); los resultados quedan debajo. Al escribir la primera letra la página sube suave hasta dejar la barra arriba con los resultados a la vista.
- **Distintivo inferior «N Ofertas encontradas»**: fijo, centrado y cerca del borde inferior; el número es el **total de ofertas que cumplen lo que se ve** (filtros + texto), no solo las 30 de la página (el conteo sale de la base: `total` en la API). Ya no se muestra el conteo dentro de la lista. Efectos (`components/magic/*`, excepción documentada en `CLAUDE.md`): **haz de luz** que recorre el borde una vuelta cada 6 s con el color principal del tema (`BeamBadge`) y **dígitos que giran en tambor 3D con un rebote corto** al cambiar (`DrumNumber`, «number pop-in» de transitions.dev: solo gira el dígito que cambia). Con «reducir movimiento» queda el borde tenue y el número cambia sin animar; el lector de pantalla oye el número completo una vez. Miles con punto (1.450).
- Totales reales de hoy contra Supabase: tecnología en Latinoamérica 1.511; todas las áreas 2.625; solo híbrido 536; «diseñador» 10; sin coincidencias 0.

### Qué se verificó
- lint, tsc, build y 562 pruebas en verde (nuevas: formato de miles, número anunciado una vez, el total viaja en la API).

### Para revisar por Juan
1. Reinicia `pnpm dev`. `/ofertas` en escritorio y 375 px: título, subtítulo y barra centrados en la pantalla; el distintivo inferior con el haz; al escribir, el número gira dígito a dígito; cambia un filtro y mira el número; claro/oscuro.
2. Decisión pendiente: hoy en el estado inicial el número es el de las ofertas que cumplen los filtros por defecto (Tecnología + tu región: 1.511 en LATAM). Si prefieres el total de TODA la plataforma (2.625+) hasta que alguien busque o filtre, es un cambio pequeño.

### Ajuste de la portada del buscador tras la revisión de Juan (20-nov-2026)
- Las ofertas **no se ocultan**: la portada ya no ocupa toda la primera pantalla. Título, subtítulo y barra bajan hacia el centro (`pt-28` en móvil, `pt-40` desde `sm`) y las tarjetas empiezan justo debajo, visibles desde el inicio y con el mismo diseño de antes. Se quitó el desplazamiento automático al escribir (ya no hace falta). El distintivo inferior sigue fijo sobre el borde de abajo.

### Ajuste del cambio de número (20-nov-2026)
- Los dígitos del distintivo ya no rebotan: entran desde abajo desenfocándose hasta quedar nítidos y el anterior sale hacia arriba difuminándose, con una sola curva de desaceleración suave (0,5 s de entrada y 0,32 s de salida), un giro de tambor leve (35°) y 35 ms de retardo entre dígitos, de derecha a izquierda. Sin movimiento si se pidió reducirlo.

### Ajuste de la tipografía de portada y tokens documentados (20-nov-2026)
- Título y subtítulo de la portada más pequeños, más juntos y con menos interletraje, definidos como **tokens documentados** en `docs/DESIGN-TOKENS.md` y usados desde `lib/design-tokens.ts` (`token("hero-title" | "hero-subtitle" | "hero-stack")`): título 24 px (móvil) / 30 px (≥ `sm`) con −0,05 em; subtítulo 14 px con −0,025 em; 6 px entre ambos (antes 12). Una prueba (`tests/design-tokens.test.ts`) falla si el código y el documento no coinciden o si algún token trae valores arbitrarios.

## Ficha de la oferta alineada con el nuevo diseño (20-nov-2026)

### Qué se hizo
- **Cabecera como la de inicio y búsqueda** (`components/jobs/job-detail.tsx`): a todo el ancho y pegada arriba; a la izquierda, flecha para volver a los resultados y la marca; a la derecha, íconos: **guardar** (el marcador se rellena con un pequeño acercamiento), **compartir** y tema. Los íconos son botones cuadrados de esquinas redondeadas.
- **Entrada de abajo hacia arriba** (`Rise`): primero título y empresa; después datos clave y cómo se postula; después encaje, habilidades, listas y fuente; con la misma curva y 70 ms de retardo que el resto de la app.
- **Menos texto**: «Adaptar mi CV» (antes «… a esta oferta»), «Estimado con reglas, sin IA.», «Tu CV no muestra: …» / «Tu CV cubre lo que pide.», «Fuente: … · ver publicación original». «Guardar» salió de la fila inferior (ahora está en la cabecera); abajo quedan «No me interesa» y Privacidad. La barra inferior con **Postular** y **Adaptar mi CV** sigue fija y visible.

### Qué se verificó
- lint, tsc, build y 565 pruebas en verde.

### Para revisar por Juan
1. Reinicia `pnpm dev`. Abre una oferta desde `/ofertas`: cabecera pegada arriba con flecha + marca y los íconos guardar/compartir/tema; los bloques suben escalonados; guarda la oferta (marcador relleno) y vuelve con la flecha; claro/oscuro, escritorio y 375 px (la barra Postular/Adaptar debe seguir abajo).

### Número inicial del distintivo: total de toda la plataforma (20-nov-2026)
- Mientras la persona no escriba nada ni cambie un filtro, el distintivo muestra el **total de ofertas activas de toda la plataforma** (hoy 2.625; `GET /api/jobs/count`, público, cacheable 60 s). En cuanto busca o cambia un filtro, pasa al total de lo que ve (con el efecto de tambor). Los filtros que se aplican solos al abrir (los guardados en «Aplicar al abrir») no cuentan como «tocados». Si el conteo falla, usa el de la lista.

## Cargadores con frases dinámicas en lugar de esqueletos (20-nov-2026)

### Qué se hizo
- Nuevo `LoadingState` (`components/ai/loading-state.tsx`): la **matriz de puntos de referencia** (nuevo tamaño `lg` de `MatrixLoader`: 6 px por punto y 4 px de separación ≈ 36 px, puntos casi cuadrados) y debajo una **frase que cambia sola cada 2,4 s** para contar qué hace la plataforma. La frase entra desde abajo desenfocándose hasta quedar nítida y la anterior sale hacia arriba difuminándose: **la misma animación (movimiento + desenfoque) del número de «Ofertas encontradas»**, con las constantes de `lib/motion` (0,5 s de entrada y 0,28 s de salida).
- **Se quitaron todos los esqueletos** del buscador: resultados (`Buscando entre las ofertas… / Revisando las fuentes más recientes… / Ordenando los resultados… / Preparando las tarjetas…`), ficha de la oferta (`Abriendo la oferta… / Leyendo los requisitos… / Preparando cómo postular…`) y panel Fuentes (`Revisando el estado de cada fuente… / Contando las ofertas activas… / Mirando el historial de lecturas…`). Al buscar de nuevo con resultados a la vista, la lista se atenúa suave (sin cargador) para no parpadear.
- Con «reducir movimiento»: puntos quietos y frases sin animar. Lectores de pantalla: se oye solo la primera frase, una vez.

### Qué se verificó
- lint, tsc, build y 570 pruebas en verde (nueva `tests/loading-state.test.tsx`; las reglas de movimiento de `components/ai` siguen pasando: solo opacidad, desplazamiento y desenfoque, sin escalas ni duraciones sueltas).

### Para revisar por Juan
1. Reinicia `pnpm dev`. Recarga `/ofertas` (cargador con frases en el área de resultados), abre una oferta (cargador a pantalla completa) y el panel Fuentes. Mira el tamaño de la matriz frente al de transitions.dev; si lo quieres más grande o más chico, es el tamaño `lg` de `MatrixLoader`.

### Ajuste de los cargadores: medidas y animación exactas de transitions.dev (20-nov-2026)
- Se leyó el código público de la página de referencia (la propia página invita a copiar su CSS/JS: «open a transition, copy the CSS … and paste it into your project»). El «Matrix dot loader» (P33) mide **14 px**: cuadrícula de **4×4 puntos de 2 px con 2 px de separación**, no los 36 px que yo había puesto. Su animación no es un fundido genérico: cada punto **pulsa de su color base al activo** en un ciclo compartido de **1,2 s** (activo al 15 %, de vuelta al 45 %) con un **retardo propio por punto**, y tiene cuatro caracteres: `scan` (barrido por columnas, 120 ms por columna), `twinkle` (destellos con un orden al azar fijo, 75 ms de paso), `orbit` (órbita por el perímetro sin esquinas, 150 ms de paso, centro quieto) y `pulse` (centro y luego borde, 192 ms).
- Nuevo `DotLoader` (`components/ai/dot-loader.tsx`) con esos valores exactos (constantes en `lib/motion.ts`: ciclo 1,2 s, opacidad base 0,2 y activa 0,65 sobre el color del texto del tema, que equivale al par de colores de la referencia en claro y oscuro). `LoadingState` lo usa (por defecto `twinkle`) y se quitó el tamaño `lg` que había añadido a `MatrixLoader` (la matriz de las pantallas de análisis queda como estaba).
- Verificado con pruebas: retardos idénticos a los de la referencia, 16 puntos, 4 variantes, 14 px y quietud con «reducir movimiento».

### Cargador y frases en línea (20-nov-2026)
- El cargador y su frase van **siempre en la misma línea** (el punto a la izquierda y la frase a su derecha, centrados verticalmente), en escritorio y en móvil. La frase tiene un ancho fijo (16 rem) alineada a la izquierda para que el conjunto no se mueva cuando cambia la frase.

### Ajustes de la carga de la búsqueda (20-nov-2026)
- **«Privacidad»** y el **distintivo «Ofertas encontradas»** ya no se ven mientras carga: aparecen solo cuando hay resultados a la vista, con movimiento + desenfoque (`BlurReveal`, `components/motion/blur-reveal.tsx`: sube desde abajo pasando de borroso a nítido; al ocultarse se difumina; mismas curvas y duraciones de `lib/motion`; sin animar con «reducir movimiento»).
- **Cargador con frases** de la búsqueda: alineado a la izquierda, donde empieza la barra de búsqueda (mismo ancho de 42 rem), y más cerca del contenido de arriba (menos margen).

### Hojas con carga: solo el cargador, centrado (20-nov-2026)
- **Fuentes**: mientras llega el estado, la hoja muestra únicamente el cargador con sus frases, centrado en vertical y horizontal (sin título ni «Revisando…»; el título queda para lectores de pantalla). **Mi CV**: mientras se lee el archivo, igual (las frases son el avance real de la lectura, con el mismo cambio de movimiento y desenfoque cuando cambia la etapa). Regla documentada en `docs/DESIGN-TOKENS.md` y en la memoria del proyecto.

### Distintivo más pequeño y con resplandor interior sutil (20-nov-2026)
- **15 % más pequeño** (texto `text-xs`, relleno `px-4 py-2`; antes `text-sm`, `px-5 py-2.5`: unos 14 % menos de ancho de texto y 20 % menos de alto).
- **Resplandor interior sutil** (`components/magic/beam-badge.tsx`), a partir de la descripción del «Get Pro button» de transitions.dev («gradient glows in from the pill's rim»): además del haz del borde, un resplandor difuminado y enmascarado que entra del borde hacia el centro (mismo giro de 6 s), de **un solo color** (el principal del tema, con 32 % de opacidad). *Nota:* esa transición figura como «Pro» en transitions.dev y su código no es público, así que **no se copió ni se intentó leer**: es una interpretación propia de su descripción.
- **El ancho del distintivo se anima** (300 ms con la curva de la app, idea de la transición «Card resize» que Juan compartió: `transition: width`) cuando el número cambia de largo (p. ej. 999 → 1.000). Con «reducir movimiento» cambia sin animar.
