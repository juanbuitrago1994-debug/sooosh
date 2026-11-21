# Plan: asistente de correo en un panel lateral (Fase P0.5, 21-nov-2026)

Paso intermedio entre lo que hay hoy (P0: varias vías por oferta) y la Fase P1 (`mailto:` directo). Es el **plan B** de P1: si abrir el correo con `mailto:` falla o se queda corto, el usuario igual sale con destinatario, asunto y cuerpo listos para copiar y pegar en su cliente de correo.

## Qué construimos
Al tocar «Por correo a …» (o «Postular por correo») en la ficha se abre un **Drawer de shadcn por el costado derecho** con 4 pasos y una barra de progreso (`Progress`) abajo. En móvil ocupa todo el ancho.

| Paso | Qué ve el usuario | De dónde sale |
|---|---|---|
| 1. Destinatario | Correo(s) de la oferta, con casilla para elegir cuál(es) | Detección mejorada (S1) |
| 2. Asunto | Campo editable, prellenado con la mejor opción | Asunto que pide la oferta (S2) o plantilla; Ollama solo para pulir |
| 3. Cuerpo | 3 propuestas, flechas «‹ 1 de 3 ›», ajustes de longitud/tono/enfoque, casilla «Incluir mi portafolio / web» | Ollama + CV + oferta (S4) |
| 4. Listo | Destinatario, asunto y cuerpo, cada uno con «Copiar»; recordatorio de adjuntar el CV | Lo elegido |

Reglas: **no se adjunta nada en la app** (el paso 4 solo recuerda adjuntar el CV desde su equipo y ofrece «Descargar mi CV»); **nunca se inventan datos del CV**; Ollama es opcional (sin él, plantilla); el usuario revisa y envía siempre; todo local.

## Ajustes del paso 3 (propuesta, para no alargar el feature)
Tres controles, todos con valores fijos (se guardan en localStorage del usuario):
1. **Longitud**: Corto (~60 palabras) · Medio (~120) · Largo (~180). Es el ajuste con más impacto real.
2. **Tono**: Cercano (cordial y empático) · Profesional (formal y sobrio, siempre de tú) · Directo (al grano). Resume tus tres ideas (empatía, profesionalismo, cordialidad) en un solo control, así no se combinan 9 variantes.
3. **Enfoque**: Experiencia · Habilidades · Motivación. Además sirve para que las 3 propuestas sean **realmente distintas** (cada una parte de un ángulo, no son la misma con sinónimos).

Más la casilla «Incluir portafolio / web» (solo si el usuario los cargó; si no, el campo queda deshabilitado con aviso). Al cambiar un ajuste se regeneran las propuestas.

## Cómo entiende la oferta (paso 3)
1. De la oferta se toman: cargo, empresa, 3–5 requisitos clave y el tono del aviso (`offer-profile` y `/api/jobs/[id]/fit` ya existen: lo que el CV cubre / lo relacionado).
2. Ollama recibe SOLO: requisitos de la oferta, **hechos del CV** (lista cerrada de habilidades, cargos, herramientas) y los 3 ajustes. Salida JSON con el cuerpo.
3. **Verificador por reglas** después de generar: toda herramienta, empresa, cifra o año del texto debe existir en el CV o en la oferta; si algo no se rastrea, se descarta esa propuesta y se usa la plantilla. Sin Ollama o con error → plantilla (la del mensaje anterior).
4. Las 3 propuestas se piden en una sola llamada (3 ángulos) para no triplicar el tiempo; hay que medir la latencia y anotarla en `docs/BENCHMARKS.md` antes de citar cifras.

## Plan de ejecución (un paso por vez; al terminar cada uno: lint, tsc, build, test)

**S0 — Contrato y reglas**
- Aprobar este plan y los ajustes. Pedir a Juan el visto bueno para sumar el panel a la lista cerrada de `GlassPanel` en `CLAUDE.md` (hoy cubre «panel lateral con el estado de las fuentes»; este sería un 6.º uso).

**S1 — Mejor detección del correo** (`lib/jobs/apply.ts`, sin IA)
- Hoy solo se detecta **un** correo, y solo si hay un verbo de postulación hasta 70 caracteres antes. Se pierden: correos sin verbo («CV a: x@y.com»), correos antes del verbo, ofuscados («x (arroba) y punto com», «x [at] y.com») y segundos correos.
- Nuevo `detectEmails(text)`: devuelve hasta 3, ordenados por puntaje (verbo de postulación cerca, palabras como «CV», «hoja de vida», «candidatos», «rrhh», «talento», «seleccion»), descartando `no-reply`, `soporte`, imágenes y duplicados. Si hay un único correo en el texto, se acepta aunque no tenga verbo.
- Se guarda en `apply.emails: { email, source: "texto" | "mailto" }[]` (el campo `apply` ya es JSON: sin migración). `apply.email` sigue siendo el principal para no romper nada.
- Pruebas con textos reales (el de Vos Consultora, ofertas con dos correos, correo ofuscado, correo sin verbo).

**S2 — Detectar el asunto pedido** (`lib/jobs/apply.ts` o `lib/jobs/subject.ts`)
- Reglas: «en el asunto», «asunto:», «con el asunto», «subject:», «indicando en el asunto», «referencia/ref.», texto entre comillas tras esas frases, códigos tipo `[REF-123]`.
- Se guarda en `apply.subject` (JSON, sin migración) al analizar la oferta (también en el analizador del administrador, editable como las otras vías).
- Pruebas con 6+ formulaciones reales; si hay duda, no se guarda (mejor vacío que equivocado).

**S3 — Panel lateral: armazón y pasos 1, 2 y 4**
- Reusar `components/jobs/responsive-sheet.tsx` si ya envuelve el Drawer. Barra `Progress` abajo con etiquetas de paso; botones «Atrás/Siguiente» ≥ 44 px; claro/oscuro; sin scroll horizontal a 375/768/1280.
- Paso 1: lista de correos con casilla; paso 2: `Input` con asunto detectado/plantilla («Postulación: {cargo} – {nombre}»); paso 4: resumen con «Copiar» por bloque (+ toast de Sonner) y «Descargar mi CV».
- Cambiar el botón «Por correo a …» de la ficha para abrir el panel. El paso 3 queda, de momento, con la plantilla fija (editable en un `Textarea`) para que el flujo completo ya sirva.
- Si falta el CV o el nombre: `Empty` que lleva al perfil de búsqueda.

**S4 — Paso 3 con IA local** (`lib/apply/email.ts`, `app/api/jobs/[id]/email/route.ts`)
- Plantilla pura + generador con Ollama (3 propuestas) + verificador anti-invención + cola de IA existente.
- UI: flechas entre propuestas, 3 ajustes, casilla de portafolio/web, estado de carga con componentes de `components/ai/*`, error amable con plantilla de respaldo.
- Pruebas: la plantilla y el verificador (ningún dato fuera del CV/oferta), longitudes dentro del rango, y que el texto nunca lleve `{campo}` sin rellenar.

**S5 — Pulido y cierre**
- Asunto pulido por IA (opcional, con el mismo verificador); recordar los ajustes del usuario; analítica de eventos (`email_panel_open`, `email_copy`).
- Medir tiempos y anotarlos en `docs/BENCHMARKS.md`; nota en `docs/STATUS.md` con «Para revisar por Juan»; commit; esperar su visto bueno.

**Después → P1**: el botón `mailto:` pasa a ser un acceso rápido dentro del paso 4 («Abrir en mi correo»), con lo ya aprobado aquí.

## Decisiones de Juan (21-nov-2026)
1. Ajustes aprobados: longitud, tono y enfoque.
2. Panel aprobado como 6.º uso de `GlassPanel` (ya anotado en `CLAUDE.md`).
3. **Siempre se habla de «tú»**: el tono «Profesional» ya no usa «usted»; solo cambia el registro (más formal y sobrio, pero tuteando).

## Avance
- **S0 hecho**, **S1 hecho** (ver `docs/STATUS.md`). Nota: `apply.emails` guarda solo las direcciones (sin «fuente»).
