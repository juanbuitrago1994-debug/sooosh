# Plan de fases

Cada fase cumple además la **definición de terminada** de CLAUDE.md (lint, tsc, build, test). La revisión visual (capturas, claro/oscuro, 375/768/1280) **la hace Juan**; cada fase deja una lista «Para revisar por Juan» en `docs/STATUS.md` con las pantallas y estados exactos a mirar. Yo no tomo capturas ni ejecuto `pnpm shots`/`pnpm a11y` salvo petición expresa.

Fases 1–2 (subida y extracción del CV, perfil editable) ya existen en el código.

## Fase 2.1 — Corrección de UI
- [x] `pnpm dlx shadcn@latest add --all` ejecutado; `components/ui/` contiene sidebar, empty, field, sonner, progress, etc.
- [x] Fuente sans cargada con `next/font` y aplicada: `getComputedStyle(body).fontFamily` incluye "Geist" (no serif/Times). `--font-sans` en `globals.css` ya no se referencia a sí misma.
- [x] Layout con `SidebarProvider` + `Sidebar` + `SidebarInset`; en móvil la barra lateral es un `Sheet` abierto con `SidebarTrigger`.
- [x] Pasos del wizard en el Sidebar; progreso con `Progress`.
- [x] Estados vacíos con `Empty`; formularios con `Field`/`FieldGroup`/`FieldLabel`/`FieldError`; avisos con Sonner.
- [x] `grep -rnE "\[[0-9.]+(px|rem|%)\]|#[0-9a-fA-F]{3,6}\b|(bg|text|border)-(red|blue|green|gray|slate|zinc)-" app components --include=*.tsx` (excluyendo `components/ui`) no devuelve nada (ampliado: también `-\[` y `\[(excluyendo `components/ui`) no devuelve nada`).
- [x] Sin scroll horizontal a 375, 768 y 1280 (`scrollWidth <= innerWidth`, comprobado en el script de capturas).
- [x] Capturas de los 5 pasos (o de los que sean alcanzables) en 3 anchos × 2 temas revisadas.

## Fase 3 — Oferta por texto o URL
- [x] Paso "Oferta" con `Tabs`: "Pegar texto" / "Desde URL".
- [x] Ruta `POST /api/offer` que acepta `{ text }` o `{ url }`; con URL descarga el HTML en servidor, extrae el texto principal (sin servicios de pago) y lo devuelve.
- [x] Errores en español: URL inválida, sitio que requiere login, respuesta vacía → mensaje claro y opción de pegar texto.
- [x] Ollama extrae a un esquema Zod `Offer` (título, empresa, requisitos, deseables, responsabilidades, idioma); tests con fixtures de al menos 3 ofertas (texto y HTML).
- [x] La oferta es editable antes de continuar; no se avanza con texto < 200 caracteres.
- [x] Tests unitarios del extractor y del esquema en verde.

## Fase 4 — Motor de palabras clave y cobertura
- [x] Módulo puro `lib/keywords` (sin IA): normaliza (minúsculas, tildes, plurales simples) y detecta términos y frases de la oferta.
- [x] Función `coverage(cv, offer)` devuelve porcentaje, términos cubiertos y faltantes, con la sección del CV donde se encontró cada término.
- [x] Sinónimos/equivalencias básicas es/en (p. ej. "gestión de proyectos" ↔ "project management") en una tabla versionada.
- [x] Paso "Análisis": `Progress` de cobertura, lista de cubiertas y faltantes (con `Badge`), `Empty` si no hay oferta.
- [x] Tests: ≥ 15 casos, incluidos tildes, plurales, frases y falsos positivos. Determinista: misma entrada → misma salida.
- [x] Los faltantes se marcan "solo añadir si el usuario lo confirma" (no se agregan solos).

## Fase 5 — Reescritura con diff y verificador anti-invención
- [x] Ollama reescribe resumen y viñetas para la oferta con salida estructurada (Zod); solo puede reordenar, reformular y resaltar lo existente.
- [x] Verificador `verifyNoInvention(original, rewritten)` determinista: cada cifra, fecha, empresa, título y herramienta del texto nuevo debe existir en el CV original; si no, la reescritura se rechaza y se reintenta (máx. 2) o se conserva el original.
- [x] Tests del verificador con casos que inventan (número nuevo, tecnología nueva, empresa nueva) → deben fallar; casos legítimos → pasan.
- [x] Paso "Revisión": diff por viñeta (original vs. propuesta) con aceptar/rechazar/editar por cambio; la salida final solo incluye lo aceptado.
- [x] Estados de carga con `Skeleton`/`Progress`; error de Ollama no disponible con mensaje en español y pasos para iniciarlo.

## Fase 6 — Plantilla PDF con Playwright
- [x] Plantilla HTML/CSS de CV de 1–2 páginas A4, legible, apta para ATS (texto seleccionable, una columna, sin imágenes de texto).
- [x] Ruta `POST /api/export` genera PDF con Playwright (Chromium local) desde el CV aceptado.
- [x] Paso "Exportar": vista previa y botón "Descargar PDF"; nombre de archivo `CV-<nombre>-<empresa>.pdf`.
- [x] Test: el PDF generado tiene ≥ 1 página, el texto extraído (unpdf) contiene el nombre y el primer cargo del CV de fixture, y ningún texto ausente del CV original.
- [x] Vista previa y descarga funcionan a 375, 768 y 1280.

## Fase 7 — Pulido e historial (PUNTO DE CONTROL: reemplazada por el cambio de rumbo, ver abajo)
- [x] Historial local (`localStorage`, sin servidor) de adaptaciones: oferta, fecha, cobertura antes/después, PDF regenerable. (`lib/history.ts`, 8 tests)
- [x] Lista de historial con `Empty`, borrar (con confirmación) y reabrir. (Estaba en el Sidebar; la Fase A la mueve a un diálogo.)
- [ ] Revisión de accesibilidad: foco visible, `aria-label` en español, contraste en ambos temas, navegación por teclado completa. (Avanzada: `pnpm a11y` con axe + teclado; textos en inglés de shadcn traducidos, enlace "Saltar al contenido", foco al cambiar de paso, landmarks y encabezados corregidos. La última corrida llegó a 1 fallo de contraste antes de detenerla; se retoma sobre la nueva UI.)
- [x] Manejo de errores global (`error.tsx` con `retry`, `global-error.tsx`, `not-found.tsx`) en español.
- [ ] README real (hecho) y verificación desde cero (`rm -rf .next node_modules && pnpm i`). Pendiente: no se hizo la instalación limpia (habría roto tu `pnpm dev`; se hará en un clon aparte).
- [ ] Capturas finales de todos los pasos e historial. (Pendiente: la UI cambia por completo en la Fase A.)

---

# Cambio de rumbo: flujo "zero-input"

Objetivo: el usuario sube su CV, pega una oferta y un pipeline de IA local analiza, cruza y reescribe. El usuario solo aprueba o rechaza decisiones puntuales, y la IA aprende de ellas (memoria de preferencias, **no** entrenamiento del modelo). Reglas: costo cero (solo Ollama local), UI en español, nunca inventar datos del candidato, solo componentes y tokens de shadcn (excepción única: los componentes de movimiento de `components/ai/`). Fuente de verdad visual: `docs/DESIGN-PATTERNS.md`. Cada fase termina con lint, tsc, build y test en verde, capturas a 375/768/1280 en claro y oscuro revisadas y comparadas con `docs/referencias/`, un commit y STATUS.md actualizado.

## Fase A — Referentes, base de UI minimalista y movimiento
- [x] A1. `docs/DESIGN-PATTERNS.md` escrito tras leer las 4 referencias: patrones recurrentes, principios, traducción a shadcn y "no hacer".
- [x] A2. Sin `Sidebar` ni paneles secundarios (`components/ui/sidebar.tsx` y `components/wizard/app-sidebar.tsx` fuera del uso). Shell = stage centrada con una tarjeta compacta; indicador de progreso mínimo en segmentos (`aria-current="step"`); en móvil la tarjeta ocupa el ancho con márgenes; sin scroll horizontal a 375/768/1280.
- [x] A2. Una sola acción primaria visible por pantalla (comprobable: un único `Button` variante default por pantalla en las capturas).
- [x] A2. Tema con acento aplicado por el mecanismo oficial (`registry:theme` en `docs/theme-cv-tailor.json`, añadido con `shadcn add`); `primary`, `accent` y `chart-*` en violeta; sin colores sueltos (grep limpio).
- [x] A2. `Spinner`/`Skeleton`/`Progress` solo mientras la IA trabaja: no queda ningún `Progress` decorativo (cabecera, cobertura, "revisados").
- [x] A3. Paquete `motion` instalado. Componentes `AiAura` (luz ambiental lenta; **reemplaza al haz `AiBeam`, que Juan descartó por llamativo**), `ThinkingTicker` (mensaje palabra por palabra controlado por el paso real del pipeline), `AiStage` (activa aura + ticker + `Spinner` + atenuado/blur sutil con un estado "trabajando") y `StepTransition`, documentados en `components/ai/README.md`.
- [x] A3. Reglas de motion cumplidas: solo opacity/blur/translate (tests: sin `scale`, sin giros ni bordes animados), `prefers-reduced-motion` respetado (test + comprobación real con Playwright), constantes de duración/easing únicas en `lib/motion.ts`.
- [x] Tema oscuro **neutro** (negros sin tinte azul) con el acento violeta usado con moderación; el tema claro conserva grises fríos.
- [x] A3. `AiStage` integrado en los estados reales de IA existentes (leer CV, analizar oferta, reescribir); el ticker avanza con los grupos reales de la reescritura.
- [ ] Capturas y revisión visual: **la hace Juan en la app** (decisión del 16-nov-2026; ver CLAUDE.md). Las capturas de la primera versión sí se revisaron contra las referencias.

## Fase B — Limpieza de oferta por URL o texto
- [x] Pipeline en capas: (1) extracción determinista (JSON-LD `JobPosting`, selectores por sitio para LinkedIn e Indeed —y Greenhouse, Lever, Workable, Computrabajo—, Readability como respaldo); (2) limpieza con LLM local y salida estructurada que devuelve solo el contenido propio de la oferta (sin comentarios, reacciones, navegación ni publicidad); (3) guardia anti-invención: toda frase de la salida existe en el texto fuente; lo que no, se descarta y se informa.
- [x] Esquema Zod de oferta: título, empresa, idioma, seniority, años de experiencia, requisitos obligatorios, deseables, herramientas, soft skills, responsabilidades, idiomas exigidos.
- [x] 6 fixtures (LinkedIn publicación con hilo de comentarios —HTML y texto pegado—, LinkedIn empleo, Indeed, artículo genérico, JSON-LD, texto) y test de que los comentarios **no pasan** (extracción, limpieza y prueba real con Ollama).
- [ ] Las 3 ofertas reales de `~/Projects/cv-tailor-material`: la carpeta estaba **vacía** el 16-nov-2026. `tests/offer-material.test.ts` las detecta solas (.txt, .md, .html) cuando existan.
- [x] Si la URL exige sesión: mensaje claro pidiendo pegar el texto (401/403/999, rutas de login, texto de login).

## Fase C — Perfil: de formulario a diagnóstico automático
- [x] Se elimina el formulario de campos y el panel "Texto original" como paso obligatorio.
- [x] Al subir el CV, el pipeline produce un diagnóstico (idioma, secciones y orden, estilo —tono, persona, tiempos, viñetas, métricas—, seniority, fortalezas, problemas, riesgos ATS) en una tarjeta compacta de solo lectura; acción opcional "Corregir"; como máximo UNA pregunta dirigida si la confianza de un dato clave es baja.
- [x] Rendimiento: capa de texto del PDF primero y OCR solo si no hay texto; `stream: true` y `keep_alive` en Ollama; llamadas pequeñas con esquema estricto; tiempos por etapa medidos y registrados. Objetivo < 60 s para un CV típico (o explicación escrita de por qué no).
- [x] El CV original se guarda como fuente de verdad inmutable para la guardia anti-invención.

## Fase D — Matching y análisis de brecha
- [x] Los términos salen del esquema estructurado de la oferta (no de n-gramas): desaparece la basura tipo "shows", "fine", "around" (test de regresión).
- [x] Matching semántico entre idiomas con embeddings locales (bge-m3 vía Ollama; respaldo nomic-embed-text con traducción por LLM) + coincidencia léxica; cobertura ponderada (obligatorio > deseable) con explicación por término: cubierto, cubierto con otro nombre o ausente.
- [x] Salida en tres grupos: ya tiene fit / se puede reformular con evidencia del CV / no existe en el CV (brecha; jamás se inventa).

## Fase E — Reescritura, revisión por decisión y aprendizaje
- [x] Pipeline automático que propone cambios por sección (quitar, cambiar, añadir), conservando idioma y estilo del CV salvo que la oferta pida otro idioma.
- [x] Cada cambio trae original, propuesta, motivo y **evidencia** (fragmento exacto del CV fuente); sin evidencia no se propone. Verificador anti-invención automático.
- [x] Pantalla de revisión: una tarjeta por cambio, aceptar / rechazar / editar, atajos de teclado visibles (`Kbd`), "Aprobar todos los de bajo riesgo".
- [x] Aprendizaje: cada decisión (tipo, sección, original, propuesta, decisión, texto editado, motivo opcional) se guarda en SQLite con Drizzle (local). Cada N decisiones el LLM resume reglas de preferencias que se inyectan en el prompt junto con pocos ejemplos aceptados/editados.
- [x] La interfaz y el README aclaran que es **memoria de preferencias, no entrenamiento del modelo**. Panel mínimo "Lo que he aprendido": reglas visibles, editables y reiniciables.

---

# Tanda 2: rendimiento, ofertas, explicabilidad y journey de un clic

Objetivo: flujo de un clic, IA 100 % local y costo cero, con la persona solo aprobando o rechazando. Reglas: solo shadcn; movimiento solo opacity/blur/translate (los componentes de IA de `components/ai/` son la única excepción visual; el haz `AiBeam` se sustituyó por `AiAura` a pedido de Juan); español; nada de datos inventados. **Todo dato de rendimiento citado sale de una medición propia registrada en `docs/BENCHMARKS.md`.** Cada fase: lint, tsc, build y test en verde, un commit y STATUS.md con «Para revisar por Juan» (comparar con `docs/DESIGN-PATTERNS.md` lo hace Juan); luego se detiene (siguiente con `/siguiente-fase`).

## Fase F — Rendimiento y banco de pruebas
Metas (hipótesis a medir): perfil < 60 s (hoy 11 s sin OCR y 212 s con la versión original), oferta < 20 s, primer cambio de la reescritura < 15 s.
- [x] Modelo siempre cargado: `keep_alive` 60 min en todas las llamadas y **precarga al abrir la app** (`/api/warmup`).
- [x] Prefijo estable: prompts ordenados como instrucciones+esquema fijos → texto del CV → tarea variable; **medido** el efecto (2.ª llamada vs 1.ª) y documentado.
- [~] `num_ctx` por etapa **medido** (cambiar `num_ctx` recarga el modelo: se compara contra un contexto único) y caché KV `q8_0` **evaluada** (se adopta solo si la calidad en el banco no empeora; si requiere reiniciar Ollama, se documenta y no se adopta sin aprobación).
- [~] Texto antes que OCR; si hay OCR, por página, en paralelo con límite, con el tiempo reportado (medido con `scanned.pdf`).
- [x] Llamadas pequeñas con esquema estricto; modo de razonamiento desactivado (`think:false`) donde exista, **verificado** con el comportamiento real.
- [x] Caché de resultados por huella (hash del archivo del CV y del texto de la oferta), versionada por modelo, prompt y esquema; una 2.ª lectura del mismo CV tarda < 1 s (test + medición).
- [x] `pnpm bench`: 3 CVs × 3 ofertas × 3 modelos (qwen2.5:7b-instruct, gemma4:e4b y un Qwen 3.5 ~9B con la etiqueta confirmada en la biblioteca de Ollama), tiempo por etapa, puntaje de calidad (esquema válido + guardia anti-invención) y `ollama ps` (motor/procesador) por modelo.
- [x] `docs/BENCHMARKS.md` con tabla de tiempos y calidad; **sin cambiar el modelo por defecto**: propuesta con números en STATUS.md para aprobación de Juan. Sin decodificación especulativa.

Notas: `[~]` = parcial. `num_ctx`: medido y fijado en 8192; caché KV q8_0 NO evaluada (requiere reiniciar Ollama; pendiente de aprobación). OCR: texto antes que OCR y reconocimiento de encabezados con erratas medidos; paralelismo por página implementado pero sin medir ganancia (el fixture tiene 1 página). Meta «primer cambio < 15 s»: no medida aún.

## Fase UI-2 — Rediseño v2 (se inserta antes de la Fase G)
Referente: `docs/referencias/ui5ref-5.jpg`, sintetizado en `docs/DESIGN-PATTERNS.md` §v2 (no se vuelve a abrir la imagen). Una pantalla por vez; tras cada una se detiene y espera a Juan.
- [x] Reglas de trabajo y excepciones documentadas en CLAUDE.md; requisito de capturas revisadas por Claude eliminado.
- [x] Sección v2 en DESIGN-PATTERNS.md.
- [x] Fundamentos: `AmbientBackground`, `GlassPanel` (lista cerrada de usos), una sola familia sans, escala tipográfica, botones `h-9` de radio completo con área táctil de 44 px.
- [x] Pantalla 1 — **Entrada** (sin Card, sin borde punteado, soltar en toda la página, estado con matriz de puntos suelta).
- [ ] Pantalla 2 — Oferta · [ ] Pantalla 3 — Análisis (línea de tiempo en `GlassPanel`) · [ ] Pantalla 4 — Revisión (tarjeta de cambio en `GlassPanel`) · [ ] Pantalla 5 — Exportar · [ ] Historial, aprendizaje y diálogos. Cada una solo tras el visto bueno de Juan.

## Fase K — Análisis profundo, cambios aceptables y vista previa de descarga (PRIORIDAD: va antes que G y H; 18-nov-2026)
Motivo (Juan): la app debe analizar a fondo el CV subido y la oferta, mostrar en qué aspectos hacen fit (descripción, habilidades técnicas y transversales, herramientas, historial laboral y educativo, estructura), proponer cambios que la persona acepta o rechaza, y entregar el CV ya ajustado. **Se descarta** generar un PDF idéntico al que subió la persona: se analiza todo su contenido y se reconstruye con una plantilla propia limpia.
- [x] K1. Rúbrica y criterios: `docs/RUBRICA.md` + `lib/analysis/rubric.ts` (9 dimensiones, pesos, criterios con tipo de comprobación, ficha con evidencia textual obligatoria y verificador anti-invención) + tests.
- [x] K2. Oferta enriquecida (`lib/analysis/offer-profile.ts`, sin IA, determinista): obligatorio/deseable/contexto, categoría (herramienta, técnica, transversal, certificación, idioma, educación, función, dominio), peso por necesidad × énfasis × repetición, años por habilidad, frase exacta tipo ATS, rol, seniority y años, educación, certificaciones y dominios. Normalización con taxonomía local curada (`lib/taxonomy/skills.ts`, ~190 alias; **no** es una importación de ESCO/O*NET: el formato permite cargarlas después).
- [x] K3. Perfil del CV por secciones (`lib/analysis/cv-profile.ts`, sin IA, determinista): contacto, resumen (clichés con cita literal, años mencionados), puestos con duración y recencia, huecos de más de 6 meses, cronología, años totales sin solapes, viñetas (cifras reales sin contar años, verbo de acción, tareas, longitud), habilidades en contexto vs solo en lista, educación, idiomas, secciones y extensión estimada. Todo lo señalado lleva texto literal del CV.
- [x] K4. Motor de fit multicapa (`lib/analysis/fit.ts`, `judge.ts`): la FICHA de 9 dimensiones con hallazgos por criterio (no un % suelto). Capas: cobertura por alias de taxonomía + léxico + capa semántica opcional del matching existente (herramientas/idiomas/certificaciones nunca por parecido); calidad de la evidencia (en contexto vs solo en lista, logros con cifras); seniority, años y recencia; estructura/ATS; criterios cualitativos con juez local de una sola llamada (citas literales verificadas). Mismo motor antes y después (`fitDelta`). Conjunto de referencia (`tests/fixtures/fit-cases.ts`: 1 oferta × 3 CV) + `bench/fit-judge.test.ts` contra el Ollama real (resultados en `docs/BENCHMARKS.md`).
- [x] K5. Cambios atómicos (`lib/changes/`, `POST /api/changes`): 9 tipos (resumen, viñeta, quitar relleno, habilidad, reordenar habilidades, reordenar viñetas, reordenar secciones, titular, brecha), cada uno con criterio de la rúbrica, motivo, evidencia literal, riesgo y **efecto recalculado con el mismo motor de fit** (se aplica solo ese cambio). Reordenar/titular/brechas son deterministas y nunca añaden contenido: las brechas se PREGUNTAN a la persona (aceptar sin escribir no cambia nada). `CV.sectionOrder` nuevo y respetado por la plantilla del PDF. Memoria por tipo: 3 rechazos sin ninguna aceptación bajan la prioridad (nunca ocultan). Nuevo criterio `tec-ubicacion` (lo importante se ve primero). La interfaz de revisión se rediseña en K8.
- [x] K6. Reconstrucción y ciclo de calidad. `lib/rebuild/build.ts` (`rebuildCv`, `POST /api/rebuild`): parte del CV original y aplica SOLO lo aceptado; verifica cada texto del modelo contra la fuente (si no pasa, se excluye y se avisa), comprueba integridad (empresas, puestos, fechas, contacto, educación no cambian) y verifica el CV completo; lo que la persona escribe se permite y se marca «escrito por ti»; informe con resultado por cambio y mejora de la ficha por dimensión. `lib/rebuild/improve.ts` (`improveWeak`, `POST /api/improve`): antes de la revisión, regenera SOLO las propuestas de texto cuyo efecto no mejora la ficha (máx. 2 rondas, con verificador), descarta las que la empeoran y deja las neutras con prioridad baja; nunca toca lo ya aceptado. Medido en `docs/BENCHMARKS.md`.
- [x] K7. Vista previa del CV final y descarga a elección: PDF, Word (.docx), texto plano (variante ATS de máxima compatibilidad) y Markdown. Modelo común (`lib/export/model.ts`) que respeta `CV.sectionOrder`; formatos en `lib/export/formats.ts`; `POST /api/export` con `format`. El paso Exportar (UI v2) muestra el resumen de lo aplicado, el encaje antes→después y la vista previa del formato elegido. Plantilla única, sin copiar el diseño original.
- [ ] K8. Journey: Entrada → Oferta → Análisis (ficha) → Revisión (cambios) → Vista previa y descarga, con el marco UI v2; rediseño de las pantallas 2–5 a medida que cada pieza exista.
Orden: K1→K8, una por vez; se detiene al terminar cada paso y espera `/siguiente-fase` o indicación de Juan. Los rediseños de pantalla se pausan hasta K4.

## Fase G — Pipeline orquestado y trabajo anticipado
- [ ] Orquestador con etapas explícitas (lectura, diagnóstico, oferta, matching, reescritura) que emite eventos de progreso reales por SSE; esos eventos alimentan `ThinkingTicker`/`AiAura`; cero mensajes con temporizador (test por código).
- [ ] Trabajo anticipado: el diagnóstico arranca al subir el CV mientras se consigue la oferta; la limpieza de la oferta arranca al pegarla, sin otro clic (medido: tiempo hasta tener ambos resultados vs secuencial).
- [ ] Un solo LLM generativo a la vez, con cola (test: nunca 2 generaciones concurrentes); embeddings pueden ir en paralelo; cancelación limpia (test).
- [ ] Reintentos acotados y errores recuperables con mensaje claro; sin fallos silenciosos (tests).

## Fase H — Cascada de extracción de ofertas
- [ ] Cascada: (1) JSON-LD; (2) APIs públicas de ATS por patrón de URL (Greenhouse, Lever, Ashby, Workable, Recruitee; endpoints **validados** antes de implementar); (3) registro de plantillas por sitio, un archivo por portal (LinkedIn e Indeed; `docs/portales.md` si existe); (4) Readability; (5) limpieza LLM + guardia con fixtures de cada fuente nueva.
- [ ] Plan B cuando el sitio bloquea: bookmarklet hacia la app local (token de un solo uso, solo localhost; alternativa portapapeles) y lectura de captura pegada con modelo multimodal local (Gemma 4) con OCR de respaldo; **probados y reportado cuál funciona en Safari**.
- [ ] Límites éticos: una URL por petición explícita, sin proxies rotativos, sin evadir bloqueos ni inicios de sesión.
- [ ] Cada extracción registra la capa que respondió y un puntaje de integridad (título, requisitos, responsabilidades); si es bajo, la interfaz lo dice y ofrece pegar el texto.

## Fase I — Fit, plan de ajuste y explicabilidad
- [ ] Puntaje en 3 capas, mismo motor antes y después: cobertura ponderada, evidencia (logro concreto > lista de habilidades), claridad/ATS.
- [ ] Reglas de reescritura: traducir lo que el CV demuestra, presupuesto de cambios 10–20 % del CV, resumen con fórmula, viñetas logro-acción-resultado, cada palabra clave una vez y en contexto.
- [ ] Ciclo de calidad: generar → verificar evidencia → volver a puntuar → regenerar solo lo débil, máx. 2 rondas.
- [ ] Tarjeta "Plan de ajuste" (diagnóstico en una frase, ≤ 3 palancas, puntaje antes/después, lo que no se toca, acción primaria "Aplicar plan").
- [ ] Tarjeta de cada cambio con diferencia resaltada, requisito que cubre, evidencia al expandir, impacto en el puntaje y riesgo.
- [ ] Brechas honestas con pregunta opcional por brecha (sí → nueva evidencia; no → fuera). La memoria de preferencias (Fase E) alimenta las reglas.

## Fase J — Journey de un clic
- [ ] 3 pantallas: Entrada (soltar CV + pegar oferta texto/enlace) → Análisis automático (termina en el Plan de ajuste) → Revisión y exportación.
- [ ] CV base guardado localmente (la zona del CV viene llena en visitas siguientes); el análisis arranca solo con ambas entradas; pegar/soltar en cualquier parte detecta enlace, texto de oferta o CV.
- [ ] Avance automático con confianza alta; pausa solo para decisiones. Revisión con deshacer visible (sin diálogos de confirmación) y "Aprobar los de bajo riesgo" como acción primaria.
- [ ] Exportar con un clic y copiar texto como segunda opción; historial que reabre un análisis sin repetirlo.
- [ ] Métricas locales en SQLite (tiempo hasta el primer resultado, interacciones hasta el PDF, aceptados sin editar/editados/rechazados por categoría) y una vista mínima para desarrollo.

## Fase L — Buscador de posiciones (19-nov-2026)
Objetivo: que las personas encuentren posiciones abiertas filtradas por región (LATAM, Colombia, México, Argentina, EE. UU., España…) y ordenadas por encaje con su CV. Las ofertas de LinkedIn, Indeed y otras plataformas NO se rastrean: entran de forma manual (Juan pega el enlace o el texto) o desde fuentes con API pública. Datos en Supabase (proyecto Sooosh).
- [x] L1. Cargar una oferta → tarjeta (`/admin/ofertas`, `/api/jobs/*`): enlace o texto pegado, reutiliza el pipeline de coincidencia (extracción determinista + limpieza y estructura con el modelo local con guardia anti-invención) y deduce SIN IA país, regiones, modalidad, contrato y alcance remoto (diccionario `lib/jobs/geo.ts` + JSON-LD). Juan revisa y corrige antes de guardar (`jobs` en Supabase; la misma dirección no se duplica). Solo administrador (`ADMIN_TOKEN`).
- [x] L2. Buscador público (`/ofertas`, `/api/search`): filtro por región (con selector y valor por defecto por idioma/zona horaria), búsqueda de texto sin tildes y semántica (embeddings bge-m3 en `jobs.embedding`), orden por encaje con el CV (motor de fit de K4).
- [x] L2.5. Tarjeta y detalle de oferta (UX): la tarjeta y el detalle (`/ofertas/[id]`) muestran solo los datos que existen y dicen **cómo se postula** («Se aplica en LinkedIn», «Formulario de la empresa», «Se aplica por correo», «En el sitio de la empresa», «Ver la oferta original»). Campos nuevos `apply` y `salary` en `jobs` (migración 0005).
- [x] L3. Puerto de fuentes (`lib/sources/`, `/api/sources/*`, panel «Fuentes» en `/admin/ofertas`): interfaz de adaptadores, sincronización periódica, deduplicación, vencimiento y atribución; adaptadores de Get on Board y de Greenhouse, Lever y Ashby con directorio de empresas (se registra el tablero entero al cargar un enlace de ATS). Las fuentes estructuradas se mapean sin IA y entregan su propio enlace de postulación.
- [ ] L3b. Remotas con API gratuita y condiciones (Himalayas, Jobicy, Remotive), con atribución y sin pasar las ofertas a otros agregadores.
- [ ] L4. Portales sin API (Computrabajo, Bumeran/Zonajobs, Laborum, Trabajando, Chiletrabajos…): **decisión de Juan del 19-nov-2026: se incluyen, él asume la responsabilidad**. Reglas de implementación: respetar `robots.txt` (lo que un sitio prohíbe explícitamente, como `/colombia/JobOffers/` en elempleo, no se lee), ritmo bajo con identificación clara, sin saltarse inicios de sesión ni bloqueos anti-bot, solo lo público, y enlace de postulación al original. En paralelo, pedir feeds de socio a cada portal, al SPE (CO), la BNE (CL) y el Portal Empleo (AR).
- [ ] L5. Extensión o bookmarklet para enviar a Sooosh la oferta que la persona está viendo (con su propia sesión).
- [ ] L6. Cuentas de usuario (Supabase Auth), cargas por otros usuarios con moderación, CV en almacenamiento privado, kit de postulación (respuestas listas a partir del CV).
- [ ] IA. Plan de inteligencia en el recorrido del usuario: ver `docs/PLAN-IA.md` (borrador para discutir; primero decisiones de producto: «tecnología primero», definición de «match», eventos de uso).
