# Plan: analizador de ofertas v2 y pantalla de administración (20-nov-2026)

Origen: la publicación de LinkedIn «Estamos seleccionando diseñadora UX/UI» (sin título, sin empresa, sin contrato) quedó guardada como «🔹 Experiencia comprobable», con empresa «diseño de interfaces (UI) e investigación de experiencia de usuario», sin región y sin clasificar como tecnología, y por eso **no aparece en el buscador**. Las ofertas manuales (LinkedIn y otras que no podemos leer automáticamente) son de lo que más valor aporta, así que deben guardarse bien aunque vengan incompletas.

## Diagnóstico (medido en la base, no supuesto)
La tarjeta guardada tiene: `regions = []`, `country = null`, `is_tech = false`, `role_family = "otros"`.
1. **Invisible en el buscador**: el filtro «Colombia» exige región; sin región no entra. Además «Tecnología» exige `is_tech`, y con un título basura la clasificación dio «otros».
2. **Título obligatorio**: el esquema exige `title` y el modelo, al no haber cargo, elige una línea de sección («🔹 Experiencia comprobable»). La guardia solo comprueba que el texto *exista* en la publicación, no que *sea* un título.
3. **Empresa = un requisito**: pasa la misma guardia porque la frase está literal en el texto.
4. **Habilidades basura** («Systems», «Trabajo») salidas de coincidencias sueltas.
5. **No hay noción de «no aparece»**: un dato ausente se rellena en vez de marcarse como ausente.

## Principios
- Nunca inventar: cada dato lleva su **evidencia** (la frase del texto de donde sale) o se marca «No indicado».
- Todo local (Ollama), sin costo. Reglas primero; el modelo, solo donde las reglas no alcanzan.
- Simple y por entregas pequeñas: una fase por vez, con tu visto bueno.
- Mismo lenguaje visual de la app: tokens y componentes de shadcn, el cargador que ya quedó perfecto, sin textos de relleno.

## Fase A1: que ninguna oferta incompleta quede invisible ni mal etiquetada
1. **Título honesto**: se descartan como título las líneas de sección (emoji + frase corta, termina en «:», encabezados tipo «Requisitos»). Si la oferta no nombra el cargo, el título queda **vacío y marcado** y el editor propone uno descriptivo (p. ej. «Diseñadora UX/UI», sacado de la frase «Estamos seleccionando…» o de las habilidades) que **tú confirmas**; no se guarda sin título confirmado.
2. **Empresa**: solo se acepta si el texto la nombra como entidad (cue: «en», «para», «somos», firma, dominio del correo como pista). Si no, «No indicada»; la tarjeta no muestra empresa (o muestra «Publicado en LinkedIn»).
3. **Región**: el editor pide región explícita con una sugerencia (idioma, país de la publicación). Una tarjeta **sin región** no se pierde: decides entre «aparece en todas las regiones» (propuesta para ofertas manuales) o «solo si la región coincide».
4. **Tecnología**: la clasificación se recalcula con el título confirmado y las habilidades; aviso en el editor si queda «otros».
5. **Habilidades**: lista de palabras que no son habilidades («Trabajo», «Systems» suelto) y mínimo de contexto para aceptar una.
6. **Tarjeta con pocos datos**: ya muestra solo lo que sabemos; se añade un caso de prueba y de aspecto: sin empresa, sin contrato, sin nivel.
- Criterio de listo: la publicación de la diseñadora, tal cual, se guarda como «Diseñadora UX/UI», aparece al buscar «diseño de interfaces» con «Tecnología · Colombia» y su tarjeta se ve correcta con solo los datos que trae.

## Fase A2: revisión dato por dato (la «lista de verificación»)
- Tras analizar, el editor muestra cada campo con su estado: **✓ está en el texto** (con la frase subrayada), **? inferido** (sugerido, requiere confirmar) o **— no aparece**. Tú aceptas, corriges o dejas «No indicado» campo por campo.
- Campos: cargo, empresa, ubicación y país, modalidad, contrato, nivel, años, salario, idiomas, requisitos, responsabilidades, deseables, vías de postulación (correo y enlaces), región.
- La guardia exige que la evidencia exista literal en el texto; lo que no, baja a «inferido».

## Fase A3: pantalla de administración renovada
- Encabezado igual que el resto de la app (extremos), sin textos explicativos de relleno.
- Una sola entrada (Enlace / Pegar texto) y un botón.
- «Revisa la tarjeta» sale en un **Drawer** (hoja lateral en escritorio, inferior en móvil, `ResponsiveSheet` que ya existe) con **solo el cargador centrado** mientras analiza (`LoadingState`), y la lista de verificación de A2 al terminar.
- «Tarjetas guardadas»: buscador, filtros (activas, sin región, incompletas) y contador; cada fila muestra qué le falta.
- Responsiva (375 / 768 / 1280), claro y oscuro.

## Fase A4: análisis más profundo del texto
- **Segmentar antes de extraer**: separar la publicación en bloques (gancho, descripción, requisitos, beneficios, contacto/cómo postular, hashtags/ruido) con reglas + una pasada del modelo, y extraer por bloque. Útil para publicaciones de LinkedIn sin estructura.
- **Segunda pasada de verificación**: el modelo revisa cada dato contra su evidencia; lo que no la tiene baja de estado.
- **Conjunto de prueba real**: las publicaciones que vayas guardando (empezando por esta) se convierten en casos con la respuesta esperada; se mide aciertos antes/después y se registra en `docs/BENCHMARKS.md`.
- Solo se citan cifras de rendimiento medidas por nosotros.

## Orden y control
A1 → A2 → A3 → A4, una por vez. Al terminar cada una: lint, tsc, build y test; nota en `docs/STATUS.md` con «Para revisar por Juan». La publicación de la diseñadora se corrige en A1 (el editor ya permite «Actualizar tarjeta» sin duplicar).

## Decisiones pendientes de Juan
1. Tarjeta **sin región**: ¿aparece en todas las regiones (propuesto) o solo cuando la región coincide?
2. Tarjeta **sin empresa**: ¿se oculta la empresa o se muestra «Publicado en LinkedIn»?
3. ¿Se puede **bloquear el guardado** hasta confirmar un título (propuesto)?
