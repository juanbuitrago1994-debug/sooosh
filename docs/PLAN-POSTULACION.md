# Plan: asistente de postulación (20-nov-2026)

Idea de Juan: que postular sea casi un clic. Si la oferta pide un correo, la app arma el correo; si pide un formulario, la app lo lee y lo deja prellenado con los datos del CV que el usuario ya subió. Se empieza simple y se escala por capas.

## Principios (no se negocian)
1. **Simple primero**: cada paso se entrega funcionando y se revisa antes de seguir. Nada de agentes ni extensiones hasta que lo simple demuestre valor.
2. **Reglas antes que IA**: nombre, correo, teléfono, ciudad, enlaces y años salen del CV por reglas. Ollama solo redacta texto libre (cuerpo del correo, respuestas abiertas), y es opcional: si no está, hay una plantilla.
3. **Nunca inventar datos del CV**: un campo se llena solo si el dato sale del CV. Si falta, queda vacío y se le dice al usuario qué falta.
4. **El usuario revisa y envía siempre**. La app no manda ni envía postulaciones por su cuenta.
5. **Todo local**: el CV y los borradores no salen del equipo. Sin APIs de correo (Gmail/Outlook), sin servicios de pago.
6. **Sin saltarse protecciones**: no captchas, no formularios que pidan iniciar sesión.

## Lo que ya existe y se reutiliza
- `lib/jobs/apply.ts` (`detectApply`) deduce la vía de postulación **sin IA**, pero devuelve **una sola** (`correo`, `formulario`, `plataforma`, `sitio`). Una oferta con correo **y** enlace pierde una de las dos.
- CV estructurado del usuario (`lib/profile/search-profile.ts`) y flujo de adaptación del CV a una oferta.
- Ficha de oferta (`components/jobs/job-detail.tsx`) con botón principal y texto de ayuda.

## Fase P0: varias vías por oferta (base de todo)
Objetivo: una oferta con correo **y** formulario muestra **ambas**.
- `detectApply` siempre captura el correo del texto aunque la vía principal sea otra, y guarda el enlace de formulario si lo hay (`apply.email`, `apply.url`). La vía principal sigue siendo una (la de siempre); la otra pasa a ser alternativa.
- Ficha: botón principal + una opción secundaria («También por correo a …» / «También con formulario»).
- El administrador ve y corrige ambas al guardar una oferta a mano.
- Pruebas con textos reales de ofertas (como la de LinkedIn de la diseñadora UX/UI): correo + Google Form.
- Criterio de listo: una oferta con las dos vías muestra las dos y las pruebas pasan. Sin migración de base (`apply` ya es JSON).

## Fase P1: postular por correo
Objetivo: del botón al correo listo en un paso.
1. Asunto fijo por plantilla: «Postulación: {cargo} – {nombre}».
2. Cuerpo: plantilla corta con datos del CV (nombre, cargo, 2–3 coincidencias reales con la oferta, enlace a portafolio/web **solo si el usuario los cargó**). Ollama puede pulir el texto; sin Ollama sale la plantilla.
3. Botón «Postular por correo»: abre `mailto:` con destinatario, asunto y cuerpo.
4. Al lado: «Descargar mi CV» (el adaptado a la oferta si existe, si no el original) y «Copiar asunto» / «Copiar cuerpo» (los `mailto:` largos se cortan en algunos clientes).
5. En celular: si el navegador lo permite, «Compartir CV» (Web Share con archivo).
6. Si al usuario le falta CV: se le pide subirlo antes (reusa el flujo existente).
- Criterio de listo: con CV cargado, el usuario abre su correo con todo escrito y descarga el PDF en dos clics; ningún dato del correo es inventado (prueba que lo verifica).

## Fase P2: carta y respuestas para formularios y sitios
Objetivo: aunque no se pueda prellenar, el usuario no empieza en blanco.
- Carta de presentación corta y respuestas típicas («¿por qué te interesa?», pretensión salarial → **vacía y avisada**, disponibilidad, años de experiencia) con botón de copiar.
- Misma regla: solo datos del CV; lo que falte se marca «Falta: …».
- Criterio de listo: en una oferta con formulario o sitio, el usuario copia respuestas en un clic.

## Fase P3: prellenar Google Forms
Objetivo: enlace de Google Forms ya prellenado.
1. Detectar `docs.google.com/forms/...` (y resolver `forms.gle` siguiendo la redirección).
2. Descargar la página pública y leer sus preguntas (tipo, opciones, obligatoria, id `entry`) del bloque `FB_PUBLIC_LOAD_DATA_`. Rechazar con aviso: formularios que piden iniciar sesión, cerrados o con formato desconocido.
3. Emparejar cada pregunta con el CV **por reglas** (palabras clave: nombre, correo, teléfono, ciudad, LinkedIn, portafolio, años, nivel de inglés…). Pregunta abierta → texto de P2. Sin dato → vacía.
4. Armar `viewform?usp=pp_url&entry.<id>=<valor>`, abrirlo y mostrar un resumen: «Llenamos 6 de 9; te faltan: pretensión salarial, adjuntar CV».
5. El adjunto del CV no se puede prellenar: se deja la descarga a mano.
- Código de GitHub: se usa solo como **referencia** (p. ej. `little-u-private-project/prefill`, `prafulaa/form-runner`); el lector se escribe propio (≈ 100 líneas) con pruebas sobre formularios de ejemplo. Antes de copiar cualquier fragmento, se revisa licencia y se anota.
- Si el formato de Google cambia, el lector falla con gracia: la app vuelve a P2 (copiar respuestas).
- Criterio de listo: el formulario de la oferta de ejemplo abre prellenado con los datos correctos y sin inventar ninguno.

## Después (solo si P0–P3 demuestran valor; no se empieza ahora)
- Formularios de otras páginas (extensión del navegador). Se tomarían ideas de repos con licencia permisiva (p. ej. `sree-code/job-autofill`). Los agentes con Ollama encontrados en GitHub (p. ej. `LEDLamp1256/jobAutoFillAgent`) quedan **descartados por ahora**: demasiada complejidad.
- Archivo `.eml` con el CV adjunto para escritorio (requiere probar en Outlook, Thunderbird y Apple Mail).
- Seguimiento de postulaciones con recordatorio a los 7 días y borrador del correo de seguimiento.
- Tono elegible del correo (formal / cercano / directo).

## Fuera de alcance (decisión de Juan)
API de Gmail/Outlook para crear borradores o enviar; envío de correos desde nuestro servidor; publicar ofertas.

## Orden y control
P0 → P1 → P2 → P3, **una fase por vez**: al terminar cada una se corre lint, tsc, build y test, se anota en `docs/STATUS.md` con «Para revisar por Juan» y se espera su visto bueno antes de seguir.

## Preguntas abiertas
- Ficha de oferta: ¿el panel de postulación va dentro de la ficha o en una hoja aparte (Drawer)? Propuesta: dentro de la ficha, bajo el botón principal, para no sumar pantallas.
- Plantilla del correo: Juan revisa el texto base antes de P1.
