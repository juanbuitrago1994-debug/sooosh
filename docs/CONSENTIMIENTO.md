# Propuesta de consentimiento para medir el uso (borrador, 19-nov-2026)

**Estado: aprobado por Juan el 19-nov-2026 «tal como se propone» (dos niveles, tras la primera búsqueda, 90 días, 5 identificadores, texto de búsqueda normalizado) y CONSTRUIDO. Versión del texto: `2026-11-19` (`CONSENT_VERSION`). Falta la revisión de un abogado antes de producción.**
Juan aprobó registrar: búsquedas, aperturas, postulaciones y descartes. Esto define cómo pedir permiso y qué se guarda.

## Principios
1. **Se pide permiso antes de registrar nada** (opt-in): sin respuesta o con «solo lo necesario», no se guarda ningún evento.
2. **Claro y corto**: qué guardamos, para qué, y qué NO guardamos. Sin textos legales largos en la primera pantalla.
3. **Dos niveles**, porque son usos distintos: mejorar *mis* recomendaciones, y ayudar a mejorar Sooosh para todos con datos agregados.
4. **Reversible**: se puede cambiar o borrar en cualquier momento desde un enlace «Privacidad».
5. **Sin identidad**: un identificador aleatorio del navegador (no el correo, no el nombre, no el CV).

## Cuándo y dónde se pregunta
En `/ofertas`, **justo después de la primera búsqueda** (la persona ya vio para qué sirve), como una franja inferior que no tapa los resultados. No se pregunta en la pantalla de subir el CV (ahí la persona está enfocada en otra cosa). Si la cierra sin elegir, vuelve a salir una vez más a la semana siguiente y luego no insiste.

## La pantalla (texto propuesto)

```
Mejora tus recomendaciones
Podemos recordar qué buscas, qué abres y a qué postulas para mostrarte
primero lo que más te sirve. No guardamos tu CV ni tu nombre.

  [ ] Para mí: ordenar mejor las ofertas según lo que hago
  [ ] Para todos: sumar mis búsquedas a estadísticas anónimas de mercado

  [ Aceptar las dos ]   [ Solo lo necesario ]            Ver qué guardamos
```
- «Aceptar las dos» activa ambos niveles; «Solo lo necesario» no activa ninguno; marcar casillas a mano permite elegir uno.
- «Ver qué guardamos» abre el detalle de abajo.

## Qué se guarda (nivel «Para mí» y «Para todos»)
| Evento | Datos | Para qué |
|---|---|---|
| Búsqueda | región, área, modalidad, orden, texto de la búsqueda (normalizado y solo si no parece un dato personal) | ordenar mejor, sugerir búsquedas, tendencias |
| Ofertas mostradas | identificadores de las ofertas que aparecieron en la página | saber qué se vio y qué no se abrió |
| Apertura de una oferta | id de la oferta, posición, encaje mostrado | aprender qué atrae |
| Postulación | id de la oferta, camino (LinkedIn, formulario, correo…) | aprender qué convierte |
| «Adaptar mi CV» | id de la oferta | idem |
| Descarte / guardado | id de la oferta | señal explícita de interés |

## Qué NO se guarda nunca
El contenido del CV, el nombre, el correo, el teléfono, las respuestas a formularios, el texto de las ofertas que escribas tú, ni la dirección IP.

## Reglas de los datos
- **Identificador**: aleatorio, generado en el navegador; no se une a ninguna cuenta (cuando existan cuentas, se pedirá un consentimiento nuevo para unirlos).
- **«Para mí»**: los eventos se asocian a ese identificador y solo se usan para ordenar *sus* resultados.
- **«Para todos»**: solo se usan **agregados**: una búsqueda o una tendencia se muestra únicamente si la hicieron **al menos 5 identificadores distintos**.
- **Retención**: eventos individuales **90 días**; los agregados (sin identificador) se conservan.
- **Borrar mis datos**: botón en «Privacidad» que elimina todos los eventos de ese identificador y genera uno nuevo.
- **Consentimiento versionado**: se guarda la versión del texto aceptado y la fecha; si el texto cambia, se vuelve a preguntar.
- **Dónde viven**: tabla `events` en Supabase, con RLS activo (el navegador no puede leerla; solo se escribe por el servidor).

## Datos técnicos
```
events(id, anon_id, at, kind, payload jsonb, level  -- 'personal' | 'agregado')
consent_log(anon_id, version, level, at)
```
La captura es una función `track(evento)` que **no hace nada** si no hay consentimiento vigente; el servidor lo vuelve a comprobar.

## Aviso legal
En Colombia (Ley 1581 de 2012), Argentina (Ley 25.326) y Chile (Ley 19.628 y su actualización) el tratamiento de datos personales exige autorización previa, informada y revocable. Un identificador aleatorio ligado a hábitos de búsqueda puede considerarse dato personal. **Este texto no es asesoría legal: conviene que un abogado lo revise** antes de producción (política de tratamiento de datos, responsable, canal para ejercer derechos).

## Dónde está en el código
- Franja y diálogo: `components/privacy/` (franja tras la primera búsqueda; «Privacidad» al pie de `/ofertas` y del detalle, siempre disponible).
- Cliente: `lib/events/consent.ts` (decisión, identificador, `track()` que **no hace nada sin consentimiento**, borrar mis datos); lista cerrada de campos y saneado del texto: `lib/events/types.ts`.
- Servidor: `POST /api/consent`, `POST/DELETE /api/events`, `GET /api/trending` (`lib/events/server.ts`); tablas `events` y `consent_log` (migración `0008`, RLS sin políticas). El servidor **vuelve a comprobar** el consentimiento en cada envío (403 si no lo tiene), limita a 300 eventos por hora por identificador y borra lo de más de 90 días.
- Usos: «Para mí» reordena suavemente la lista por relevancia con lo que la persona abrió, guardó, adaptó, postuló o descartó (`lib/events/personalize.ts`; el orden de relevancia pesa más que el gusto); «Para todos» alimenta las «Populares» del buscador (solo con ≥ 5 personas distintas).

## Decisiones aprobadas
1. Los dos niveles y el momento (tras la primera búsqueda): **sí**.
2. Retención de 90 días y umbral de 5 identificadores: **sí**.
3. Texto de la búsqueda: **sí, normalizado y solo si no parece un dato personal**.

## (Histórico) Decisiones que se pidieron
1. ¿Los dos niveles y el momento (tras la primera búsqueda) te parecen bien?
2. ¿Retención de 90 días y umbral de 5 identificadores para lo agregado?
3. ¿Guardamos el texto de la búsqueda (normalizado), o solo región, área y filtros?
