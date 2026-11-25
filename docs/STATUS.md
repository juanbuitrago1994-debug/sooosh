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

### Haz de borde con la librería `border-beam` (20-nov-2026, autorizada por Juan)
- Se añadió **`border-beam` 1.4.1** (MIT, ≈ 635 000 descargas/semana, un mantenedor, sin dependencias, 99 KB; revisada: sin scripts de instalación, `eval`, red ni almacenamiento) fijada en versión exacta y registrada como aprobada en `CLAUDE.md`. Técnica que aprendimos de ella: degradado cónico con el ángulo animado por CSS `@property` y recortado con `mask-composite` para dejar solo el trazo del borde, más capas decorativas (trazo, resplandor interior y halo) sin clics, y un modo «respiración» (`pulse-inner`) para un brillo contenido que no gira.
- Nuevo **`Beam`** (`components/magic/beam.tsx`), reutilizable en otros componentes (Juan indicó que se usará más): envuelve a la librería con los valores de la app — **un solo color** (`mono`), intensidad 0,5 y el tema claro/oscuro de la app — y el estilo `size` elegible (`pulse-inner`, `sm`, `md`, `line`).
- El distintivo «Ofertas encontradas» usa **solo el resplandor interior que respira** (`pulse-inner`), sustituyendo el haz y el resplandor hechos a mano; conserva el ancho animado de 300 ms al cambiar de largo.

### Para revisar por Juan
1. Reinicia `pnpm dev` (la dependencia es nueva: `pnpm install` ya está hecho). Mira el distintivo de abajo en oscuro y claro; si el resplandor es mucho o poco, se ajusta con `strength` (hoy 0,5) en `Beam`.

### Compensación del tema claro en `Beam` (20-nov-2026)
- Los presets de `border-beam` son mucho más tenues en claro (en `pulse-inner`: borde 0,32 en claro frente a 1,54 en oscuro). `Beam` ahora usa por defecto una intensidad de **0,5 en oscuro y 1 en claro** (`beamStrength`, con prueba); si un componente pasa `strength`, manda ese valor.

### Variante de color del haz: `ice` en el distintivo (20-nov-2026)
- `Beam` acepta `colorVariant` (por defecto `mono`, gris). El distintivo «Ofertas encontradas» usa la paleta **`ice`** (cian y azul pálido) de `border-beam`. Volver a gris es cambiar esa palabra en `components/magic/beam-badge.tsx`. Nota: el azul en el modo oscuro es una excepción consciente a la regla de oscuro neutro (decisión de Juan para este efecto).

### Distintivo: `ice` fijo y pálido, y borde propio sin beam (20-nov-2026)
- **Causa del cambio de colores**: la librería hace girar el tono (`hue-rotate`, ~12 s) en todas las paletas excepto `mono`; por eso el `ice` pasaba por rosa y verde. Ahora el distintivo usa `staticColors` (sin ciclo de tono) y `saturation={0.4}` (poco saturado): solo grises fríos y azules pálidos.
- **Borde sin efecto beam y casi transparente**: la librería pinta su trazo de haz sobre el borde del elemento y no deja apagarlo. El distintivo dibuja encima un anillo de 1 px **opaco** del color «10 % del texto sobre el fondo» (se ve casi transparente, en claro y oscuro), así que el borde no lleva haz y solo queda el resplandor interior.

### Distintivo sin borde (20-nov-2026)
- Se quitó el borde del distintivo: el anillo de 1 px que tapa el trazo del haz de la librería ahora es del **mismo color que el fondo**, así no se ve ni borde ni haz de borde; solo queda el resplandor interior.
- El fondo del distintivo es ahora el token `card` (en oscuro, un gris ligeramente más claro que el fondo de la app: 0,21 frente a 0,182), no el mismo `background`; el anillo que tapa el trazo del haz usa ese mismo color.

### Diagnóstico de los «puntos de color» y bordes oscuros del distintivo (20-nov-2026)
- **No era percepción.** Dos causas reales: (1) el estilo `pulse-inner` de `border-beam` no es un resplandor uniforme: está hecho de **manchas de color (degradados radiales) ancladas al borde** —arriba a la izquierda, abajo a la izquierda, abajo a la derecha…— que pulsan; en `ice` son 5 tonos de cian/azul distintos, de ahí los «puntos de color»; (2) la librería no deja apagar su trazo de borde, y el anillo opaco que puse encima para taparlo dibujaba un **contorno oscuro** sobre el resplandor.
- **Cambio**: el distintivo ya no usa `border-beam`. Ahora es un fondo `card` sin borde con un **resplandor interior uniforme** (una sombra interior suave, del color del texto del tema) que **respira** (la opacidad sube y baja en 2,6 s con la curva de la app). Sin manchas, sin anillo, sin contorno oscuro. `Beam` y `border-beam` siguen disponibles para otros componentes (haz que viaja por el borde: `sm`/`md`).
- Otras posibilidades de movimiento para el distintivo, si esta no convence: un **destello suave que cruza** el distintivo cada pocos segundos, o un **punto de luz que recorre el borde** (haz `sm` de `Beam`, sin manchas de color en `mono`).

### Distintivo: vuelve el movimiento original del haz, ahora por dentro (20-nov-2026)
- El resplandor que respira no se parecía al movimiento que Juan había aprobado (la luz que **recorre el borde**). Se restauró ese movimiento —una vuelta cada 6 s, un arco de luz que gira— pero **por dentro del borde**: un arco difuminado de un solo color (el principal del tema, 55 % de opacidad con cola que se desvanece) dentro de una máscara radial que lo deja ver solo junto al borde. Sigue con fondo `card` sólido, **sin borde**, sin manchas de color y sin anillo; ancho animado y «reducir movimiento» (queda un resplandor interior quieto).

### Se descartan las dos luces; vuelve el haz que recorre el borde (20-nov-2026)
- Las dos luces de colores que recorrían el contorno (c4bf469) se descartaron por decisión de Juan («perdimos total enfoque del efecto beam») y el commit se revirtió: el distintivo vuelve al arco de luz de un solo color que da una vuelta cada 6 s por dentro del borde (fondo `card`, sin borde). Si se retoma la idea de dos colores, que sea **dentro del mismo haz** (un arco con degradado hielo → lila), no como dos luces separadas.

### Se descarta el destello diagonal; el distintivo queda con el haz que recorre el borde (20-nov-2026)
- El destello diagonal (244c487) se revirtió por decisión de Juan. **El distintivo queda con el arco de luz de un solo color que da una vuelta cada 6 s por dentro del borde** (fondo `card`, sin borde, ancho animado). Movimientos probados y descartados: resplandor que respira, manchas de `border-beam`, dos luces por el contorno y destello diagonal. Antes de probar otro, confirmar con Juan que realmente quiere cambiar.

### Distintivo: haz con dos colores fríos fundidos (20-nov-2026)
- Con el movimiento aprobado (arco de luz que recorre el borde por dentro, una vuelta cada 6 s), el haz ahora lleva **dos colores fríos que se funden entre sí a lo largo del arco**: la cola nace transparente, pasa por **azul hielo** (`beam-ice`) y termina en **lila pálido** (`beam-lilac`), con interpolación `in oklab` (sin cortes). Sigue siendo **un solo haz**, no dos luces. Colores como tokens documentados en `docs/DESIGN-TOKENS.md` (con prueba). Opacidad de los colores: 62 %.

### Distintivo en el tema claro: fondo grisáceo y haz rosa → naranja (20-nov-2026)
- **Tema claro**: el fondo del distintivo es un gris ligero (`muted`, 0,95 frente a 0,994 del fondo de la app) y el haz funde **rosa → naranja** (tokens `beam-rose` `oklch(0.76 0.15 8)` y `beam-orange` `oklch(0.78 0.15 55)`, documentados con prueba). **Tema oscuro**: sin cambios (fondo `card`, haz azul hielo → lila pálido). El movimiento no cambia. La prueba comprueba que cada tema usa su par de colores.

### Postulación P0: varias vías por oferta (20-nov-2026)
- `detectApply` ya no pierde vías: la principal sigue siendo la de siempre, y se suman en `apply.alt` (máx. 3) el **correo** de postulación y los **enlaces a formularios** (Google Forms, Microsoft Forms, Typeform, Tally, Jotform, sistemas de selección) que aparezcan en el texto. Un formulario en el texto sin otra pista pasa a ser la vía principal. Sin migración de base: `apply` ya era JSON.
- Ficha de oferta: bajo «Cómo se postula» aparece «También puedes postular así:» con un botón por vía alternativa (correo → `mailto:`, formulario → pestaña nueva).
- Editor del administrador: lista de «Otra vía» (correo o enlace) con «Quitar» y botones «Agregar otro correo / otro enlace».
- Verificado: lint (0 errores), `tsc`, `build` y 586 pruebas en verde (nuevas: oferta con correo + Google Form, desde un portal, solo formulario, sin duplicados, `mailto:`, y que las alternativas sobreviven al esquema de guardado).
- **Para revisar por Juan**: (1) en el editor de ofertas, pega el texto de la oferta de la diseñadora UX/UI y comprueba que aparecen el correo y el enlace del formulario; (2) abre esa oferta ya guardada: bajo «Cómo se postula» deben verse los botones alternativos (claro/oscuro, escritorio y 375 px); (3) una oferta con una sola vía no debe mostrar «También puedes postular así».

### Analizador A1: ninguna oferta incompleta queda invisible ni mal etiquetada (20-nov-2026)
- **Título honesto** (`lib/offer/identity.ts`): un encabezado de sección («🔹 Experiencia comprobable», «Requisitos:») o una frase de apertura ya no pasan por cargo. Si el texto no trae el cargo, se **deduce de la frase de apertura** («Estamos seleccionando diseñadora UX/UI…» → «Diseñadora UX/UI») y se marca **inferido**; si tampoco hay frase, queda **vacío**. En el editor, un título inferido pide **«Confirmar título»** y no se puede guardar hasta confirmarlo (escribirlo también lo confirma); vacío no se guarda.
- **Empresa**: se descarta si parece una frase de requisito o un encabezado. Sin empresa, la tarjeta y la ficha muestran **«Publicado en LinkedIn»** (o la fuente); una oferta manual sin fuente no muestra nada.
- **Región**: sin país ni región conocida, la tarjeta se guarda como **«Todas»** (`TODAS`) y el buscador la deja pasar en cualquier región (LATAM, un país o fuera de LATAM). En el editor hay una opción «Todas» y se puede cambiar.
- **Tecnología**: al guardar, la familia de cargo (y «tecnología») se recalcula siempre con el título y las habilidades **finales**; antes arrastraba la del título equivocado. El título se sincroniza también dentro de la oferta guardada.
- **Habilidades**: se filtran palabras sueltas que no lo son («Trabajo», «Systems»).
- Verificado: lint (0 errores), `tsc`, `build` y 595 pruebas en verde (nuevas: encabezados, cargo por frase de apertura, empresa, «Publicado en», la publicación de la diseñadora de punta a punta, filtro de región con «TODAS»).
- **Para revisar por Juan**: (1) en `/admin/ofertas` pega de nuevo el texto de la publicación de la diseñadora (con el enlace) y comprueba: título sugerido «Diseñadora UX/UI» con «Confirmar título», sin empresa inventada, región «Todas», habilidades sin «Trabajo»/«Systems», correo como otra vía; (2) confirma y pulsa «Actualizar tarjeta» (no se duplica); (3) busca «diseño de interfaces» con «Tecnología · Colombia» y comprueba que aparece, con «Publicado en LinkedIn» y solo los datos que trae (claro/oscuro, escritorio y 375 px).

### Analizador A2: revisión dato por dato (20-nov-2026)
- **Lista de verificación** («Dato por dato») sobre el formulario del editor de ofertas: 15 datos (cargo, empresa, ubicación, país, modalidad, contrato, nivel, experiencia, salario, idiomas, requisitos, funciones, se valora, cómo postular, región). Cada uno muestra su valor y su estado: **✓ está en el texto** (con la frase de la oferta de donde sale), **? deducido** (cargo por frase de apertura, país por ciudad, región «Todas»…: «Confirmar» o «Quitar») o **— la oferta no lo dice** («No indicado»). Lo que se cambia en el formulario aparece como «Editado por ti».
- **«Quitar»** deja el dato como «No indicado» (empresa, ubicación, país, modalidad, contrato, nivel, experiencia, salario, idiomas); el cargo, las listas, la postulación y la región se corrigen en el formulario.
- Las frases son deterministas: salen del propio texto con reglas (no del modelo), así nunca se cita algo que la oferta no dice. `lib/jobs/evidence.ts` (servidor) y `lib/jobs/field-values.ts` (compartido); `/api/jobs/analyze` devuelve `evidence` junto al borrador.
- De paso: el contrato «indefinido» («término indefinido») ahora se reconoce.
- Verificado: lint (0 errores), `tsc`, `build` y 598 pruebas en verde (nuevas: estado y frase por dato de la publicación de la diseñadora, frase corta y no párrafo, «Quitar»).
- **Para revisar por Juan**: en `/admin/ofertas`, pega la publicación de la diseñadora y mira «Dato por dato» sobre el formulario: cargo con «?» y su frase de apertura, empresa «No indicado», modalidad con la frase que dice «remoto», correo y formulario en «Cómo postular», región «Todas» con «?». Prueba «Confirmar» y «Quitar», y edita un campo en el formulario para ver «Editado por ti» (claro/oscuro, escritorio y 375 px).

### Analizador A3: pantalla de administración renovada (20-nov-2026)
- **Cabecera** igual a la del resto de la app (marca a la izquierda, «Volver a la app» y tema a la derecha, pegada a los bordes). La pantalla de la clave queda solo con el campo y el botón.
- **Cargar una oferta**: sin títulos ni párrafos de relleno; Enlace / Pegar texto, campos con pista dentro (placeholder) y «Analizar oferta».
- **Revisión en una hoja** (`ResponsiveSheet`, la misma de filtros, CV y fuentes: ventana en escritorio, panel inferior en móvil): mientras analiza muestra **solo el cargador centrado** (`LoadingState`, con frases «Leyendo la oferta…», «Verificando cada dato contra el texto…»); al terminar, «Dato por dato» + el formulario de corrección, con «Guardar/Actualizar» y «Descartar» fijos abajo. Cerrar la hoja cancela el análisis en curso. Se quitó el párrafo de conteos y las descripciones de relleno.
- **Tarjetas guardadas**: buscador por cargo o empresa (en el servidor, sin tildes), filtros **Todas / Incompletas / Ocultas**, contador real («100 de 2.627» en vez de un «100» engañoso) y «Falta: empresa, región…» en cada fila. `GET /api/jobs?q=&only=` + `countJobs`.
- Verificado: lint (0 errores; los 3 avisos que quedan ya existían), `tsc`, `build` y 601 pruebas en verde (nuevas: la lista pasa texto y filtro al servidor y devuelve el total; la pantalla de la clave sin textos de relleno).
- **Para revisar por Juan**: `/admin/ofertas` en claro/oscuro, escritorio y 375 px: (1) cabecera y pantalla de la clave; (2) pegar el texto de la oferta de la diseñadora → «Analizar»: solo el cargador centrado, luego la hoja con «Dato por dato» y el formulario, botones fijos abajo, cerrar con la X o «Descartar»; (3) el buscador y los tres filtros de «Tarjetas»; (4) el panel «Fuentes» de abajo no cambió.

### Analizador A4: bloques, conciliación y conjunto de prueba (20-nov-2026)
- **Segmentación por reglas** (`lib/offer/segment.ts`): el texto se separa en bloques (gancho, requisitos, funciones, se valora, beneficios, contacto, hashtags) usando los encabezados de la publicación («🔹 Requisitos», «Se valora: …», «What you bring»). Sin IA y cada línea sigue siendo literal.
- **Conciliación**: tras el modelo, cada línea va a la lista de su bloque, salen de las listas los encabezados, el contacto, los beneficios y los hashtags, y se agregan las líneas de las secciones que el modelo omitió. Se aplica en las dos rutas de `parseOfferText` (se puede desactivar con `{ reconcile: false }`, solo para medir).
- **Arreglos que salieron de medir**: los rótulos débiles («Experiencia», «Perfil») solo son encabezado si son toda la línea; encabezados en inglés; correo tras un enlace con puntos («or email …»); la limpieza recupera una línea suelta descartada entre dos conservadas.
- **Conjunto de prueba** (`bench/gold/offers.json`, 6 publicaciones con respuesta esperada) y banco `bench/offers-gold.test.ts` contra el Ollama real; resultados medidos en `docs/BENCHMARKS.md` (intrusos 4 → 0 de 32, recall 94 → 100 %, postulación 83 → 100 %; 12 muestras, conjunto de desarrollo con 5 casos escritos por nosotros).
- **No se añadió** una segunda pasada de verificación con el modelo (ver razones en BENCHMARKS.md); se reconsidera con publicaciones reales.
- Verificado: lint (0 errores), `tsc`, `build` y 612 pruebas en verde (nuevas: bloques, conciliación, encabezados débiles, hueco de una línea, correo tras enlace; dos pruebas existentes se ajustaron: la conciliación ahora completa las listas con las líneas de la sección que el modelo omitió).
- **Para revisar por Juan**: (1) pega de nuevo la publicación de la diseñadora en `/admin/ofertas`: «Funciones», «Requisitos» y «Se valora» deben traer cada línea en su lista, sin el correo, los beneficios ni los hashtags; (2) **pásame el texto de otras publicaciones reales que hayas guardado** (sobre todo las que salieron mal) para sumarlas al conjunto de prueba y medir con casos reales.

### Buscador que se quedaba cargando: diagnóstico y salvaguarda (20-nov-2026)
- **Causa medida** (no es el código de la búsqueda): el **pooler de transacciones de Supabase (puerto 6543)** quedó con sesiones atascadas (3 consultas «activas» esperando datos del cliente desde hacía > 4 min). Cualquier conexión que cae en una de ellas se cuelga: un guion aparte con 8 consultas simultáneas por el 6543 dio 2 de 8 correctas, luego 3 de 8 y luego 0 de 8; el **mismo guion por el modo sesión (puerto 5432) dio 8 de 8 en 0,7 s y 0,1 s**. Las consultas en sí son rápidas (búsqueda 3 ms y tendencias 0,2 ms en la base). Los registros de Postgres muestran «canceling statement due to statement timeout» y «unexpected EOF on client connection with an open transaction» en esa franja.
- **Salvaguarda (código)**: `withDbTimeout` (12 s) en `/api/search` y `/api/jobs/count`: si la base no responde, la API contesta un error en vez de colgarse; el buscador espera como máximo 20 s y muestra «La búsqueda está tardando demasiado…» con **Reintentar** (antes: cargador para siempre).
- **Pendiente de Juan** (la causa de fondo está en la conexión, no en el código): pasar `DATABASE_URL` al **modo sesión (puerto 5432)**, el recomendado para un servidor que vive mucho tiempo, o liberar las sesiones atascadas desde el panel de Supabase.
- Verificado: lint (0 errores), `tsc`, `build` y 615 pruebas en verde (nuevas: el límite de espera).

### Buscador colgado: causa encontrada y arreglada sin cambiar el puerto (20-nov-2026)
- **Causa**: `postgres.js` encadena por defecto hasta 100 consultas por conexión (*pipelining*) y el pooler de transacciones de Supabase (6543) deja colgadas las consultas encadenadas. No eran sesiones atascadas en Postgres (las que se vieron estaban inactivas y la limpieza no encontró nada que terminar): por eso **no se crea el cron de limpieza**, no habría arreglado nada.
- **Arreglo**: `max_pipeline: 1` (una consulta por conexión) en `lib/db/index.ts`. Medido: 5 de 80 → 80 de 80 consultas simultáneas (ver `docs/BENCHMARKS.md`); en la app, 10 búsquedas simultáneas responden en 0,8–1,8 s.
- **Red de seguridad** (`lib/db/resilient.ts`): las lecturas de la búsqueda, el contador, las tendencias y la ficha de oferta tienen límite de 4 s y, si se atascan, descartan las conexiones y reintentan una vez con unas nuevas. Contadores de «cada cuánto pasa»: `GET /api/db/health` (`timeouts`, `resets`, `recovered`, `failed`, `lastResetAt`; se reinician al arrancar el servidor).
- El buscador espera como máximo 20 s y, si algo falla, muestra el error con **Reintentar** (antes: cargador infinito).
- Verificado: lint (0 errores), `tsc`, `build` y 621 pruebas en verde (nuevas: la conexión usa `max_pipeline: 1`, el reintento recrea las conexiones, un error que no es de conexión no se reintenta).
- **Para revisar por Juan**: **reinicia `pnpm dev`** (para que tome la configuración), recarga `/ofertas` varias veces seguidas: deben aparecer resultados siempre. Abre `http://localhost:3000/api/db/health`: `resets` debe quedarse en 0; si sube, avísame.

### Carga del análisis en el distintivo y animación «scan» del cargador (20-nov-2026)
- **Admin de ofertas**: mientras se analiza una oferta ya no se abre la hoja; aparece **el mismo distintivo de «Ofertas encontradas»** (abajo, centrado, con la misma entrada con desenfoque) **sin el haz de luz** (`BeamBadge beam={false}`), con el cargador y frases cortas («Leyendo la oferta…», «Separando los datos…», «Verificando cada dato…») y una **X** para cancelar. Al terminar, el distintivo se oculta y se abre la hoja de revisión.
- **Cargador**: la animación por defecto pasa a ser la **primera de la página de transitions.dev** (`scan`, barrido por columnas, de la izquierda a la derecha) en toda la app (`DotLoader` y `LoadingState`); `twinkle` y las otras siguen disponibles con `variant`. `LoadingState` tiene versión `size="sm"` (texto `text-xs`, frase de 9 rem) para el distintivo.
- Verificado: lint (0 errores), `tsc`, `build` y 623 pruebas en verde (nuevas: el distintivo sin haz no dibuja la luz, el cargador pequeño usa `scan` y cabe).
- **Para revisar por Juan**: en `/admin/ofertas` pulsa «Analizar oferta»: debe aparecer abajo el distintivo con el cargador de barrido (puntos que se encienden de izquierda a derecha), sin haz, con la X; al terminar se abre la hoja. Mira también los otros cargadores de la app (buscador, fuentes, CV): ahora todos barren de izquierda a derecha (claro/oscuro, escritorio y 375 px).

### Analizador A5: limpieza conservadora y datos estructurados de LinkedIn (21-nov-2026)
- **Limpieza que no quita lo propio de la oferta** (`protectedLines`): la frase de apertura, las viñetas (guion, punto o emoji), los encabezados, las líneas de contacto y todo lo que cae dentro de una sección se conservan siempre; si quedan menos de 3 líneas dudosas, **no se llama al modelo** (más rápido y sin riesgo). Los comentarios de otras personas siguen siendo del modelo.
- **Empresa y fecha desde la página de LinkedIn**: en una publicación, el perfil que publica (autor `Organization`) es la empresa y la fecha de publicación es la real; si la publica una persona no se inventa empresa. La evidencia dice «Es el perfil que publica la oferta en LinkedIn».
- **«Nueva» = publicada en las últimas 48 h** (fecha de la fuente; si no trae, la de carga). Antes contaba desde que se guardó en Sooosh, y una oferta de hace 3 meses recién sincronizada salía «Nueva».
- Arreglos de paso: «crecimiento. ¿Qué buscamos?» ya no se acepta como empresa; «¿Qué buscamos?» al final de la frase de apertura abre la lista de requisitos; «Modalidad: Remoto» y similares no se cuentan como requisito ni función (ya tienen su campo); las viñetas de emoji («🔹») se quitan del texto de las listas.
- Medido (ver `docs/BENCHMARKS.md`): recall de las listas 86 → 100 %, 12 de 14 análisis sin llamar al modelo, 11,3 → 7,0 s por publicación; con la publicación real, por enlace y por texto salen el mismo cargo, los mismos 3 requisitos y el correo.
- Verificado: lint (0 errores), `tsc`, `build` y 633 pruebas en verde (nuevas: protección de líneas, datos estructurados de LinkedIn con y sin empresa, empresa de la página sobre la del texto, «Nueva» por fecha de publicación, requisitos tras «¿Qué buscamos?», viñetas de emoji).
- **Para revisar por Juan**: en `/admin/ofertas` analiza otra vez el **enlace** y luego el **texto pegado** de la publicación de Vos Consultora: por enlace deben salir empresa «Vos Consultora», cargo «Diseñador/a UX/UI» con «Confirmar», fecha de hace unas semanas (la tarjeta ya no debe decir «Nueva» ni «hoy»), 3 requisitos y el correo; pegado, lo mismo salvo empresa y fecha. **Pendiente de A5 (ideas 3 a 7)**: campo «Empresa» al pegar, reconocer `lnkd.in` y seguir sus enlaces, entrada única, aviso «Falta empresa» y prueba de paridad enlace/texto.

### Analizador A5 (ideas 3 a 7): empresa, encabezado, enlaces cortos, entrada única y paridad (21-nov-2026)
- **Empresa más estricta**: si el modelo devolvió la frase de apertura como título, la «empresa» que salió de partirla por «en» solo vale con mayúscula inicial (el resto del filtro ya estaba: sin «¿?», sin punto final, sin frases en minúscula).
- **Pegar texto con empresa**: la caja de texto acepta la **empresa o perfil que publica** (opcional); lo que escribe la persona manda sobre cualquier deducción y la evidencia dice «La escribiste tú». Si se pega también el **encabezado** de LinkedIn («Vos Consultora / 830 seguidores / 3 sem •»), se separa del texto: con «seguidores» es una página de empresa (esa es la empresa); si es una persona solo se sabe quién publicó, sin inventar empresa.
- **Enlaces `lnkd.in`**: ya cuentan como LinkedIn («Se aplica en LinkedIn», no «sitio de la empresa»); el enlace corto de la propia publicación se **sigue hasta la dirección real** (así no se duplica la tarjeta) y los del texto se siguen hasta su destino: en la publicación de Vos Consultora, `lnkd.in/d92iP43G` lleva a un Google Form y aparece como otra vía de postulación. Solo se siguen enlaces `lnkd.in`, con las mismas protecciones que al leer una oferta (direcciones públicas, redirecciones comprobadas una a una, 6 s de límite).
- **Entrada única** en `/admin/ofertas`: una caja; si lo pegado es un enlace se lee la página, si es texto se analiza (con los campos opcionales de empresa y enlace original, que solo aparecen al pegar texto). Sin pestañas.
- **«Falta la empresa»**: en la hoja de revisión, arriba, un campo para escribirla en el momento (no hay que buscarlo en el formulario).
- **Paridad enlace / texto** (`tests/offer-parity.test.ts`): la misma publicación leída desde la página y pegada como texto da la **misma tarjeta** (cargo, requisitos, habilidades, vías de postulación); solo difieren la empresa y la fecha, que el texto pegado no trae y la persona puede escribir o pegar con el encabezado.
- Verificado: lint (0 errores), `tsc`, `build` y 648 pruebas en verde (nuevas: caja única, encabezado pegado, enlaces cortos con y sin red, paridad, y la ruta `/api/jobs/analyze` completa con empresa escrita, encabezado, enlace corto del texto y enlace corto de la publicación).
- **Para revisar por Juan**: en `/admin/ofertas`: (1) pega SOLO el enlace del post: la caja se queda de 2 líneas y analiza la página; (2) pega el **texto** de la publicación: aparecen «Empresa o perfil que publica» y «Enlace original»; prueba con `https://lnkd.in/p/ekvnyVQn` como enlace original y con la empresa escrita; (3) en la revisión comprueba que sale el Google Form como otra vía y que, si falta la empresa, aparece «Falta la empresa» arriba; (4) pega el texto con el encabezado copiado desde LinkedIn (claro/oscuro, escritorio y 375 px).

### Ofertas «Seleccionadas por Sooosh» (21-nov-2026)
- **Sin migración**: la tabla de ofertas ya tenía `origin` (`manual` = cargada y revisada desde el panel; `feed` = traída por una fuente) y la fecha de carga (`created_at`). Se comprobó en la base: 3.173 `feed` y 2 `manual` (las dos que guardó Juan), así que no hizo falta rellenar nada.
- **Tarjeta**: las ofertas `manual` llevan bajo el cargo y la empresa una marca discreta con icono, **«Seleccionada por Sooosh»** (`CuratedTag`). Las de las fuentes automáticas no la llevan.
- **Ficha**: para esas ofertas, la marca y una línea con las fechas: **«Publicada el 29 oct 2026 · Agregada el 21 nov 2026»** (si la fuente no trae fecha de publicación, solo «Agregada el …»). Las fechas van en hora de Colombia para que no cambien entre el servidor y el navegador.
- A tener en cuenta: si el administrador guarda desde el panel una oferta que ya había traído una fuente automática (mismo enlace), esa oferta conserva su origen `feed` y no recibe la marca.
- Verificado: lint (0 errores), `tsc`, `build` y 650 pruebas en verde (nuevas: formato de fechas en hora de Colombia, y que la marca sale solo en `manual`).
- **Para revisar por Juan**: busca la oferta de Vos Consultora (claro/oscuro, escritorio y 375 px): en la tarjeta debe verse «Seleccionada por Sooosh» bajo el título; al abrirla, la marca y «Publicada el 29 oct 2026 · Agregada el …». Una oferta de las fuentes automáticas no debe mostrar nada de eso.

### Insignia rosa y filtro «Manuales» (21-nov-2026)
- **Insignia**: «Seleccionada por Sooosh» pasa de línea gris con icono a una **insignia rosa sólida** (`CuratedBadge`, en `components/magic/*` como excepción documentada en `CLAUDE.md`), con la forma y la tipografía del `Badge` de shadcn. Colores como tokens documentados en `docs/DESIGN-TOKENS.md`: `curated-bg` `oklch(0.80 0.15 5)` (fondo) y `curated-fg` `oklch(0.26 0.07 5)` (texto, rosa muy oscuro, buen contraste); iguales en claro y oscuro. Se ve en la tarjeta (bajo el cargo y la empresa) y en la ficha (con las fechas debajo).
- **Filtro «Manuales»** en la lista de tarjetas del panel (`/admin/ofertas`): Todas · **Manuales** · Incompletas · Ocultas. Trae solo las cargadas desde el panel (`origin = manual`), y funciona junto al buscador. `GET /api/jobs?only=manuales`.
- Verificado: lint (0 errores), `tsc`, `build` y 652 pruebas en verde (nuevas: el filtro llega al servidor y la insignia usa los colores documentados).
- **Para revisar por Juan**: (1) la oferta de Vos Consultora en la lista y en su ficha: insignia rosa, legible en claro y oscuro (escritorio y 375 px); si el rosa se ve muy fuerte o muy suave, se ajusta con el token `curated-bg`; (2) `/admin/ofertas` → «Manuales»: deben salir solo las que cargaste tú.

### Insignia «Curated by Sooosh» arriba del título (21-nov-2026)
- La insignia rosa se mueve **arriba del título** (tarjeta y ficha; en la ficha va junto a «Nueva», encima del título), un poco más pequeña (`h-4`, menos relleno) y con el texto **«Curated by Sooosh»** (en inglés por decisión de Juan; se escribe «Sooosh», como la marca de la app). Las fechas «Publicada el … · Agregada el …» siguen debajo del subtítulo en la ficha. Mismos colores (`curated-bg`, `curated-fg`).
- Verificado: lint (0 errores), `tsc`, `build` y 652 pruebas en verde.
- **Para revisar por Juan**: la oferta de Vos Consultora en la lista y en su ficha (claro/oscuro, escritorio y 375 px): la insignia arriba del título, algo más pequeña, con «Curated by Sooosh»; en la ficha junto a «Nueva» si aplica.

### Insignia «Curated by Sooosh» más discreta (21-nov-2026)
- La insignia pasa de un rosa sólido a una versión **mucho menos contrastante**: **más pequeña** (texto e icono de 10 px, altura de 14 px), de **esquinas semiredondas** (ya no es una píldora), con el **fondo rosa al 14 % de opacidad** y el **texto y el icono rosas** (el rosa mezclado al 75 % con el color del texto del tema: rosa claro en oscuro y rosa profundo en claro, para que se lea en los dos).
- Tokens (`docs/DESIGN-TOKENS.md`, con prueba): `curated-pink` `oklch(0.72 0.17 5)` y `curated-size` `0.625rem` (reemplazan a `curated-bg` y `curated-fg`). Sigue arriba del título, en la tarjeta y en la ficha.
- Verificado: lint (0 errores), `tsc`, `build` y las pruebas en verde.
- **Para revisar por Juan**: la oferta de Vos Consultora en la lista y en su ficha (claro y oscuro, escritorio y 375 px): ¿se lee bien el texto de 10 px? Si el rosa se ve flojo o fuerte, se ajusta con la opacidad (14 %) o con `curated-pink`; si el texto es muy chico, con `curated-size`.

### Insignia «Curated by Sooosh»: esquinas semiredondas, relleno uniforme e icono sólido (21-nov-2026)
- **Esquinas**: antes parecía una píldora porque el radio de la app es grande (`rounded-md` = 11 px y la insignia mide 14 px de alto). Ahora el radio es el 30 % del radio de la app (≈ 4 px): un rectángulo de esquinas suaves.
- **Relleno**: el `Badge` de shadcn le sumaba más relleno del lado del icono; ahora es **el mismo en los cuatro lados** (3 px) y el espacio entre icono y texto es igual a ese relleno.
- **Icono sólido**: círculo relleno con la marca de verificación recortada (trazado de Heroicons «check-circle» sólido, licencia MIT), del mismo rosa que el texto.
- Verificado: lint (0 errores), `tsc`, `build` y las pruebas en verde (la prueba comprueba radio, relleno uniforme sin lados sueltos e icono con relleno).
- **Para revisar por Juan**: la insignia en la lista y en la ficha (claro y oscuro, escritorio y 375 px): esquinas suaves, aire parejo alrededor, icono sólido. Si quieres otra forma de icono (sello, escudo), se cambia solo el trazado.

### Insignia con manos y filtro «Solo seleccionadas por Sooosh» en el buscador (21-nov-2026)
- **Insignia «Curated by Sooosh»**: esquinas **un poco más suaves** (radio del 45 % del radio de la app, ≈ 6 px; antes 30 %) y el icono pasa a ser **dos manos que se estrechan** (`HandshakeIcon` de lucide, de contorno) en el mismo rosa que el texto: «escogida a mano».
- **Filtro público**: en la hoja de filtros del buscador, el interruptor **«Solo seleccionadas por Sooosh»** (arriba de «Solo mis guardadas»). Trae solo las ofertas cargadas y revisadas desde el panel (`origin = manual`), junto al resto de filtros (región, área, texto…). Aparece en el resumen bajo la barra («Seleccionadas por Sooosh») y cuenta como filtro activo. No se guarda en «filtros guardados» (como «Solo mis guardadas», vale para la sesión). API: `curated` en `POST /api/search`.
- Verificado: lint (0 errores), `tsc`, `build` y las pruebas en verde (nuevas: el filtro llega a la búsqueda, la hoja lo ofrece, la insignia usa el nuevo radio y el icono de manos).
- **Para revisar por Juan**: (1) la insignia en la lista y en la ficha (claro/oscuro, escritorio y 375 px): esquinas algo más suaves e icono de manos; (2) en `/ofertas` abre los filtros, activa «Solo seleccionadas por Sooosh»: deben quedar solo las tuyas (con «Tecnología · Colombia» salen las que sean de tecnología; si no sale alguna, prueba «Todas las áreas»).

### Fase P0.5 · S1: mejor detección del correo de postulación (21-nov-2026)
- Nuevo `lib/jobs/emails.ts` (`detectEmails`, sin IA): hasta 3 correos por oferta, el más probable primero, con puntaje por verbo de postulación cerca, palabras de CV/candidatos y nombre del buzón (`rrhh`, `talento`, `cv`…). Ahora también se detectan correos **sin verbo** («Hoja de vida a: x@y.com»), **antes del verbo**, **ofuscados** («x [at] y [dot] com», «x arroba y punto com») y **segundos correos**. Se descartan `no-reply`, imágenes y duplicados; con varios correos se exige alguna señal, y un correo único se acepta aunque no tenga pistas.
- `detectApply` guarda `apply.emails` (JSON, sin migración) y `emailsOf()` cae a las vías de las ofertas guardadas antes. La vía principal no cambia: solo un correo con verbo de postulación manda sobre el enlace de la oferta; uno suelto queda como alternativa.
- `CLAUDE.md`: el panel del asistente de correo se suma a la lista cerrada de `GlassPanel` (6.º uso). Plan actualizado: siempre de «tú».
- Verificado: lint (0 errores; 3 avisos ya existentes en `wizard.tsx` y `shots-loader.mjs`), `tsc`, `build` y `pnpm test` (70 archivos, 666 pruebas) en verde. Pruebas nuevas en `tests/job-emails.test.ts`.
- **Para revisar por Juan**: no hay cambios visibles todavía. Las ofertas ya guardadas no tienen `apply.emails` hasta que se vuelvan a analizar (la ficha sigue igual). Siguiente: S2 (detectar el asunto que pide la oferta).

### Fase P0.5 · S2: asunto que pide la oferta (21-nov-2026)
- Nuevo `lib/jobs/subject.ts` (`detectSubject`, sin IA): reconoce «con el asunto "X"», «asunto: X», «subject: X», «'X' como asunto» y códigos de referencia («incluye la referencia DIS-2026 en el asunto»). Es conservador: una simple instrucción («indica el cargo en el asunto», «Asunto: tu nombre») **no** da asunto; mejor vacío que equivocado. Máximo 100 caracteres.
- `detectApply` guarda `apply.subject` (JSON, sin migración) solo si hay correo y la oferta pide el asunto. `fillSubject()` rellena marcadores como «[Tu nombre]» o «{cargo}» con datos reales y, si falta el dato, deja el marcador y avisa (`pending`); la usará el paso 2 del panel.
- Editor del administrador: al haber un correo aparece **«Asunto que pide la oferta (si lo dice)»**, editable y vacío si no aplica. Además `syncEmails` mantiene `apply.emails` al día cuando se cambia o quita un correo (lo quitado sale, lo nuevo entra primero).
- Verificado: lint (0 errores; los 3 avisos ya existentes), `tsc`, `build` y `pnpm test` (71 archivos, 684 pruebas) en verde. Pruebas nuevas: `tests/job-subject.test.ts` y las de `syncEmails`.
- **Para revisar por Juan**: en el panel de administrador, al analizar una oferta con correo (p. ej. pega un texto con «envía tu CV a rrhh@acme.com con el asunto "Diseñador UX"»), el campo «Asunto que pide la oferta» debe salir prellenado; con una oferta sin asunto, vacío (claro/oscuro, escritorio y 375 px). Las ofertas ya guardadas no tienen asunto hasta que se reanalicen. Siguiente: S3 (panel lateral con los pasos 1, 2 y 4).

### Fase P0.5 · S3: panel lateral «Postular por correo» (21-nov-2026)
- **Panel** (`components/jobs/apply-email-panel.tsx`): Drawer de shadcn por el costado derecho (pantalla completa en móvil, `max-w-md` desde `sm`), fondo semitransparente con blur con los tokens del tema. Barra `Progress` y los 4 pasos abajo, con «Atrás / Siguiente».
  1. **Destinatario**: casillas con los correos de la oferta (`apply.emails`; el más probable ya marcado). 2. **Asunto**: el que pide la oferta o «Postulación: {cargo} – {nombre}», editable. 3. **Cuerpo**: la plantilla base, editable en un `Textarea`, con «Incluir mi portafolio o web» (solo habilitado si el CV trae un enlace que no sea LinkedIn) y «Volver al texto base». 4. **Listo**: Para / Asunto / Cuerpo, cada uno con «Copiar» (toast) y «Descargar mi CV (PDF)». No se adjunta nada en la app.
  - Sin CV en el perfil de búsqueda: vacío «Primero carga tu CV» con enlace al buscador (no se inventan datos).
- **Plantilla** (`lib/apply/email.ts`, pura): el cuerpo usa solo el CV y la oferta; las coincidencias (máx. 3) salen de «lo que tu CV cubre» (`/fit`) y se omiten si son menos de 2; sin empresa/teléfono/correo/portafolio, esa línea desaparece; nunca queda un `{campo}`; siempre de «tú».
- **Ficha**: «Postular por correo» (botón principal) y «Por correo a …» (alternativa) abren el panel en vez de `mailto:`. El paso 3 usa la plantilla fija; la IA local (3 propuestas y ajustes) llega en S4.
- Verificado: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` (73 archivos, 694 pruebas) en verde. Pruebas nuevas: `tests/apply-email.test.ts` (plantilla: ningún dato fuera del CV/oferta) y `tests/apply-email-panel.test.tsx` (paso 1, progreso y vacío sin CV). No se probaron en pantalla los cambios entre pasos ni el aspecto visual (la auditoría visual es tuya).
- **Para revisar por Juan** (claro/oscuro, escritorio y 375 px; hace falta un CV en el perfil de búsqueda y una oferta con correo guardada con S1, p. ej. reanalizar la de Vos Consultora): (1) en la ficha, «Por correo a candidatos@…» abre el panel por la derecha; (2) recorrer los 4 pasos, probar el interruptor de portafolio y «Copiar» en el paso 4; (3) «Descargar mi CV (PDF)»; (4) sin CV, el vacío del panel; (5) sin scroll horizontal. Pendiente de tu decisión: «Descargar mi CV» baja el CV del perfil, no el adaptado a la oferta.

### P0.5 · S3 (ajuste): varios correos y agregar uno a mano (21-nov-2026)
- **Detección**: hasta **5** correos por oferta (antes 3). Una lista de direcciones tras un verbo de postulación («envía tu CV a rrhh@…, ana@… o luis@…», o con viñetas en líneas seguidas) se toma completa: los correos sin pistas que aparecen hasta 160 caracteres **después** de uno con verbo cuentan como alternativas. Correos anteriores, lejanos o de otro tema («Prensa: …») siguen fuera.
- **Panel, paso 1**: debajo de la lista, **«Agregar otro correo»** (campo con validación, Enter o botón «Agregar»; sin duplicados; hasta 10). El agregado queda marcado y se puede quitar con la X. En el paso 4 los destinatarios salen en el orden de la lista.
- Las ofertas ya guardadas con un solo correo no ganan los otros hasta reanalizarse (la de Vos Consultora trae uno solo en su texto).
- Verificado: lint (0 errores), `tsc`, `build` y `pnpm test` (73 archivos, 697 pruebas) en verde.
- **Para revisar por Juan**: abre el panel en una oferta, en el paso 1 agrega un correo (uno inválido muestra el error; uno repetido también), quítalo con la X, y confirma en el paso 4 que «Para» trae los marcados. Claro/oscuro, escritorio y 375 px.

### P0.5 · S3 (ajustes de interfaz del panel de correo, 21-nov-2026)
- Panel flotante (12 px de margen, esquinas redondeadas); campo «Agregar otro correo» arriba de la lista (placeholder corto, botón «+» solo ícono); espaciado de drawers 24/8 px y anillo de foco de los campos hacia adentro (regla en `CLAUDE.md`); botones de solo ícono pequeños semiredondos.
- **Pasos del pie**: sin barra de progreso; lista vertical que se revela de a uno. Cada paso lleva marca (círculo vacío si es el actual, gris con check si ya se superó; mismo componente de 18 px y borde fino), título y descripción, ambos en `text-xs`. Movimiento con `motion`: entran y salen plegando la altura con fundido, con las duraciones de `MOTION` (entrada 0,5 s, salida 0,42 s) y curva suave sin rebote; el color de la marca y del texto cambia en 0,5 s. Con «reducir movimiento» no anima.
- Nota: las reglas de `CLAUDE.md` piden duraciones cortas (≤ 300 ms); aquí Juan pidió expresamente un movimiento más lento y fluido (21-nov-2026) y se usan las constantes de `lib/motion.ts` (≈ 0,4–0,5 s).
- **Para revisar por Juan**: avanzar y volver atrás por los 4 pasos (claro/oscuro, escritorio y 375 px): fluidez al revelar y plegar, y que el pie de 4 pasos no ocupe demasiado alto en móvil.

### P0.5 · S3 (ajuste): botón «Pedir otro asunto» con IA local (21-nov-2026)
- **Panel, paso 2**: al lado del campo del asunto, un botón de solo ícono (✦) para pedir otro asunto. Mientras la IA piensa muestra el cargador de puntos **`orbit`** (el único de `DotLoader` que no se usaba; el resto de la app usa `scan`), el botón queda deshabilitado (`aria-busy`) y el campo se atenúa. Si la oferta **pide** un asunto, el botón no aparece (manda la oferta). Si se cierra el panel, la petición se cancela.
- **`POST /api/email/subject`** (`lib/apply/subject-ai.ts`): recibe solo cargo, empresa, nombre y los asuntos ya mostrados (no el CV). Ollama local propone un asunto (temperatura 0,8, respuesta corta); un **verificador por reglas** acepta solo palabras del cargo, la empresa, el nombre o un vocabulario de postulación (nada de herramientas, años o cifras inventados; sin correos, enlaces ni emojis; 8–90 caracteres). Si Ollama no responde, el asunto no pasa la verificación o se repite, se usa la **siguiente variante de plantilla** (6 variantes; el dato que falta se omite). El botón siempre devuelve algo y nunca repite un asunto ya visto.
- `getProvider(config?)` acepta ajustes (temperatura) sin cambiar el punto único de elección del proveedor.
- Medido contra el Ollama local: 7,5 s la primera llamada (modelo en frío) y 2,2 s la segunda (`docs/BENCHMARKS.md`; solo 2 muestras).
- Verificado: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` (75 archivos, 709 pruebas) en verde. Pruebas nuevas: `tests/subject-ai.test.ts` (verificador, plantillas, caída a plantilla, sin repetidos) y `tests/email-subject-route.test.ts`.
- **Para revisar por Juan**: en una oferta sin asunto pedido, paso 2: pulsa el botón varias veces (claro/oscuro, escritorio y 375 px): el cargador `orbit` mientras piensa, el asunto cambia y la ayuda dice «Sugerido con IA local» o «Otra variante de plantilla». Con Ollama apagado debe seguir cambiando entre plantillas.

### P0.5 · S4: cuerpo con propuestas de IA local, ajustes y portafolio (21-nov-2026)
- **Cabecera dinámica**: el título y la descripción del panel cambian con el paso (con un fundido suave): «Elige el destinatario», «Escribe el asunto», «Redacta el cuerpo», «Copia tu correo».
- **Paso 3 (Cuerpo)** (`components/jobs/apply-email-body-step.tsx`, estado en `use-email-body.ts`): al llegar se piden solas **3 propuestas** a la IA local, **una petición por ángulo** (experiencia, habilidades, interés; o el enfoque elegido) para ir mostrando cada una cuando llega; flechas «‹ 2 de 4 ›» entre propuestas (la plantilla base y las nuevas); botón **«Pedir otras versiones»** (suma 3 más y no repite) con el cargador `orbit` mientras redacta; el texto de cada propuesta se puede editar. La IA escribe solo el párrafo central; saludo, enlaces, cierre y firma salen del CV de forma fija.
- **Ajustes de redacción** (plegable): **Longitud** (corto, medio, largo; se pide como número de frases), **Tono** (cercano, profesional, directo; siempre de tú) y **Enfoque** (variado, experiencia, habilidades, motivación). Se recuerdan en este navegador y se aplican a las próximas versiones.
- **Portafolio o web**: si el CV trae un enlace (que no sea LinkedIn), un interruptor lo incluye; si no, aparece un campo **«Tu portafolio o web»** (se completa con https://, valida y rechaza correos y esquemas raros) que se usa solo en ese correo y se puede quitar.
- **Sin inventar datos** (`lib/apply/body-ai.ts`): el modelo recibe una lista cerrada de hechos (titular, habilidades, cargos, idiomas, lo que el CV cubre y los requisitos). Un verificador descarta el texto con cifras, siglas o nombres propios que no estén en esos hechos, «años de experiencia» inventados, enlaces, correos, otro alfabeto, «vosotros», saludos o despedidas; `neutralize` corrige «la área» y «estoy entusiasmado con…». Si el modelo falla o no pasa la verificación, se usan plantillas con datos reales del CV (cargo reciente, coincidencias, titular).
- **Hallazgo de rendimiento** (`docs/BENCHMARKS.md`): el `numCtx` distinto del predeterminado hacía recargar el modelo en cada llamada; ahora las llamadas de asunto y cuerpo usan el contexto por defecto. Medido: la 1.ª propuesta llega a los ~21 s y las siguientes cada ~7–14 s (una corrida por fila; el modelo atiende de a una).
- Verificado: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` (77 archivos, 728 pruebas) en verde. Pruebas nuevas: `tests/body-ai.test.ts`, `tests/apply-email-body-step.test.tsx` y ampliaciones del panel.
- **Para revisar por Juan** (claro/oscuro, escritorio y 375 px): pasar al paso 3 y ver llegar las propuestas (flechas, contador, cargador), «Pedir otras versiones», cambiar los ajustes y pedir otra vez, agregar un portafolio cuando el CV no lo trae, y la cabecera cambiando en cada paso. Decisión tuya: ~20 s para la primera propuesta es lo que da el modelo local actual; si es mucho, se puede mostrar solo 1 propuesta por pedido o usar un modelo más pequeño.

### P0.5 · S4 (ajuste): ajustes de redacción en un drawer aparte y selector deslizante (21-nov-2026)
- **Paso «Cuerpo» más limpio**: el plegable de ajustes salió del paso. Ahora hay dos botones juntos: «Pedir otras versiones» y un botón de solo ícono (controles deslizantes) que abre un **drawer aparte** (se abre encima del panel, mismo estilo flotante: `components/jobs/floating-drawer.tsx`, `apply-email-settings-drawer.tsx`) con **Longitud, Tono y Enfoque**, una explicación corta de la opción elegida y un botón «Listo».
- **`SlidingChoice`** (`components/motion/sliding-choice.tsx`): el «Tabs sliding» de transitions.dev (se leyó el código público de la página, que invita a copiarlo): barra con una píldora que se desliza hasta la opción activa (mide `offsetLeft/Top/Width/Height`, mueve con `transform` y `width` en **250 ms** con la curva `0.22, 1, 0.36, 1`; el primer pintado y los cambios de tamaño se colocan sin animación; sin animación con «reducir movimiento»). Con tokens del tema (`bg-muted`, `bg-background`, texto `muted-foreground`→`foreground`), semántica de grupo de radios con flechas y una sola opción en el orden de tabulación; 44 px de alto en pantallas táctiles.
- Comprobado en el servidor de desarrollo con una prueba de DOM (sin capturas): se abren 2 drawers anidados, hay 3 grupos, al elegir «Largo» la píldora pasa de `translate(141px, 4px)` a `translate(277px, 4px)` con el mismo ancho (133 px), la explicación cambia a «5 o 6 frases…» y el ajuste se guarda en el navegador.
- Verificado: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` (78 archivos, 732 pruebas) en verde.
- **Para revisar por Juan** (claro/oscuro, escritorio y 375 px): en el paso 3, el botón de ajustes; el drawer anidado (cómo se ve el panel de atrás), el deslizamiento de la píldora en los tres grupos (el de 4 opciones, «Enfoque», a 375 px) y el botón «Listo».

### P0.5 · S4 (ajuste): «Pedir otras versiones» pasa al drawer de ajustes (21-nov-2026)
- Los ajustes solo valen para las versiones que se piden, así que la acción principal vive donde se eligen: el drawer de «Ajustes de redacción» termina con **«Cerrar»** y el botón principal **«Pedir otras versiones»** (cierra el drawer y pide las 3 propuestas con los ajustes y el portafolio elegidos; con el cargador `orbit` y «Escribiendo…» mientras trabaja).
- En el paso «Cuerpo» queda un solo botón, **«Ajustes y otras versiones»**, que abre ese drawer; mientras la IA redacta muestra el cargador y «Escribiendo propuestas…» (las propuestas siguen llegando una a una).
- Comprobado por DOM en el servidor de desarrollo: al pulsar el botón principal del drawer, éste se cierra y el botón del paso pasa a «Escribiendo propuestas…».
- Verificado: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` (78 archivos, 731 pruebas) en verde.

### P0.5 · S5: datos en la firma y lo que pide la oferta (21-nov-2026)
- **Datos que salen en la firma** (drawer de ajustes → pestaña **Datos**; el drawer ahora tiene dos pestañas con el selector deslizante: **Estilo** y **Datos**): un interruptor por dato (**teléfono, correo, ciudad, LinkedIn, portafolio o web, «dónde vi la oferta»**), mostrando el valor que saldría; solo aparecen los datos que el CV trae. Tu nombre siempre va. Por defecto: teléfono, correo, portafolio y «dónde vi la oferta» encendidos; ciudad y LinkedIn apagados. La elección se recuerda en este navegador. LinkedIn y portafolio pasan a la **firma** (ya no un párrafo suelto). Si el CV no trae portafolio, el campo para agregarlo está en esta pestaña (`WebUrlField`).
- **«Dónde vi la oferta»**: «…vacante de X **que vi publicada en LinkedIn**…», solo si la fuente es un portal conocido (LinkedIn, Indeed, Computrabajo, Get on Board, elempleo, Magneto, Torre, Workana); con una oferta cargada a mano de otra fuente no se menciona.
- **Lo que pide la oferta** (`lib/jobs/asks.ts`, reglas, sin IA): al analizar la oferta se detecta si pide en el correo **aspiración salarial, disponibilidad, perfil de LinkedIn, portafolio o referencias** (cada uno necesita su frase clave y una instrucción en la misma frase; «rango salarial» o «salario competitivo» no cuentan). Se guarda en `apply.asks` (JSON, sin migración) y el administrador lo puede corregir (casillas «La oferta pide en el correo»).
- **Paso «Cuerpo»**: si la oferta pide algo, aparece el bloque **«La oferta pide en el correo»** con un campo por cada dato (aspiración salarial, disponibilidad, referencias; LinkedIn y portafolio con interruptor si el CV los trae, o con campo si no). Lo que la persona escribe entra al correo («Aspiración salarial: …»); **vacío no se agrega y nada se inventa**. Un texto editado a mano avisa que los cambios de datos no se le aplican y tiene **«Restaurar»**.
- **Paso «Listo»**: si algo de lo que pide la oferta no está en el correo, un aviso: «La oferta pide aspiración salarial y todavía no está en tu correo. Puedes volver al paso 3».
- Comprobado por DOM en el servidor de desarrollo (CV de prueba): firma por defecto «Nombre / teléfono · correo / Portafolio: …»; al apagar teléfono y encender ciudad y LinkedIn pasa a «Nombre / correo · Bogotá / LinkedIn: … / Portafolio: …», se guarda la elección y la intro dice «que vi publicada en LinkedIn».
- Verificado: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` (79 archivos, 753 pruebas) en verde. Pruebas nuevas: `tests/job-asks.test.ts` y ampliaciones de la plantilla, el paso «Cuerpo» y el drawer.
- **Para revisar por Juan** (claro/oscuro, escritorio y 375 px): (1) drawer de ajustes → pestaña «Datos»: interruptores y valores; el texto del correo cambia al instante; (2) **las ofertas ya guardadas no tienen `apply.asks`**: para ver el bloque «La oferta pide», analiza una oferta cuyo texto diga p. ej. «envía tu CV con aspiración salarial y disponibilidad a rrhh@…» (o marca las casillas en el panel de administrador); (3) paso «Listo» con algo pendiente.

### P0.5 · S6: estilo, contenido e idioma del correo (21-nov-2026)
- **Drawer de ajustes con tres pestañas** (selector deslizante): **Estilo · Contenido · Datos**, y arriba un **«Punto de partida»** (Cercano, Profesional, Directo; aparece «Personalizado» cuando se cambia algo): un clic ajusta varios valores a la vez (no toca el idioma). Los ajustes se recuerdan en este navegador.
- **Estilo**: **Registro** (sobrio, profesional, cercano, casual; siempre de tú), **Calidez** (neutra, cálida, entusiasta), **Tipo de lenguaje** (sencillo, técnico —usa el vocabulario de la oferta—, narrativo), **Longitud** (mínimo = 1 frase, corto, medio, largo) e **Idioma** (automático = el de la oferta, español, inglés). Cada opción tiene una explicación corta.
- **Contenido**: **Enfoque** (ya existía), **Saludo** («Hola, equipo de X», «Estimado equipo de selección de X», solo «Hola»; con un campo opcional **«Nombre de quien recibe»** que lo vuelve «Hola, Laura:») y **Cierre** (conversar, entrevista, agradecer, sin cierre).
- **Inglés**: el prompt, las plantillas de respaldo, el verificador (cifras, siglas y «years of experience» inventados; saludos y despedidas) y todo lo que arma el programa (saludo, introducción, «Salary expectation / Availability / References», adjunto, cierre) salen en inglés cuando se elige o cuando la oferta está en inglés (`offer.language`). Las propuestas ya redactadas conservan su idioma; solo cambian las nuevas y el texto base. El asunto inicial también sale en inglés si la oferta lo está (la sugerencia de otro asunto con IA sigue en español: pendiente).
- Ajustes anteriores: `tone` se reemplazó por `register`, `warmth` y `style`; lo guardado antes se ignora de forma segura y se mezcla con los valores por defecto.
- Comprobado por DOM en el servidor de desarrollo: el punto de partida «Directo» guarda `length: minimo, register: sobrio, greeting: simple, cta: ninguno…`; con idioma inglés, saludo «Estimado», cierre «Entrevista» y nombre «Laura», el texto base pasa a «Hello, Laura: / I am interested in the … position I saw on LinkedIn… / My CV is attached. I would love the chance to discuss the role with you in an interview. / Thank you for your time.».
- Verificado: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` (80 archivos, 764 pruebas) en verde. Pruebas nuevas: `tests/body-settings.test.ts` y ampliaciones de `body-ai`, plantilla y drawer.
- **Para revisar por Juan** (claro/oscuro, escritorio y 375 px): las tres pestañas (la de Estilo tiene 5 selectores; las de 4 opciones a 375 px), el punto de partida y «Personalizado», y pedir otras versiones con registros distintos para ver si el modelo local de verdad cambia de tono (no se midió la diferencia entre registros: es una impresión a validar contigo y tus amigos).

### P0.5 · S7a: interruptor con el movimiento de transitions.dev en toda la app (22-nov-2026)
- Nuevo `components/motion/motion-switch.tsx`: el `Switch` de shadcn (misma pista, foco y teclado, base-ui) con la bolita del «Toggle» de transitions.dev: recorrido con **doble rebote** (pasa 1 px del final, vuelve y se asienta), 350 ms, curva `cubic-bezier(0.34, 1.35, 0.64, 1)`; **no se anima al montar** y con `prefers-reduced-motion` cambia al instante. Va con `motion` (ya aprobada), sin CSS propio; no se copió su código (es de su versión Pro): se reimplementó el comportamiento público de la página.
- Los 8 usos de `Switch` de la app (privacidad, aprendizaje, filtros guardados, filtros de búsqueda, administrador de ofertas y de fuentes, ajustes y paso «Cuerpo» del correo) importan ahora de `@/components/motion/motion-switch`. `components/ui/switch.tsx` se conserva sin tocar.
- Verificado: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` (81 archivos, 767 pruebas) en verde. Pruebas nuevas en `tests/motion-switch.test.tsx`. Por DOM en el servidor de desarrollo: los interruptores se pintan apagados con la bolita en 0 px. **El movimiento no se pudo comprobar por DOM**: el aviso de privacidad de este navegador de prueba pide aceptar y los únicos interruptores a mano guardan esa elección, así que no se pulsaron.
- **Para revisar por Juan** (claro/oscuro, escritorio y 375 px): pulsar un interruptor en el drawer de ajustes → «Datos», en «Filtros» y en «Privacidad»; mirar el rebote de la bolita (¿muy marcado? el sobrepaso es de 1 px, ajustable en `OVERSHOOT`) y el foco con teclado.

### P0.5 · S7b: panel único de ajustes del correo (22-nov-2026)
- **Sin pestañas ni «Punto de partida»**: el drawer «Ajustes de redacción» es un solo panel. De 14 controles se pasó a **3 selectores** (**Tono**: Cercano / Profesional / Directo; **Longitud**: Corto / Medio / Largo; **Idioma**) + **«Qué incluye tu correo»** + **«Más ajustes»** plegado (Enfoque, Saludo, Cierre, nombre de quien recibe).
- **Tono único**: cada tono fija registro + calidez + tipo de lenguaje juntos (`TONES` en `lib/apply/body-settings.ts`; Registro, Calidez y Tipo de lenguaje dejan de ser controles). **Directo** ya no fuerza «mínimo» ni saludo/cierre: eso se elige aparte. El modelo interno de ajustes no cambió, así que la IA y las plantillas siguen igual.
- **Qué incluye tu correo**: interruptores (con el valor real debajo) en **«En el texto»** (dónde vi la oferta) y **«En la firma»** (teléfono, correo, ciudad, LinkedIn, portafolio); solo los datos que el CV trae; el campo de portafolio sigue aquí si el CV no trae uno.
- ~~Vista previa al pie del drawer~~: **quitada a pedido de Juan (22-nov-2026)**, ocupaba demasiado espacio; el texto se ve en el paso «Cuerpo».
- **Migración de lo guardado**: una combinación de ajustes sin tono (de S6) vuelve al tono «Cercano»; «mínimo» pasa a «corto»; saludo, cierre, enfoque e idioma se conservan (probado en `tests/body-settings.test.ts`).
- Verificado: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` en verde. **No hice comprobación por DOM en el navegador** (requería reconstruir un CV de prueba); la verificación es por pruebas de renderizado del drawer y de migración.
- **Para revisar por Juan** (claro/oscuro, escritorio y 375 px): el drawer completo (3 selectores, «Qué incluye», «Más ajustes» plegado y abierto), cambiar un interruptor y ver el texto cambiar al instante, y si el tono «Directo» te parece suficiente sin «Mínimo».

### P0.5 · S7c (parte 1): base de conocimiento de UX content (22-nov-2026)
- Nuevo **`docs/CONOCIMIENTO-UX-CONTENT.md`**: reglas con código (`R-…`), fuente y confianza sobre principios, lectura en pantalla (NN/g), tono (4 dimensiones y cómo se traducen los 3 tonos de Sooosh), estructura y mecánica, el correo de postulación, gramática y lenguaje claro en español, y un **borrador de guía compacta para el modelo** (§8). De ahí saldrán la guía del prompt, el verificador y la revisión final.
- Se leyeron 7 páginas de NN/g, GOV.UK, digital.gov, Mailchimp, Atlassian, Google, 4 guías de empleo (elempleo, Magneto365, Enhancv, Proton) y 3 de reclutador/correo en frío, Wikipedia en español (queísmo, dequeísmo, gerundio), 2 artículos de lenguaje claro y una guía comercial de correo formal. **No se pudo leer**: RAE, Fundéu y los PDF de las guías colombianas (DNP, SIC, Colombia Compra): están listados en §9 y no se usaron.
- Sin código nuevo ni mediciones: no se afirma mejora de calidad. Se mide en la parte 2 (conectar la guía al prompt y al verificador).
- **Para revisar por Juan**: leer §5 (correo de postulación), §3 (los 3 tonos) y §8 (guía compacta); decidir el tuteo vs «usted» (§5, pregunta abierta) y, si puedes, pegar el texto de la guía del DNP para citarla.

### P0.5 · S7c (parte 1b): ampliación con la guía de estudio de UX writing de NN/g (22-nov-2026)
- `docs/CONOCIMIENTO-UX-CONTENT.md` §10: se leyó la guía de NN/g y **25 de los artículos que enlaza** (cuánto se lee, brevedad, palabras a cortar, jerga, números, viñetas, formato, enlaces y llamadas a la acción, botones, decisiones sin presión, asuntos de correo, palabras de tono y tono con ChatGPT). Reglas nuevas `R-N1…R-N28`, cada una con su base (estudio con muestra, o recomendación sin estudio) y su fuente.
- Cambios a lo anterior: **R-C9** (asunto: lo importante en los primeros ≈ 40 caracteres, nombre al final) y la guía compacta del §8 (tonos como 2–3 descriptores combinados y 1–2 ejemplos por tono, porque un solo adjetivo de tono hace que el modelo exagere según NN/g 2024).
- Límites anotados en §10.6: casi todas las cifras son de sitios web y de EE. UU. (2005–2020); varias reglas numéricas no tienen fuente en su página; nada sobre correo de empleo ni niveles de lectura en español. Lista de lo no leído en §10.7.
- Sin código ni mediciones nuevas.

### P0.5 · S7c (parte 2): guía en el prompt, verificador de estilo y revisión final (22-nov-2026)
- **Guía de redacción**: `lib/apply/guidelines.ts` (guía completa, guía mínima y un ejemplo por tono) conectada al prompt con la opción `guide`. **Medida** contra el Ollama real (`bench/email-guide.test.ts`, 18 muestras por variante): sin guía el modelo ya escribe casi limpio; la guía completa subió ≈ 1,8 s la mediana, acortó los textos y subió los rechazos; la mínima no cambia nada medible. **Queda apagada** (detalle y límites en `docs/BENCHMARKS.md`).
- **Verificador de estilo (activo)**: además de los datos, una propuesta de la IA se descarta si trae exclamaciones, emojis, una apertura de relleno («Mi nombre es…», «Le escribo para…»), frases de relleno («excelente oportunidad», «brindar»…), gerundios que encadenan acciones o frases de más de 35 palabras; las exclamaciones se convierten en puntos antes de revisar. También se arregló que «¡Hola» al inicio se tomara por un nombre propio.
- **Revisión final** en el paso «Listo» (`lib/apply/review.ts`, por reglas, avisos y no bloqueos): destinatario, asunto no vacío, asunto de hasta 60 caracteres con el cargo en los primeros 40 (no se juzga si el asunto lo pide la oferta), cuerpo de hasta 200 palabras, sin marcadores sin completar, mención del adjunto, y sin exclamaciones, relleno ni frases largas. Más el **nombre del archivo adjunto** (`CV-Nombre-Empresa.pdf`) con botón de copiar.
- **Vista previa** del drawer de ajustes: quitada a pedido de Juan.
- Verificado: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` (83 archivos, 783 pruebas) en verde. Pruebas nuevas: `tests/guidelines.test.ts`, `tests/review.test.ts`.
- **Para revisar por Juan** (claro/oscuro, escritorio y 375 px): el paso «Listo» (nombre del adjunto y bloque «Revisión final» con todo en orden y con avisos: asunto largo, cuerpo de más de 200 palabras, texto editado a mano con «[…]»), y el drawer de ajustes sin vista previa.

### P0.5 · S7d: ajustes del correo en secciones con un selector por fila (22-nov-2026)
- **Drawer «Ajustes de redacción» rehecho** (pedido de Juan): sin pestañas ni «Más ajustes»; **3 secciones siempre abiertas según lo que hace cada ajuste**, separadas por `Separator`: **«Cómo suena»** (Tono, Idioma), **«Qué dice»** (Longitud, Enfoque, Cierre) y **«A quién y con qué datos»** (Saludo, Nombre de quien recibe, portafolio si falta, y los interruptores «En el texto» y «En la firma»). Se probó primero con sliders de pasos fijos y **Juan los descartó** (no le gustaron); quedó la versión con `Select`.
- **`SettingSelect`** (`components/setting-select.tsx`, el `Select` de shadcn sin cambios): cada ajuste es una **fila**: a la izquierda el nombre y la explicación de la opción elegida; a la derecha un selector compacto de **ancho fijo** (`w-36`, así quedan alineados; `h-11` en pantallas táctiles). Seis filas: Tono (Cercano, Profesional, **Sobrio**; «Directo» pasó a llamarse «Sobrio»), Idioma, Longitud, Enfoque, Cierre y Saludo. Filas de una misma lista: 8 px entre ellas; 24 px entre bloques (regla en `CLAUDE.md`).
- Descripción única del drawer: dice qué se aplica a las versiones que pidas (tono, idioma, longitud, enfoque) y qué cambia al instante (el resto).
- Comprobado por DOM en el servidor de desarrollo (CV de prueba en el navegador, luego limpiado): 6 selectores de 144 × 32 px con su nombre accesible; el desplegable de Tono se abre **por encima del drawer** (z-index 50, el centro del desplegable es el elemento superior) con Cercano, Profesional y Sobrio; al elegir «Sobrio» el valor, la explicación («Formal y al grano, sin adornos.») y lo guardado (`register: sobrio`, `warmth: neutra`) cambian y el selector se cierra (`aria-expanded=false`). No probé el resto de selectores uno por uno, el teclado dentro del desplegable ni el modo táctil (alto de 44 px solo por clase).
- Verificado: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` en verde. Se eliminaron `StepSlider` y su prueba.
- **Para revisar por Juan** (claro/oscuro, escritorio y 375 px): las 3 secciones (jerarquía título de sección / etiqueta de campo / selector), el ancho fijo de 144 px con textos largos («Experiencia», «Habilidades», «Hola, equipo») y con la explicación a dos o tres líneas a 375 px, el espacio de 8 px entre filas (si se ve apretado con explicaciones de dos líneas, lo subimos), y el desplegable abierto en 375 px.

### P0.5 · S7e: botón de copiar dentro del campo, en el paso «Listo» (23-nov-2026)
- Cada pieza (**Para, Asunto, Cuerpo y Nombre del archivo adjunto**) es ahora un campo de solo lectura (`InputGroup` + `InputGroupTextarea` de shadcn, crece con el contenido para que se vea todo, p. ej. varios destinatarios) con el **botón de copiar dentro, arriba a la derecha** (`icon-xs`, 24 px). Al copiar, el ícono pasa a un **check** durante 1,6 s y sigue el aviso «… copiado».
- Comprobado por DOM en el servidor de desarrollo (CV de prueba, luego limpiado): las 4 piezas tienen su botón dentro del campo (24 × 24 px, `aria-label` «Copiar para / asunto / cuerpo / nombre del archivo adjunto»); al pulsar «Copiar asunto» el ícono pasó a check, apareció «Asunto copiado» y a los ≈ 2 s volvió al ícono de copiar. No comprobé que el portapapeles recibiera el texto (el navegador de prueba no lo garantiza) ni el área de toque en móvil (el botón de 24 px no llega a los 44 px que pide la regla táctil).
- **Para revisar por Juan** (claro/oscuro, escritorio y 375 px): las 4 piezas con el botón dentro del campo (¿te gusta arriba a la derecha en el cuerpo?), el check al copiar, y el área de toque del botón a 375 px (si se queda corta, lo ampliamos).

### CV ATS · A1: base de conocimiento de reglas (23-nov-2026)
- Nuevo `docs/CONOCIMIENTO-ATS.md`: definición de trabajo, 5 conflictos entre fuentes con su decisión, **38 reglas verificables** con id, peso (crítica/alta/media/baja), confianza y fuente, encabezados por idioma (español/inglés), plantilla exacta, reparto código/IA y **propuesta de cálculo del porcentaje** (pesos 5/3/2/1, tope de 69 % si falla una crítica).
- Fuentes leídas completas: Resume.io, Indeed y Enhancv UK. Las capturas de Google se usaron como apoyo; **no se leyeron** la plantilla `.docx` de Indeed ni atsverification.com. Ninguna estadística de los sitios se usa.
- Solo documentación: no hay código, así que lint/tsc/build/test no aplican a esta etapa.
- **Para revisar por Juan**: `docs/CONOCIMIENTO-ATS.md`, sobre todo (1) los conflictos C1–C5, (2) los pesos y el tope de 69 %, (3) que Habilidades/fechas/viñetas queden como se definieron, (4) si quieres más o menos reglas críticas. Siguiente: A2 (generador) cuando aprobes.

### CV ATS · A2: generador de la versión ATS (23-nov-2026)
- **Nuevo `lib/ats/`** (sin cambios visibles todavía; la interfaz es A4): `headings.ts` (encabezados es/en y textos fijos), `dates.ts` («Mes Año», «Presente»; no inventa mes), `lang.ts` (detecta el idioma del CV por palabras funcionales), `model.ts` (`buildAtsDoc`: orden fijo, cronológico inverso, separadores `|` y `—`, habilidades por comas sin duplicados, viñetas simples), `text.ts` (texto canónico), `html.ts` + `pdf.ts` (PDF con Chromium local: Arial 10,5 pt, márgenes 20 mm, una columna, sin tablas/imágenes/listas gráficas/colores; devuelve páginas), `docx.ts` (Word: Arial, 2 cm, sin encabezado/pie/tablas/imágenes, estilo «Título 1» en negro), `filename.ts` (`Nombre-Apellido-Cargo`), `summary.ts` + `generate.ts` (resumen con Ollama solo si el CV no trae uno).
- **Reparto**: estructura y datos, por código; Ollama solo el resumen, con verificador (cifras, fechas, nombres, siglas, términos técnicos; los años de experiencia se calculan de las fechas y son el único dato nuevo permitido) y 2–4 frases, sin primera persona ni exclamaciones. Si falla o no pasa, la sección se omite: nunca se inventa. Las viñetas **no se reescriben** (decisión: primero medir con el verificador de A3).
- **Verificado**: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` en verde (84 archivos, 815 pruebas; 32 nuevas en `tests/ats-generator.test.ts`: fechas, idioma, estructura, **toda palabra del documento sale del CV, de un mes o de un texto fijo**, no se omite ningún puesto/estudio/viñeta, HTML sin elementos prohibidos, DOCX inspeccionado por dentro con `unzip` y `mammoth`, PDF real con texto en orden y ≤ 2 páginas, resumen con proveedor falso).
- **Ollama real (qwen3.5:9b), fuera de la suite**: 3 resúmenes de un CV de ejemplo, los 3 aceptados, ≈ 6–11 s cada uno. Son 3 muestras, **no es un benchmark** y no está en `BENCHMARKS.md`. En una se coló la palabra «modelado», que el CV no decía: el verificador no revisa palabras comunes en minúscula (límite anotado en `docs/CONOCIMIENTO-ATS.md` §9).
- **Ajustes a las reglas** (documentados en §9): titular bajo el nombre (ATS-K2), educación sin ciudad (ATS-E7), fechas solo con año se dejan y el verificador debe tratar ATS-E3 como «no aplicable» en ese caso, habilidades sin recortar.
- **No comprobado**: el PDF se genera con la fuente Arial del sistema; en un equipo sin Arial, Chromium usará otra y A3 deberá leer la fuente real del archivo. Tampoco probé el DOCX abriéndolo en Word/Pages.
- **Para revisar por Juan**: no hay pantalla nueva. Lo revisable es el documento: dime si la plantilla (nombre, titular, contacto, secciones, `Cargo — Empresa, Ciudad | Mes Año`) te gusta, o si prefieres otro orden o separadores, antes de montar el drawer (A4). Siguiente: A3 (verificador y porcentaje).

### CV ATS · A2 (ajuste): plantilla auditada contra la documentación (23-nov-2026)
- Pedido de Juan: la plantilla se valida con las fuentes, no con su opinión. Se leyeron 4 fuentes más (Workable, Adobe Express, Toptal, Novoresume) y se hizo la **auditoría de la plantilla elemento por elemento** (`docs/CONOCIMIENTO-ATS.md` §10). Resultado: la estructura coincide con la plantilla de Google e Indeed y **ningún elemento contradice una fuente**; dos puntos quedan abiertos y marcados.
- **Ajustes que salieron de la auditoría**: cargos sin abreviaturas (nueva ATS-E10: «Sr.» → «Senior», «Jr.» → «Junior», «Ssr.» → «Semi Senior», con aviso; solo en cargos y titular), resumen de ≤ 4 líneas (ATS-S3, tope de 400 caracteres en la IA), tamaño de archivo < 2,5 MB (nueva ATS-F8), Educación/Habilidades en cualquier orden (ATS-S5 baja a peso bajo), sin espaciado entre letras (ATS-T5), viñetas 1–6 (ATS-E6). Nuevos conflictos documentados: C6 (fechas), C7 (resumen con encabezado), C8 (orden). Reglas: 40.
- **Abierto, sin respaldo**: (1) formato de fecha: 3 fuentes piden «Mes Año» y 2 piden `MM/AAAA`; todas son de EE. UU./Reino Unido y ninguna prueba que «Marzo 2021» se lea bien en español; (2) ninguna fuente es documentación oficial de un ATS (no se pudo leer ResumeGeni, atsverification.com ni RemakeCV, ni la plantilla `.docx` de Indeed); el porcentaje seguirá midiendo «cumple las guías».
- Verificado: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` en verde (84 archivos, 818 pruebas; 3 nuevas).
- **Para revisar por Juan**: `docs/CONOCIMIENTO-ATS.md` §10 (la tabla de la auditoría) y decidir el punto abierto de las fechas.

### CV ATS · A3: verificador con porcentaje (23-nov-2026)
- **Nuevo** `lib/ats/zip.ts` (lector de .zip sin dependencias), `extract.ts` (lee el ARCHIVO: texto en orden, fuente real, tamaños, márgenes, imágenes, anotaciones, colores, tablas, columnas, encabezado/pie), `rules.ts` (las 40 reglas con peso, confianza y «cómo corregir») y `verify.ts` (`verifyAtsFile` → informe con porcentaje, etiqueta y detalle por regla; `scoreRules` es una función pura). Cálculo aprobado: pesos C=5/A=3/M=2/B=1, «no aplica» no cuenta, nunca 100 % si algo falla, **tope de 69 % y etiqueta «No cumple lo esencial»** si falla una regla crítica; ≥ 90 % «Listo para ATS», 75–89 % «Casi», < 75 % «Necesita cambios». Siempre con el aviso «mide el formato según guías públicas; no garantiza que un ATS concreto lo acepte».
- **Hallazgos al construirlo**: (1) el verificador encontró azules en el Word (`2e74b5`…): eran los estilos «Título 2–6» que Word trae por defecto y el documento no usa; el texto visible era negro. Se corrigió el verificador para mirar solo los estilos usados. (2) Un CV con un solo dato de contacto fallaba ATS-K2 por exigir «|»; corregido.
- **Resultado sobre nuestros archivos**: PDF y Word de un CV de prueba, **100 % (40 reglas: 39 cumplen, 1 no aplica)**. Sobre archivos ajenos (`sample.pdf`, `scanned.pdf`, `sample.docx` de los fixtures, contra un CV que no es el suyo) puntúa 45–63 % y marca fuente Monaco, márgenes de 0,6 cm, PDF escaneado sin texto, etc.
- **Verificado**: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` en verde (85 archivos, 838 pruebas; 20 nuevas en `tests/ats-verify.test.ts`: CV bueno en PDF y Word, PDF malo con columnas/imagen/Courier 8 pt/color/viñetas raras/encabezado, PDF escaneado, Word con tabla/imagen/encabezado/columnas/Comic Sans, contenido inventado u omitido, cálculo del porcentaje, **ids y pesos del código = los del documento de reglas**).
- **Límites** (detalle en `docs/CONOCIMIENTO-ATS.md` §11): las tablas en un PDF no se ven directamente (se infieren por columnas); el número de páginas de un Word no se puede medir; el espaciado entre letras no se mide en PDF; los títulos se detectan por tamaño/estilo (heurística con CV ajenos); ATS-E5 (verbo de acción) es una heurística; ATS-I1 no detecta palabras comunes inventadas en minúscula. No lo probé contra un ATS real ni con un Word abierto en Word.
- **Para revisar por Juan**: no hay pantalla nueva. Siguiente: A4 (rediseño del drawer de CV con el proceso animado, «Generar versión ATS», «Verificar» y descargas).

### CV ATS · A4: panel «Mi CV» rediseñado con la versión ATS (23-nov-2026)
- **Panel «Mi CV» rediseñado** (`components/jobs/search-profile-panel.tsx`, `ats-version.tsx`): arriba el CV animado, luego título y descripción (dentro de la zona con scroll, `p-0`), el nombre del CV con «Cambiar CV» y «Quitar», un `Separator` y el bloque **Versión ATS**. Espaciado de panel: 24 px entre bloques, 8 px dentro. Sin CV, solo «Subir mi CV». Solo shadcn y tokens semánticos (una prueba lo vigila: sin colores ni valores arbitrarios).
- **Flujo**: «Generar versión ATS» → lista de pasos con el **avance real** (Ordenando secciones y fechas · Redactando el resumen, o «Conservando tu resumen» si el CV ya traía uno · Armando el PDF y el Word) → «Tu versión ATS está lista» (páginas, nombre del archivo, avisos) con **Verificar**, **PDF**, **Word** y «Generar de nuevo». Los archivos llegan una sola vez y se descargan sin volver al servidor.
- **Validación (decisión de Juan, 23-nov)**: tras «Verificar», una marca **«Validado»** (o la etiqueta «Casi…» / «Necesita cambios» / «No cumple lo esencial»), el porcentaje y **6 grupos por tema sin detalle de reglas** (Archivo y estructura · Tipografía y márgenes · Secciones y orden · Datos de contacto · Experiencia y educación · Contenido fiel a tu CV), cada uno con ✓ o «por revisar». Se verifican el PDF y el Word; gana el peor porcentaje. Siempre con el aviso «mide el formato según guías públicas; no garantiza que un ATS concreto lo acepte».
- **CV animado** (`components/ai/cv-motion.tsx`): **monocromático** (un solo color del tema, `primary`, en tonos de opacidad), solo opacity y translate: una cubierta del color de la hoja se desliza sobre cada línea y la deja ver, con retardo entre líneas, y una franja tenue baja por la hoja; al terminar, marca de check. Con movimiento reducido queda quieto. Tiempos en `lib/motion.ts` (`cvCycle`, `cvLine`, `cvSweep`). Las reglas de movimiento de `components/ai/*` las vigila el test existente. **No se usó la librería `thinking-orbs`** (MIT, v0.3.2, sin dependencias, pero nueva, de un solo mantenedor y sin datos de uso; no se pudo ver cómo se ve ni cómo se renderiza): queda como posible mejora tras revisar su código.
- **API** `POST /api/ats` (`generate` en NDJSON con etapas reales; `verify` con los archivos en base64). `generateAts` ahora avisa de la etapa real (`onStage`); nuevo `groupSummary`/`combineReports` en `verify.ts`; cliente en `lib/ats/client.ts`.
- **Verificado**: lint (0 errores; 3 avisos previos), `tsc`, `build` y `pnpm test` en verde (87 archivos, 855 pruebas; nuevas: `tests/ats-api.test.ts` cliente + ruta con PDF/Word reales, `tests/ats-version.test.tsx` panel, CV animado y grupos). Además contra **tu servidor de desarrollo (:3000)**: `generate` devolvió etapas 0 → 2 y el resultado 3 de 3 veces, y `verify` dio 100 % «Listo para ATS» con los 6 grupos ok.
- **No comprobado**: no abrí la pantalla en un navegador (la auditoría visual es tuya): lo verificado es el renderizado estático del panel y la API. **Un fallo sin explicar**: la primera llamada a `generate` contra tu servidor falló con el error genérico y las 4 siguientes funcionaron; no pude ver el registro de tu terminal ni reproducirlo (sospecho compilación en frío del servidor de desarrollo; si lo ves, avísame con el texto de tu terminal). Tampoco probé la descarga (`saveBlob`) en un navegador, ni el movimiento reducido en uno real, ni el panel inferior en móvil.
- **Para revisar por Juan** (claro/oscuro, escritorio y 375 px): abre «Mi CV» (1) sin CV: solo «Subir mi CV» y el CV animado quieto; (2) con CV: «Generar versión ATS» y mira los pasos y el CV animado (¿el movimiento y el tono monocromático van con tu referencia?); (3) «Verificar» y la marca «Validado» con los 6 grupos; (4) descarga el PDF y el Word y ábrelos; (5) un CV con resumen propio de una sola frase o viñetas largas: debería quedar «por revisar» en «Secciones» o «Experiencia». **Decisión pendiente**: hoy «Validado» exige «Listo para ATS» (≥ 90 % y sin fallos críticos), así que puede aparecer «Validado» con un grupo «por revisar»; si prefieres que «Validado» sea solo 100 %, es un cambio de una línea.

### CV ATS · A5: lectura profunda del CV y fechas `MM/AAAA` (23-nov-2026)
- **Fechas `MM/AAAA`** (decisión de Juan; evidencia: Enhancv leyó `03/2021` y no «Marzo 2021»). Documentado en `docs/CONOCIMIENTO-ATS.md` (C6 resuelto, §5, §9b). El verificador acepta un solo formato, sea cual sea.
- **El aviso «No se pudo ordenar por fecha» era un error mío**: salía por estudios sin fecha. Ahora lo que no trae fecha va al final sin aviso; solo una fecha escrita e ilegible avisa, con un mensaje que lo explica.
- **Lectura profunda** (`lib/ats/enrich.ts`): la IA local relee el texto original y solo **identifica** puestos, certificaciones, voluntariado, habilidades y proyectos; el código copia el texto y descarta todo lo que no esté literalmente en el original; las viñetas las lee el código por bloques (sin IA). Rellena lo que el análisis general dejó roto o vacío, nunca pisa lo que estaba bien. Secciones nuevas: Certificaciones y Voluntariado. Resumen largo: se cortan frases completas. «Figma 100 %» queda «Figma».
- **Con tu CV real** (`docs/BENCHMARKS.md`, 4 intentos): 162 s en el mejor; puestos, fechas y 14 viñetas correctos; 91 %. Dos intentos fallaron por diseño (respuesta cortada; números de línea inexactos) y por eso cambió el enfoque. «Generar de nuevo» reutiliza la lectura.
- **Verificado**: lint (0 errores; 3 avisos previos), `tsc`, `build`, `pnpm test` (88 archivos, 873 pruebas; 18 nuevas en `tests/ats-enrich.test.ts`).
- **Limitaciones honestas**: (1) quedó en **3 páginas** y 91 %: regla de páginas, orden de secciones, viñetas sin verbo y «puestos con 0 viñetas» (descripciones sin viñeta) siguen fallando; son de A6 (separar «formato» de «contenido»). (2) A veces la IA omite un puesto (en una corrida faltó «Freelance»). (3) El CV debe volver a subirse para guardar el texto original; los CV ya guardados se generan sin lectura profunda. (4) **`components/steps/step-profile.tsx` tiene mi cambio de una línea (guardar el texto al subir por el asistente) mezclado con tu trabajo sin commitear: no lo incluí en el commit**. (5) El lector de Enhancv no se volvió a probar con este formato.
- **Para revisar por Juan**: vuelve a subir tu CV en «Mi CV» y genera la versión ATS (tarda ≈ 3 min la primera vez): revisa puestos, viñetas, certificaciones y fechas `MM/AAAA`. Siguiente: A6 (verificador).

### CV ATS · A6: verificador calibrado, formato separado de contenido (23-nov-2026)
- **Porcentaje = solo formato.** Lo que depende de lo que escribió la persona (páginas, viñetas con verbo, resumen largo, siglas, relleno, frases vagas) pasó a **«Consejos para tu CV»**: se muestran aparte y no restan. Nuestros archivos dan **100 % de formato**; el CV real de Juan sigue teniendo consejos (3 páginas, pocos verbos de acción) sin que bajen el porcentaje. Detalle y razones en `docs/CONOCIMIENTO-ATS.md` §12.
- **Falsos fallos corregidos**: títulos en negrita/mayúsculas en Word ajenos (el Word de referencia ya no falla ATS-S1; ahora queda en 69 % solo por ATS-I1, porque su contenido es de otra versión del CV, que es correcto), puestos con descripción sin viñetas, líneas partidas contadas como puestos, orden con Certificaciones y Voluntariado, rangos «2018 - 2021» en certificaciones.
- **Nuevo, inspirado en Enhancv**: «tasa de lectura» (se muestra «Un lector automático recupera el N % del contenido»), ATS-Q1 (cifras en los logros) y ATS-Q2 (viñetas que empiezan igual). Reglas: 42. Panel: línea de tasa de lectura y bloque «Consejos para tu CV» tras Verificar.
- **Verificado**: lint (0 errores; 3 avisos previos), `tsc`, `build`, `pnpm test` (88 archivos, 876 pruebas; nuevas: consejos, Word ajeno, descripción sin viñetas).
- **No comprobado**: solo 1 CV real y 1 documento ajeno calibrados; no se re-subió a Enhancv; no vi el panel en un navegador.
- **Decisión de Juan (23-nov-2026)**: «Validado» exige **≥ 90 % y ningún fallo crítico** (no 100 %). Ya es lo que hace el código.
- **Para revisar por Juan**: genera tu versión ATS, pulsa Verificar y mira la tasa de lectura y los consejos. Siguiente: A7 (diseño).

### CV ATS · A7: rediseño de «Mi CV» con degradado, Attachment, Trace y beam (23-nov-2026)
- **Escenario** (`components/magic/cv-stage.tsx`): la hoja de CV monocromática sobre un degradado del color `primary` del tema que se desvanece hacia el fondo; el título va centrado debajo, como tu referencia. Es una excepción a «sin degradados», limitada a ese escenario, documentada en `CLAUDE.md` y `docs/DESIGN-TOKENS.md` (sección «Hoja Mi CV»).
- **Estado vacío**: tres pasos numerados y un recuadro de subida (`Attachment` en estado `idle`, borde punteado) que se puede **hacer clic o soltar el archivo encima**, con el resplandor suave `Beam pulse-inner` que «respira».
- **Mientras la IA lee el CV o genera la versión ATS**: el haz `Beam` (`mono`) recorre el borde de **todo el panel**; en reposo está apagado. La lectura mantiene la regla de las hojas con carga (solo cargador + hoja animada).
- **Con CV**: tu CV en un `Attachment` (con Cambiar CV / Quitar). Pasos de la generación con `Trace` (hecho con ✓, actual con brillo y spinner, siguientes atenuados). Los archivos generados son dos `Attachment` descargables (PDF y Word); «Verificar» y «Generar de nuevo» siguen como botones.
- **Verificado**: lint (0 errores; 3 avisos previos), `tsc`, `build`, `pnpm test` (88 archivos, 876 pruebas; actualizadas las del panel: escenario, Attachment, pasos numerados, solo tokens del tema en `cv-stage.tsx`).
- **No comprobado (la auditoría visual es tuya)**: no abrí la pantalla. Riesgos que quiero que mires: (1) si el beam alrededor del panel respeta bien el radio y el alto de la ventana; (2) si la hoja se «pierde» en el título como en tu referencia (el solape es de 4 rem y el desvanecido de 7 rem: ajustables); (3) el tema claro; (4) 375 px; (5) que el brillo del `Trace` se vea; (6) soltar un archivo sobre el recuadro.
- **Para revisar por Juan** (claro/oscuro, escritorio y 375 px): «Mi CV» (a) sin CV; (b) subiendo un CV (lectura); (c) con CV, generar la versión ATS (≈ 3 min la primera vez); (d) tras verificar, consejos y descargas.
- El cambio de `components/steps/step-profile.tsx` (guardar el texto original al subir por el asistente) se commiteó aparte.

### CV ATS · A7 (ajuste tras ver la pantalla): «Mi CV» como panel lateral, zona de soltar y sin adornos (23-nov-2026)
- **Descartado por Juan y eliminado**: el degradado, la hoja de CV monocromática animada y el beam (`CvMotion`, `CvStage`, sus tiempos en `lib/motion.ts`, su fila en `components/ai/README.md` y las excepciones de `CLAUDE.md` y `docs/DESIGN-TOKENS.md`). Queda lo necesario: título, `Attachment`, `Trace`, archivos y botones.
- **Panel lateral flotante**: «Mi CV» reutiliza `FloatingDrawerContent` (el de «Postular por correo») en `components/jobs/search-profile-panel.tsx` (`SearchProfileDrawer`).
- **Todo el panel es zona de soltar**: al arrastrar un archivo encima, el contenido se desenfoca/atenúa y aparece «Suelta tu CV aquí» (solo opacity/blur/translate, tiempos de `lib/motion.ts`, `useReducedMotion`). Arrastrar texto o enlaces no la activa.
- **Errores con mensajes claros** (`lib/profile/cv-drop.ts`, 4 pruebas): ningún archivo, varios archivos, archivo vacío, carpeta/sin extensión, formato no admitido (dice cuáles sí), demasiado pesado (dice cuánto y qué hacer), y errores de lectura (IA local caída, sin conexión, cancelada, PDF escaneado) reescritos para decir qué hacer.
- **Verificado**: lint (0 errores; 3 avisos previos), `tsc`, `build`, `pnpm test` (89 archivos, 877 pruebas). **No comprobado**: no abrí la pantalla ni probé arrastrar un archivo real en un navegador (Safari/Chrome); es lo primero que debes mirar.
- **Para revisar por Juan** (claro/oscuro, escritorio y 375 px): abre «Mi CV»; arrastra un PDF sobre cualquier parte del panel (aviso + desenfoque), suéltalo; prueba soltar 2 archivos, un .exe, un texto y un archivo vacío para ver los mensajes.

### CV ATS · A8: más rápido, lectura en segundo plano y «Así te lee un ATS» (24-nov-2026)
- **Tiempo**: el cuello de botella era la IA escribiendo ≈ 1.000 tokens. Medí 6 modelos con tu CV (`docs/BENCHMARKS.md`): **`gemma4:e4b` (ya instalado) hace la lectura en ≈ 50 s con la misma calidad** que `qwen2.5:7b` (≈ 135 s); los de 14 B (`qwen2.5:14b`, `qwen3:14b`, `phi4`, que descargué) **no terminan en 5 min** en tu Mac. De punta a punta: **33 s frente a 162 s**. La versión ATS usa `OLLAMA_ATS_MODEL=gemma4:e4b` (ya agregado a tu `.env.local` y a `.env.example`; **reinicia `pnpm dev` para que lo lea**) con `keepAlive` de 2 min.
- **Lectura en segundo plano**: al subir el CV se lanza sola (`lib/ats/prefetch.ts`, ruta `read`), se guarda en tu navegador y «Generar versión ATS» la reutiliza o espera a la que está en curso (sin duplicar el trabajo en Ollama).
- **«Así te lee un ATS»** (nuevo, tras «Verificar»): campo por campo lo que se logra leer del ARCHIVO: nombre, correo, teléfono, puestos con fechas, educación y habilidades (✓ o aviso).
- **Se descartó** el modo «reducido» (que la IA escribiera menos y el código copiara el resto): con `gemma4` no ganaba tiempo y perdía proyectos; se eliminó.
- **Verificado**: lint (0 errores; 3 avisos previos), `tsc`, `build`, `pnpm test`. En tu CV real, con el pipeline completo: formato 100 %, tasa de lectura 100 %, 6 puestos con fechas y 14 viñetas.
- **Límites**: tiempos de un solo CV y una máquina; las pruebas de modelos tuvieron una tanda contaminada por memoria (documentado). El documento sigue saliendo en 3 páginas (consejo de contenido). Reduje al mínimo lo medido, no prometo estos tiempos con otros CV.
- **Para revisar por Juan**: reinicia `pnpm dev`, sube tu CV y espera ~1 min; luego «Generar versión ATS» debería ser casi inmediato. Pulsa «Verificar» y mira «Así te lee un ATS».

### CV · pantalla inicial y panel «Mi CV»: lo que se ve al arrastrar y al leer (24-nov-2026)
- **Antes de soltar** (`describeDrag`/`dropCopy` en `lib/profile/cv-drop.ts`): el aviso dice **cuántos archivos** trae («Traes 2 archivos», pide uno solo) y **de qué tipo** («PDF · un solo archivo»), y avisa de un formato que no leemos («Ese formato no lo leemos»). **Nunca el nombre ni el peso**: el navegador los oculta hasta el `drop`. Algunos tipos (`.md`, `.heic`, a veces `.docx`) llegan vacíos: entonces solo dice «Un solo archivo». Verificado en WebKit con arrastres **simulados**; **no probado con un arrastre real del sistema**, donde el tipo puede llegar distinto.
- **Al soltar** (`fileSummary`): bajo la línea de lectura, «Mi-CV.pdf · 1.2 MB · PDF», en la pantalla inicial y en el panel.
- La pantalla inicial decía «Arrastra el archivo o haz clic» pero el clic está desactivado a propósito (la página entera es la zona de soltar): ahora dice «Arrastra el archivo aquí».
- El haz (`FlowBeam`): animado solo con `transform` (GPU) y máscaras SVG estáticas que siguen el contorno redondeado; tonos fríos; hilo de 2 px; densidad 0,6 y vuelta de 4 s en la ventana completa. Verificado con capturas de WebKit (claro y oscuro, 4 esquinas).

### Repositorio de CV por oferta (popover) y app solo oscura (24-nov-2026)
- **Solo tema oscuro** (decisión de Juan): se quitó el interruptor de todas las cabeceras (`theme-toggle.tsx` eliminado), `ThemeProvider` con `forcedTheme="dark"` y `<html class="dark">`. `CLAUDE.md` ya no pide revisar el tema claro.
- **Repositorio de CV por oferta** (`components/history/cv-repository.tsx`): en el lugar del interruptor, un **popover** con scroll que lista el CV que se generó para cada oferta (título, empresa, fecha, cobertura final y tres acciones: descargar PDF, reabrir, eliminar). Reutiliza `Popover`, `ScrollArea`, `Item`, `Badge`, `Button`, `Empty` y `Spinner`. Con más de 4 entradas la lista tiene altura fija y se desplaza. Está en la cabecera del asistente (reemplaza el botón «Historial» y su diálogo), de la búsqueda de ofertas y del detalle de una oferta.
- **Base de datos**: es el **historial de adaptaciones que ya existía** (`lib/history.ts`): guarda, por oferta, la oferta, el CV de partida, el CV exportado, las decisiones de la revisión y la cobertura (máx. 50). **Vive solo en este navegador (localStorage)**, como dice `CLAUDE.md` (los CV son datos personales y se quedan locales hasta que existan cuentas). Desde otras páginas, «Reabrir» lleva a `/?reabrir=<id>` y el asistente reabre esa adaptación.
- **Verificado**: lint, `tsc`, `build`, `pnpm test` (94 archivos, 918 pruebas) y, en tu servidor, por DOM: 7 CV de ejemplo → 7 filas, scroll hasta la última, tres acciones por fila, cierra con Escape. No revisé el aspecto visual (la autorización de capturas WebKit es solo para el haz).
- **Pendiente (siguiente fase): el recorrido de validación del CV**, ver el mensaje de Juan del 24-nov: validar con el usuario cada dato leído (nombre, rol, contacto, resumen, **cada experiencia, cada estudio, habilidades**), con «Es correcto» / corregir, entrada de texto solo donde la IA no puede generar o el dato es sensible, botón de IA con opciones sacadas del propio CV, pantalla dividida (izquierda: archivo; derecha: etapas).

### Validación del CV, fase F1 (24-nov-2026)
- El paso «Perfil» ahora es **«Validemos tu CV»**, en pantalla dividida (`components/cv/validation-flow.tsx`): izquierda, datos del archivo (nombre, tipo, peso, tiempo de lectura, avisos de OCR/CV largo); derecha, etapas **Nombre → Rol → Contacto**, una a la vez. Cada una pregunta «¿Es correcto?»: **Es correcto** la marca con ✓ y su valor; **No es correcto** abre los campos (se escribe solo lo que la IA no puede generar o es sensible: nombre y contacto).
- **Rol**: botón «Sugerir desde mi CV» con los cargos que ya están escritos en el CV (titular y cargos de la experiencia, sin repetir; `lib/cv/validate.ts`). No inventa nada.
- Los cambios se guardan por el mismo camino de antes (`update` → perfil de búsqueda y `/api/cv/profile`). Se retiró la tarjeta «Así leímos tu CV» de este paso (`ProfileSummary` ya no se usa aquí).
- Verificado: lint, `tsc`, `build`, `pnpm test` (95 archivos, 921 pruebas) y, por DOM en tu servidor: grilla de 2 columnas, flujo Nombre ✓ → Rol (elegir «UX Designer») → Contacto, sin scroll horizontal. Sin capturas.
- **Para revisar por Juan**: paso 1 en escritorio (1280) y 375 px (en móvil las columnas se apilan), oscuro. Falta: F2 (resumen, habilidades, idiomas) y F3 (cada experiencia y estudio, con botones de IA); «Continuar a Oferta» aún no exige validar.

### Validación del CV, fase F2 (24-nov-2026)
- Se suman las etapas **Resumen, Habilidades e Idiomas** (ahora son 6: Nombre → Rol → Contacto → Resumen → Habilidades → Idiomas). Resumen: texto editable. **Habilidades: se validan una por una** (cada una es una pastilla con ✕ para quitarla, y un campo para agregar otra; los grupos del CV se conservan, sin repetidas). Idiomas: filas editables (idioma y nivel). Si el CV no trae el dato: «Agregar» u «Omitir».
- **«Continuar» queda bloqueado hasta validar todas las etapas** (`validated` en `wizard.tsx`; se reinicia al subir otro CV o cambiarlo; una adaptación reabierta del historial cuenta como validada).
- Verificado: lint, `tsc`, `build`, `pnpm test` (95 archivos, 922 pruebas) y, subiendo un CV real (txt) en tu servidor: «Continuar» bloqueado al inicio y antes de la última etapa, habilitado al terminar.
- Falta F3: cada experiencia y cada estudio, con botones de IA.

### Validación del CV, fase F3 (24-nov-2026)
- **Una etapa por cada experiencia y cada estudio** (además de Nombre, Rol, Contacto, Resumen, Habilidades e Idiomas): se muestra la línea (cargo · empresa · fechas; título · institución · fechas) y, en la experiencia, los logros que dice el CV. «Es correcto» la confirma; «No es correcto» abre cargo, empresa, fechas, ciudad y logros (uno por línea) o título, institución, área y fechas. **«Quitar del CV»** elimina esa entrada (las etapas siguientes se renumeran). Lo que se corrige o quita es la base con la que se generan los CV por oferta.
- Sin botones de IA en estas etapas, a propósito: una experiencia o un estudio son hechos del usuario y cualquier propuesta generada sería invención (regla «nunca inventar datos del CV»). El único asistente es «Sugerir desde mi CV» del rol (cargos ya escritos en el CV).
- Verificado: lint, `tsc`, `build`, `pnpm test` (95 archivos, 923 pruebas) y, subiendo un CV real con 3 experiencias y 1 estudio: 4 etapas de entradas, corregir un cargo, quitar una experiencia, «Continuar» bloqueado hasta el final.
- **Para revisar por Juan**: paso 1 completo en 1280 y 375 px (oscuro): una experiencia con muchos logros, el editor de experiencia y el de estudio, y el bloqueo de «Continuar».

### Validación del CV: una pregunta a la vez (24-nov-2026, ajuste de Juan tras F3)
- **Una sola pregunta visible**; al confirmar, la anterior sale y entra la siguiente con `motion` (desplazamiento horizontal corto + desenfoque + opacidad, `AnimatePresence mode="wait"`; con «reducir movimiento», solo opacidad). La dirección cambia al ir atrás.
- **Atrás** en cada pregunta (botón de ícono arriba a la izquierda) y contador discreto «3 de 10»; sin lista de etapas ni círculos de avance.
- **Pantalla dividida con línea divisoria** (`border-l` en escritorio, `border-t` en móvil): izquierda el archivo, derecha la pregunta, todo centrado vertical y horizontalmente en el espacio (`max-w-5xl`).
- **Sin barra inferior en este paso**: «Continuar a Oferta» aparece solo en la última pantalla («Todo validado»). El título de la pantalla es solo para lectores de pantalla.
- Verificado por DOM en tu servidor: una pregunta a la vez, atrás funciona, sin `footer` ni botón «Continuar» hasta el final, sin scroll horizontal; lint, `tsc`, `pnpm test` (923).
- **Para revisar por Juan**: el ritmo de la animación entre preguntas y el centrado en 1280 y 375 px.

### Validación del CV: tarjeta de dos mitades (24-nov-2026, a partir de la referencia de Juan)
- La validación va dentro de **una tarjeta redondeada** (`rounded-3xl border bg-card`, solo tokens) con dos mitades: **izquierda un panel hundido** (`rounded-2xl bg-muted/50`) con el archivo (nombre, tipo, peso, lectura y avisos) y **derecha la pregunta actual con su botonería** (atrás, contador, «Es correcto» / «No es correcto»). Sin línea divisoria. En móvil la pregunta va primero y el archivo debajo.
- Verificado por DOM: archivo a la izquierda, ambas mitades de igual altura, sin scroll horizontal en 1280 y 375 px.

### Validación del CV: lado derecho (24-nov-2026)
- **Título de la pregunta** a `text-xl font-medium` (20 px, peso 500): es el tope de la escala de CLAUDE.md (nada sobre `text-xl`, pesos 400/500). Más «bold» (600+) exigiría cambiar esa regla.
- El contador «1 de 20» se reemplazó por el **`ProgressLine` de la app** (spinner + nombre de la etapa + porcentaje, alineado a la izquierda; el porcentaje es etapas validadas / total). Cada pregunta entra y sale de lado a lado con blur + movimiento horizontal, y el nombre de la etapa cambia con el blur + desplazamiento propio de `ProgressLine`.
- Verificado por DOM: título 20 px / 500, spinner y porcentaje presentes (0 % → 10 % al confirmar); lint, `tsc`, `pnpm test` (923).

### Validación del CV: respuesta grande, pregunta pequeña (24-nov-2026)
- Se invirtió la jerarquía: el **dato leído** va grande (`text-xl font-medium`; `text-base` si es muy largo, como un resumen) y la **pregunta** pequeña y atenuada (`text-sm text-muted-foreground`) encima. La mitad derecha usa más espacio: más alta (`min-h-112`) y con más relleno (`md:p-10`). lint, `tsc` y pruebas del paso en verde.

### Validación del CV: estructura en los extremos (24-nov-2026, referencia de Juan)
- La mitad derecha se estructura en **tres zonas**: arriba la **pregunta** (pequeña), en medio la **respuesta** (grande) o el editor, y abajo una barra con **a la izquierda «atrás» y el avance en SIEMPRE 3 puntos** (primero al inicio, último al final, en medio el resto; `role="progressbar"` con «Pregunta N de M») y **a la derecha la botonería**: «No es correcto» (secundario) + «Es correcto» (principal); si falta el dato, «Omitir» + «Agregar»; al editar, «Quitar del CV» (solo experiencias/estudios) + «Cancelar» + «Guardar y seguir» (enviado con `form=`); en la última pantalla, «Continuar a Oferta».
- Se quitó el spinner/porcentaje. La barra de abajo no se anima; solo entra y sale el contenido de arriba (blur + desplazamiento lateral). Los campos obligatorios usan `required` del navegador.
- Verificado por DOM: puntos ●○○ → ○●○, editar el rol desde el pie, «atrás» conserva el cambio; lint, `tsc`, `pnpm test` (923).

### Validación del CV: título fijo, pregunta junto a la respuesta, spinner con avance (24-nov-2026)
- **Arriba, fijo** (no se anima): título «Revisa lo que leímos de tu CV» + subtítulo que explica qué hacer (confirmar con el tick o corregir con la equis). **En medio**, la pregunta pequeña pegada a su respuesta grande. **Abajo a la izquierda**, el `ProgressLine` (spinner + nombre de la etapa + porcentaje que sube al validar; «Listo» al final) en lugar de los 3 puntos; a la derecha, la botonería.
- Verificado por DOM (0 % → 10 % al confirmar), lint, `tsc`, `pnpm test`.

### Validación del CV: anillo de avance que se llena (24-nov-2026)
- El indicador de abajo a la izquierda ya no es el spinner que gira solo: es el **anillo de avance** `components/cv/progress-ring.tsx` (mismo tamaño y trazo que el spinner) que **se llena a medida que la persona valida cada etapa**, con el nombre de la etapa (cambia con blur + desplazamiento) y el porcentaje. `role="progressbar"`; con «reducir movimiento» el arco salta sin animar.
- Verificado por DOM: 0 % → 30 % tras tres confirmaciones, arco en 0,3 de 1, sin animación de giro. lint, `tsc`, `pnpm test` (923).

### Afinidad ATS del CV subido, en la validación (24-nov-2026)
- Un **badge arriba de la tarjeta del archivo** (panel izquierdo) muestra «Afinidad con ATS · N %»: el formato del archivo ORIGINAL que subió la persona, medido con el mismo verificador de la versión ATS (`verifyAtsFile`, 42 reglas de formato; los consejos de contenido no restan). Mientras se mide, «Midiendo afinidad con ATS» con spinner. Es destacado (relleno) cuando la etiqueta es «listo» o «casi»; si no, es de contorno.
- Nueva acción `original` de `POST /api/ats` (`fileId`, `fileName`, `cv`, `sourceText`): lee el archivo de `data/uploads` (solo `.pdf` y `.docx`; el id se valida con `STORED_ID_RE`) y devuelve `{ percent, label, labelText }`. Para otros formatos (txt, imágenes, doc, odt, rtf) devuelve `percent: null` y **no se muestra el badge**; tampoco en adaptaciones reabiertas (no traen archivo). Cliente: `originalAtsClient` (`lib/ats/client.ts`).
- Verificado: lint, `tsc`, `build`, `pnpm test`; en tu servidor con un PDF de prueba → «Afinidad con ATS · 85 %».
- Aclaración honesta: el porcentaje mide **formato** (texto seleccionable, columnas, secciones, contacto…) según guías públicas; no garantiza que un ATS concreto lo acepte (así lo dice el tooltip del badge).

### Un solo CV, progreso guardado y «Omitir» (24-nov-2026, QA de Juan)
- **Un solo CV.** El que se sube pasa siempre a ser el perfil de búsqueda (antes solo el primero) y **se guarda con los datos del archivo** (`file`: nombre, tipo, peso, lectura; `validatedAt`; `originalAts`). «Quitar» desapareció del panel «Mi CV» de las ofertas; allí queda «Cambiar CV» con confirmación, que borra el CV y lleva al inicio para subir y **validar** el nuevo. Con un CV cargado, arrastrar otro archivo al panel ya no lo reemplaza (solo avisa); sin CV, el panel sigue permitiendo subirlo. El panel muestra «CV validado» o «Sin validar» con el botón «Validar mi CV» (enlace al inicio).
- **Es el mismo CV** en el asistente y en las ofertas: el asistente arranca del CV guardado (`fromSearchProfile`) y cada corrección de la validación actualiza ese perfil, así que lo que se valida es lo que se compara con las ofertas.
- **Recarga a mitad de la validación**: el navegador muestra su aviso de «¿Salir de la página?» (`beforeunload`; no deja personalizar el texto, por eso no dice «perderás tu progreso»). Si se recarga de todos modos, se **retoma el CV guardado con sus correcciones**, pero el avance de las preguntas vuelve a empezar.
- **Recarga con la validación terminada**: no hay aviso y se muestra, centrada, la tarjeta del CV (con el badge de afinidad ATS guardado) y el botón «Continuar a Oferta» (`components/cv/validated-cv.tsx`). También al volver desde el paso 2.
- **«Omitir»**: botón gris casi imperceptible abajo del todo en la validación; pasa al paso de oferta y deja el CV «sin validar».
- Verificado: lint, `tsc`, `build`, `pnpm test` (925); en tu servidor: guardado del archivo, aviso al recargar, retoma tras recargar, validar todo → marca guardada → recarga muestra la tarjeta con «Afinidad con ATS · 85 %» → continuar; panel «Mi CV»: «CV validado», «Cambiar CV», sin «Quitar».
- **Pendiente (siguiente fase, 2 de la lista de Juan)**: generar un CV por oferta en formato ATS (≥ 90 %) y adaptado a lo que pide la oferta, y guardarlo en el repositorio.

### Fase: un CV ATS por oferta (24-nov-2026)
- **Motor** `lib/ats/tailor.ts` (`tailorCv`): adapta el CV validado a la oferta **solo ordenando** (habilidades y grupos que la oferta nombra primero; en cada experiencia, los logros más relevantes primero). No quita, agrega ni reescribe nada; las experiencias siguen en orden cronológico inverso. Usa los términos de la oferta (`buildTerms`) y la coincidencia léxica con sinónimos del motor de encaje.
- **API** `POST /api/ats` acción `tailor` (`cv`, `offer`, `sourceText?`, `extras?`): adapta, arma el PDF y el Word (`generateAts`), **los verifica con el mismo verificador** y devuelve `percent` (formato ATS, peor de PDF/Word), `meets90`, cobertura léxica de la oferta, cuánto se reordenó, páginas y los archivos. Sin lectura profunda previa no corre IA (rápido); con ella, la usa.
- **UI** `components/steps/tailored-ats.tsx`, arriba del último paso («Tu CV adaptado»): botón «Generar CV ATS para <empresa>», badges «Formato ATS · N %» (relleno si ≥ 90) y «Cobertura de la oferta · N %», nota de lo reordenado y los archivos PDF/Word como `Attachment`. Al generarlo **se guarda en el repositorio de CV por oferta** (uno por oferta: generarlo de nuevo reemplaza el anterior; `ats` nuevo en el historial).
- **Repositorio** (popover): las entradas ATS muestran «ATS N %» y su botón de descarga rearma el PDF ATS desde el CV guardado.
- Medición real: CV de ejemplo + oferta → 100 % de formato ATS (1 página), cobertura 50 %, 2 habilidades y 2 logros reordenados. Pruebas: 933 (motor, ruta real, repositorio, componente).
- **Límite honesto**: reordenar sube la prominencia de lo que la oferta pide, pero **no sube la cobertura** (no agrega palabras que el CV no tenga); la cobertura la mejoran los cambios aceptados en la revisión. No se verificó aún en el navegador el paso final completo (requiere analizar una oferta con la IA local y revisar cambios): se probó la ruta real con el servidor y el componente por separado.
- Falta (siguientes pasos posibles): generarlo automáticamente al terminar el análisis de cada oferta (sin pasar por la revisión) y desde el buscador de ofertas.

### CV ATS desde el detalle de cada oferta (24-nov-2026)
- En el **detalle de una oferta** del buscador (si hay CV cargado) aparece el mismo bloque «CV ATS para esta oferta» (`TailoredAts`): un clic genera, verifica y guarda en «Tus CV por oferta» el CV en formato ATS adaptado a esa oferta, **sin pasar por el asistente ni la revisión**. Si el CV no está validado, una nota lo avisa. El guardado se comparte con el asistente en `lib/ats/save-entry.ts` (`saveAtsEntry`, uno por oferta).
- Verificado en tu servidor con una oferta real del buscador: «Formato ATS · 100 %», PDF de 1 página, entrada guardada en el historial con `ats: { percent: 100 }`. lint, `tsc`, `build`, `pnpm test`.
- Nota: la cobertura de la oferta salió 0 % porque el CV de prueba (diseño de producto) no coincide con esa oferta; reordenar no la sube (ver la fase anterior).
- Siguiente natural: reescrituras del resumen con la oferta delante, verificadas contra el CV, para subir la cobertura sin inventar.

### Resumen orientado a la oferta (24-nov-2026)
- `generateSummary` acepta `focus` (el cargo de la oferta): el modelo recibe las habilidades YA ordenadas por relevancia y se le pide priorizar lo que respalda ese cargo, sin nombrarlo ni la empresa. Sigue el mismo verificador anti-invención (cifras, empresas, herramientas, siglas); solo se acepta como dato nuevo los años calculados de las fechas.
- `POST /api/ats` `tailor` con `adaptSummary: true`: si el resumen nuevo pasa, reemplaza al del CV en ESE CV ATS; si no hay IA o no pasa, se conserva el validado y se avisa. La respuesta trae `summary { adapted, text, reason, hits }` (`hits` = lo que pide la oferta y el resumen ya dice).
- UI (`TailoredAts`): interruptor «Adaptar el resumen a la oferta» (activado por defecto); al terminar se muestra el resumen propuesto, lo que menciona de la oferta y el aviso de revisarlo.
- Medición real (CV de ejemplo, gemma4:e4b local): 17 s en frío y 2 s con el modelo ya cargado; formato 100 %. Cobertura sin cambios (50 %), como se explicó: un resumen verificado no puede agregar términos que el CV no tenga.
- Limitación vista: el verificador no detecta relaciones plausibles entre datos reales («Jira para la gestión de proyectos» salió sin que el CV lo diga); por eso se muestra el resumen para que la persona lo revise.

### Revisión del resumen antes de guardar (24-nov-2026)
- Si la IA propone un resumen para la oferta, `TailoredAts` muestra «Tu resumen» y «Resumen propuesto para esta oferta» y **no guarda nada hasta que la persona elige**: «Usar este resumen» (guarda el CV con ese resumen) o «Dejar el mío» (vuelve a armar el CV con el resumen validado, sin IA). Si el resumen no pasa la verificación, se guarda directo con el tuyo y se avisa.
- Verificado: lint, `tsc`, `build`, `pnpm test`; en el navegador, con una oferta real, el camino «la IA no logra un resumen válido» (4 de 4 intentos → se conserva el tuyo, formato 100 %, guardado). **El camino de elegir entre los dos resúmenes no se pudo ver en el navegador**: con esa oferta la IA local no produjo un resumen que pasara la verificación; la ruta sí lo hizo con otra oferta (curl).

### Pantalla del CV ya validado: sello y mensaje (24-nov-2026)
- Arriba de la tarjeta del archivo: **sello sólido de check** (`BadgeCheckIcon`, relleno con `foreground` y el check con `background`, 48 px) y el mensaje «Tu CV se subió y se analizó sin problemas» + «Ya validaste tus datos. Con este CV comparamos las ofertas y armamos tus CV para cada una.». Después, el badge de afinidad ATS, la tarjeta y «Continuar a Oferta». Verificado por DOM (icono 48 px, relleno claro y check oscuro; sin scroll horizontal).
