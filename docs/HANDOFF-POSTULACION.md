# Traspaso: asistente de postulación (fase P) y contexto reciente

Documento para retomar el trabajo en una sesión nueva sin perder contexto. Léelo junto con `CLAUDE.md` (reglas permanentes), `docs/PLAN-POSTULACION.md` (plan detallado) y la parte final de `docs/STATUS.md` (qué se hizo y qué revisar). Fecha: 21-nov-2026. Último commit al escribirlo: `1a10a9b` en `main`.

## 1. La idea (de Juan)
Muchas ofertas manuales (p. ej. publicaciones de LinkedIn) traen **un correo** al que enviar la postulación y/o **un enlace a un formulario** (Google Forms…). Hoy el candidato abre su correo, escribe el asunto, redacta el cuerpo, adjunta el CV… Idea: **automatizar ese flujo** con lo que la app ya sabe del usuario (CV en el perfil de búsqueda, portafolio/web si los cargó) y de la oferta; y, como feature alterno, **prellenar formularios** con los datos del CV.

Ejemplo real que lo originó: la publicación de Vos Consultora «Diseñador/a UX/UI» (correo `candidatos@consultoravos.com` + enlace `lnkd.in/d92iP43G` que lleva a un Google Form `forms.gle/U13v4492isxwh9aJ9`).

## 2. Decisiones de Juan (no re-litigar)
- **Fase 1 + asistente completo** (correo, formulario y sitio), pero **olvidarse de la API de Gmail/Outlook** («fase 3 / API»: descartada). Tampoco enviar correos desde nuestro servidor.
- **Simple primero**: que funcione, y luego se escala por capas. Los agentes con Ollama encontrados en GitHub «no gustaron» → descartados por ahora.
- Reglas del proyecto que aplican: **nunca inventar datos del CV**, **solo Ollama local** para IA, **costo cero**, CV local (no sube a servidores), el usuario **revisa y envía siempre**, no resolver captchas ni formularios con login.
- Descartado por Juan en general: Computrabajo/elempleo/Bumeran y portales similares; Torre.co; el producto «Publica tu oferta» (en pausa). Legal está cubierto por su abogado.

## 3. Investigación técnica (resultado)
**Correo**
- `mailto:` abre el correo del usuario con destinatario, asunto y cuerpo; **no adjunta**; algunos clientes cortan cuerpos largos → complementar con «Copiar asunto/cuerpo» y descarga del CV.
- Archivo `.eml` con `X-Unsent: 1` + adjunto: abre como borrador en Outlook/Thunderbird; con el Outlook nuevo hay reportes contradictorios (puede perder cuerpo/adjunto); Apple Mail sin confirmar → hay que probar. (Fase posterior.)
- Web Share API con archivos: no fija destinatario, asunto poco fiable; Safari iOS 15+ y Chrome Android sí, Firefox escritorio no; Chrome escritorio solo Windows/ChromeOS. Útil solo en móvil para compartir el CV.
- API de Gmail (`gmail.compose`) es alcance **restringido**: verificación de Google + auditoría de seguridad externa, semanas o meses → **descartada**.

**Formularios**
- **Google Forms** se resuelve sin navegador: la página pública trae sus preguntas en `FB_PUBLIC_LOAD_DATA_` (tipo, opciones, obligatoria, id `entry`) y Google acepta un enlace prellenado `viewform?usp=pp_url&entry.<id>=<valor>`. El usuario revisa y envía. **No se puede prellenar la subida del CV** (fuentes de terceros; no confirmado por Google): se deja descargado. El formato del bloque no es oficial → fallar con gracia (volver a «copiar respuestas»).
- Repos de referencia en GitHub (verificar **licencia y mantenimiento antes de copiar** código; son proyectos pequeños): `little-u-private-project/prefill` (el más parecido: lee el bloque, arma el enlace; rechaza formularios con login, `forms.gle` y `/edit`), `prafulaa/form-runner`, `BlaizerBrumo/Google-Form-AutoFiller`, `gayathra45/google-form-automatically-filler`. Extensiones de autocompletado de empleo (para una fase posterior, formularios de otras páginas): `sree-code/job-autofill` (MIT), `bantiya/autofill-job-applications`, `danishhraza/reverse-engineered-jobright`, `philliphjhuang/jobfill`; agente local con Ollama `LEDLamp1256/jobAutoFillAgent` (descartado por complejidad). Plan: **escribir un lector propio** (~100 líneas, con pruebas) usando los repos solo como referencia.
- Los enlaces `lnkd.in/<código>` muestran una página intermedia con el destino real (ya se resuelven en `lib/offer/short-links.ts`); eso destapa formularios que LinkedIn esconde tras el enlace corto.

## 4. Plan por fases (una por vez; tras cada una: lint, tsc, build, test, nota en `docs/STATUS.md` con «Para revisar por Juan», commit, y esperar su visto bueno)
- **P0 — varias vías por oferta: HECHA** (`7ec6d64`). `detectApply` devuelve la vía principal más `apply.alt` (máx. 3: correo y enlaces a formularios del texto); la ficha muestra «También puedes postular así:»; el editor del administrador las permite corregir/agregar/quitar.
- **P1 — postular por correo: PENDIENTE (siguiente).** Botón «Postular por correo» que abre `mailto:` con destinatario, **asunto por plantilla** («Postulación: {cargo} – {nombre}») y **cuerpo** corto con datos del CV (nombre, cargo, 2–3 coincidencias **reales** con la oferta, portafolio/web solo si el usuario los cargó); Ollama puede pulir el texto pero **es opcional** (sin él sale la plantilla). Al lado: «Descargar mi CV» (el adaptado a la oferta si existe), «Copiar asunto» y «Copiar cuerpo»; en celular, «Compartir CV». Si falta el CV: pedirlo (reusa el flujo del perfil de búsqueda). **Juan debe aprobar el texto base del correo antes de dejarlo fijo.** Pregunta abierta: panel dentro de la ficha (propuesto) o en una hoja aparte.
- **P2 — carta y respuestas para formularios y sitios: PENDIENTE.** Carta corta y respuestas típicas copiables; lo que falte (pretensión salarial…) queda vacío y marcado «Falta: …».
- **P3 — prellenar Google Forms: PENDIENTE.** Detectar el formulario (`docs.google.com/forms`, `forms.gle`, y los resueltos desde `lnkd.in`), leer preguntas, emparejar con el CV **por reglas** (Ollama solo para preguntas abiertas), armar el enlace prellenado y mostrar «llenamos 6 de 9; te faltan …».
- **Después (solo si lo anterior demuestra valor):** extensión del navegador para otros formularios, `.eml` con adjunto, seguimiento de postulaciones (recordatorio a 7 días), tono elegible del correo.

## 5. Contexto que P1 ya puede usar (hecho en estas sesiones)
- Datos de postulación por oferta: `job.apply` = `{ method, platform?, url?, email?, alt?: [...] }` (`lib/jobs/apply.ts`: `applyChannels`, `channelHref`, `isFormUrl`). La ficha (`components/jobs/job-detail.tsx`) ya pinta las alternativas.
- CV del usuario: perfil de búsqueda local (`lib/profile/search-profile.ts`, `useSearchProfile()`); flujo de adaptación del CV a una oferta ya existe («Adaptar mi CV»).
- Encaje con el CV (reglas, sin IA): `/api/jobs/[id]/fit` → cubre/relacionado/falta: sirve para elegir las «2–3 coincidencias reales» del cuerpo del correo.
- Analizador de ofertas (admin) ya mejorado en A1–A5: título/empresa honestos, revisión «dato por dato» con evidencia, segmentación por bloques, limpieza conservadora, empresa y fecha desde los datos estructurados de LinkedIn, entrada única (enlace o texto), enlaces `lnkd.in` resueltos, paridad enlace/texto. Ver `docs/PLAN-ANALIZADOR-OFERTAS.md`, `docs/BENCHMARKS.md` y `docs/STATUS.md`.
- Ofertas manuales marcadas con la insignia rosa **«Curated by Sooosh»** (`components/magic/curated-badge.tsx`, `origin = manual`) y filtro público «Solo seleccionadas por Sooosh».
- Incidente resuelto: el buscador se colgaba por el pooler de Supabase; los clientes `postgres.js` contra el puerto 6543 deben llevar `prepare: false` **y** `max_pipeline: 1`. Ver `docs/INCIDENTES.md`.

## 6. Cómo trabajar con Juan (preferencias observadas)
- Español, explicaciones no técnicas primero; avisar al terminar cada entrega con **qué cambió, qué revisar (claro/oscuro, escritorio y 375 px) y qué decisiones quedan**.
- **Él hace la auditoría visual**: no tomar capturas ni correr `pnpm shots`/`pnpm a11y` salvo que lo pida. No arrancar otro servidor (su `pnpm dev` corre en :3000).
- UI: solo shadcn y tokens semánticos; excepciones documentadas en `components/ai/*` y `components/magic/*` (ver `CLAUDE.md`). Colores/tamaños fuera del tema solo como tokens documentados en `docs/DESIGN-TOKENS.md`. Texto de la interfaz en español (excepción pedida: «Curated by Sooosh»).
- **Hacer `git add` solo de archivos exactos** (nunca carpetas): el árbol tiene trabajo suyo sin commitear (`components/steps/*`, `lib/analysis/fit.ts`, `lib/analysis/offer-profile.ts`, `lib/changes/bias.ts`, `scripts/*`, `app/api/judge/`, `.playwright-mcp/`). Los commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Todo dato de rendimiento que se cite sale de una medición propia en `docs/BENCHMARKS.md`; si una cifra no se midió, decirlo.
- Los intentos de visual que Juan descartó (no repetir): movimientos del haz del distintivo «Ofertas encontradas» (ver `docs/STATUS.md` y la memoria de UI).

## 7. Cómo empezar la sesión nueva (propuesta de primer mensaje)
> Lee `CLAUDE.md`, `docs/HANDOFF-POSTULACION.md` y `docs/PLAN-POSTULACION.md`. Empecemos la **Fase P1** (postular por correo). Antes de escribir código, muéstrame el texto base del asunto y del cuerpo del correo para que lo apruebe y dime dónde propones poner el panel en la ficha.
