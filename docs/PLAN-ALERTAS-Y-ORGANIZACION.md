# Plan: ofertas guardadas con categorías y notas (fase 5) · alertas y notificaciones (fase 6)

Propuesta del 26-nov-2026 a partir de lo pedido por Juan. Todo es **interno a la app** (sin correos ni notificaciones del navegador). Las decisiones marcadas «por defecto» las tomé yo y se cambian antes de construir.

## Fase 5 · Guardar cualquier oferta, organizarla con categorías y notas

**Lo que pidió Juan**: todas las ofertas se pueden guardar en el perfil; la persona crea categorías con el nombre que quiera, agrupa ahí sus ofertas y escribe notas.

- **Guardar desde cualquier lado**: (1) oferta analizada desde un enlace (ya se guarda sola), (2) botón «Guardar» del buscador y del detalle de oferta (hoy es una marca local), (3) a futuro, oferta pegada como texto (se guarda sin vigilancia).
- **Categorías**: tabla `collections` (persona, nombre, orden). Una oferta está en **una** categoría o en «Sin categoría» (por defecto). Crear, renombrar, reordenar y borrar categoría (sus ofertas pasan a «Sin categoría», nunca se borran). Máx. 20 categorías por persona.
- **Notas**: un texto libre por oferta (máx. 2.000 caracteres), editable desde la tarjeta.
- **Pantalla «Mis ofertas»**: pasa de «agrupada por empresa» a **agrupada por las categorías de la persona**; la empresa se ve en cada tarjeta y se puede filtrar por empresa o estado. Mover una oferta de categoría con un menú de la propia tarjeta.
- **Las ofertas del buscador** se guardan como copia completa (igual que las de enlace) y se vigilan con el mismo mecanismo (su enlace de origen). Las marcas locales actuales («guardada») se importan a la cuenta la primera vez.
- Reutiliza: `TrackedOffers`/`Row`, `Badge`, `Empty`, `DropdownMenu`, `AlertDialog`, `Textarea`, `Popover` (notas), `Input` (nombre de categoría). Nada nuevo fuera de shadcn.

## Fase 6 · Alertas y notificaciones

**Idea**: la persona define *qué* quiere ver («Diseño de producto, Colombia, remoto, contrato indefinido») y la app le avisa **dentro de la app** cuando aparecen ofertas del buscador que cumplen esas condiciones.

### Qué se configura en una alerta (todo opcional salvo el nombre)
País · región/ciudad · modalidad (remoto, híbrido, presencial) · tipo de contrato (indefinido, término fijo, prestación de servicios, prácticas…) · nivel (practicante…lead) · familia de cargo / etiquetas (diseño, datos, ingeniería…; salen de `roleFamily` y `skills` de cada oferta) · palabras clave en el título · salario mínimo (solo si la oferta lo trae).
Regla de combinación: **todas las condiciones se cumplen a la vez; dentro de una condición, cualquiera de sus valores** (país = CO *y* modalidad = remoto *o* híbrido). **Decidido por Juan**: al registrarse (o la primera vez que entre a «Alertas») se **crea sola una alerta** con los cargos de interés del registro y el país de residencia (Colombia en su caso); la persona la puede editar, pausar o borrar.
Límite: 10 alertas por persona.

### Cuándo se busca y cuándo se avisa
- **Búsqueda**: justo después de cada lectura de fuentes (la sincronización corre cada 3 h). Solo se miran las ofertas **nuevas desde la última revisión de esa alerta**; cada oferta se avisa una sola vez por alerta (tabla `alert_matches`).
- **Frecuencia de aviso** (por alerta). **Decidido por Juan (26-nov-2026): frecuencia corta por defecto** (él propuso «cada 4 horas»). Como la lectura de fuentes corre cada 3 h, un aviso «cada 4 h» en la práctica llegaría cada 6 h (la pasada de las 3 h se salta por no cumplir las 4 h); por eso la opción por defecto será **«Cada pasada (≈ cada 3 h)»**, la más corta posible. Opciones:
  - *Cada pasada (≈ 3 h)* — **por defecto**,
  - *Diaria* (una notificación por día como máximo, con todo lo nuevo),
  - *Semanal* (una vez por semana, el lunes).
  Nunca más de **una notificación por alerta y por ciclo**: «5 ofertas nuevas para “Diseño en Colombia”», no cinco notificaciones.
- **Tope**: máx. 50 ofertas por alerta y por ciclo (las más recientes) para no inundar.
- **Si no hay nada nuevo no se notifica nada** (no hay avisos vacíos).
- **Pausa**: una alerta se puede pausar; si la persona no abre sus notificaciones en 30 días, la alerta se pausa sola y se le dice al volver (**aprobado por Juan**).

### Qué notificaciones existen
1. **Ofertas nuevas de una alerta** → lleva a la vista de esa alerta.
2. **Una oferta guardada cerró** (la detecta el seguimiento de la fase 3; una por oferta) → lleva a «Mis ofertas», a esa oferta.
No se crean otras (sin promociones, sin recordatorios).

### Dónde se ven
- **Campana en la cabecera** (junto al menú de cuenta) con un punto/contador de no leídas y un popover con las últimas 5.
- **Página `/notificaciones`**: lista completa (más nuevas primero), marcar como leída / marcar todas, y la sección **«Mis alertas»** para crear, editar, pausar y borrar alertas.
- **Vista de resultados de una alerta** (`/alertas/[id]`): lista de las ofertas encontradas con esas condiciones (las nuevas marcadas), con «Guardar» (a una categoría) y «Descartar». Al abrirla, sus notificaciones pasan a leídas.
- **Cuándo se muestran**: las notificaciones aparecen en cuanto la tarea las crea (la campana se refresca al abrir la app y cada 5 minutos con la app abierta); no se interrumpe con ventanas ni sonidos.
- **Retención**: notificaciones 60 días; coincidencias de alertas 30 días.

### Datos (resumen)
`alerts` (persona, nombre, filtros JSON, frecuencia, activa, última revisión, último aviso) · `alert_matches` (alerta, oferta del buscador, encontrada el, vista el) · `notifications` (persona, tipo, datos, creada, leída). RLS como el resto (la clave pública solo lee lo propio).

### Pruebas que se escriben
Coincidencias por cada condición (AND entre condiciones, OR dentro de cada una), una oferta no se avisa dos veces, frecuencias (cada vez / diaria / semanal) con relojes simulados, tope de 50, alertas sin novedad no crean notificación, aislamiento entre personas, y que cerrar una oferta guardada cree exactamente una notificación.

## Orden propuesto
Fase 5 (categorías + notas + guardar desde el buscador) → Fase 6 (alertas + notificaciones). La 6 necesita la 5 para que «Guardar» desde una alerta caiga en una categoría.

## Implementación de la fase 6 (26-nov-2026) y cambios respecto a este plan
- **Hecho**: alertas (hasta 10), frecuencias «Cada pasada (≈ 3 h)» (por defecto) / «Una vez al día» / «Una vez a la semana», primera pasada con los últimos 7 días, un solo aviso por alerta y pasada, tope de 50 ofertas por pasada, pausa automática a los 30 días sin abrir, alerta inicial (cargos de interés + país del registro, una sola vez), campana con no leídas y últimas 5 (se refresca al abrir, al volver a la pestaña y cada 5 min), `/notificaciones` (Notificaciones | Mis alertas), `/alertas/[id]` (ofertas abiertas que cumplen las condiciones, con distintivo «Nueva» en las no vistas), aviso «Una oferta guardada ya cerró» (una por oferta), retención de 60 días (avisos) y 30 días (coincidencias).
- **Cambio 1 – sin salario mínimo**: las monedas y períodos de las ofertas no son comparables (COP/USD, mes/año); un filtro por salario daría resultados engañosos. Queda fuera hasta normalizar salarios.
- **Cambio 2 – palabras clave solo en el título**: al medirlo con las ofertas reales, buscar también en las habilidades llenaba la alerta de falsos positivos (un ingeniero Node salía para «analista de datos»). Además, como casi todos los títulos están en inglés, se añadió un diccionario corto español↔inglés de cargos (ingeniero/engineer, datos/data, diseñador/designer…); lo que no esté en él no cruza de idioma.
- **Cambio 3 – «Guardar/Descartar» en la lista de resultados**: la lista reutiliza la tarjeta de oferta del buscador (entera es un enlace al detalle); Guardar y «No me interesa» se hacen en el detalle, donde ya existen. Pendiente si Juan quiere botones en la propia lista.
