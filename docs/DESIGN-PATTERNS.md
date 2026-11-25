# Patrones de diseño de CV Tailor

Fuente de verdad visual. Toda pantalla nueva debe cumplirlo. **Desde la UI v2 manda la sección «v2» (al final) sobre las secciones 1–7 cuando se contradicen** (p. ej. las secciones 1–7 piden una tarjeta única y títulos serif; v2 los prohíbe). La revisión visual la hace Juan; no se reabren las imágenes.

Se analizaron las 4 imágenes de `docs/referencias/` (leídas una por una). **No se copian pantallas, marcas ni textos**: se extraen principios.

---

## 1. Análisis por referencia

### ui-ref-1 — tarjeta de agente con lista de tareas
- **Estructura**: un contenedor grande y redondeado, gris claro, con tarjetas blancas anidadas y separadas por huecos pequeños (cabecera → lista de tareas → estado vacío → barra de herramientas y metadatos). Todo en una sola columna centrada.
- **Tipografía**: sans geométrica; títulos en peso medio (~20 px), cuerpo gris medio, números en monoespaciada solo para metadatos (tokens, coste, tiempo). Contador muted junto al título ("0 / 5").
- **Color y superficies**: casi monocromo. Gris para el contenedor, blanco para las tarjetas internas, **un único acento violeta** que aparece solo en el spinner activo. Sombra muy suave y amplia.
- **Radios**: contenedor ~28 px, tarjetas internas ~20 px, botones en píldora. Radio decreciente hacia adentro.
- **Espaciado/densidad**: relleno generoso (≈24 px) pero contenido compacto: 5 filas visibles.
- **Vacío y carga**: el vacío es una tarjeta con icono en un cuadrito, título corto ("listo cuando tú lo estés") y una línea de ayuda. La carga es un spinner circular en la fila activa y un texto de estado corto con punto a la derecha de la cabecera ("Reading file ●"); una línea fina de progreso bajo la cabecera.
- **Interacción/movimiento visible**: filas con marcador a la izquierda (círculo vacío → spinner → hecho); botones "Pausa" y cerrar como píldoras secundarias.
- **Carga cognitiva**: baja; solo una cosa está "viva" a la vez (la fila activa).

### ui-ref-2 — pregunta con opciones numeradas
- **Estructura**: una tarjeta ancha y baja con **una sola pregunta**; debajo, 3–4 opciones en filas; pie con atajos de teclado y la acción primaria.
- **Tipografía**: título en **serif de display**, grande (~32 px), contrastando con el sans del resto; opciones en sans regular ~22 px; la opción abierta ("escríbelo tú") en gris claro como placeholder.
- **Color**: fondo de página **cálido/crema** muy suave, tarjeta blanca, texto casi negro; botón primario negro. Ningún color de acento.
- **Radios**: tarjeta ~32 px; fila seleccionada con relleno gris en forma de píldora de ancho completo; chips numéricos cuadrados pequeños (radio ~8 px).
- **Espaciado**: filas altas (≈56 px), mucho aire; el pie separado.
- **Interacción**: **teclado primero** — flechas para navegar, número = atajo, `Esc` para descartar, `⏎` para enviar; los atajos están visibles como `kbd` dentro/junto a los botones. Hover marca la fila.
- **Carga cognitiva**: mínima: una decisión, pocas opciones, siempre una salida de escape.

### ui-ref-3 — tarjeta de bienvenida con dos modos
- **Estructura**: tarjeta vertical estrecha: ilustración (hero) arriba, título centrado en dos líneas, subtítulo muted, **dos "tarjetas de opción" tipo radio**, línea divisoria y pie con dos botones.
- **Tipografía**: título sans en negrita (~24 px), subtítulo y descripciones en gris claro pequeño.
- **Color**: fondo gris claro, tarjeta blanca; borde grueso negro en la opción seleccionada y borde fino claro en la otra; botón primario negro con icono de destellos; **único toque cálido** (nota amarilla) dentro de la ilustración.
- **Radios**: tarjeta ~24 px, opciones ~16 px, botones ~12 px.
- **Estados**: la ilustración es un "esqueleto" difuminado de documento (comunica el contenido sin datos reales).
- **Interacción**: opción seleccionada = borde fuerte + radio relleno; acción secundaria ("Quizá luego") a la izquierda, primaria a la derecha.
- **Carga cognitiva**: baja; el usuario elige un modo y avanza.

### ui-ref-4 — lista de contenidos
- **Estructura**: lista simple de filas sin bordes ni tarjetas: miniatura (≈56 px, radio ~8 px, borde fino) + título + línea de metadatos.
- **Tipografía**: títulos en sans regular ~22 px, casi negros; metadatos ~18 px en gris claro, separados por "·" (autor · fecha · tipo).
- **Color**: monocromo; las miniaturas llevan micro-acentos azul/naranja como "glifos" de contenido.
- **Espaciado**: filas muy espaciadas (~84 px), sin separadores.
- **Vacío/carga**: miniaturas tipo esqueleto de contenido (líneas grises).
- **Carga cognitiva**: bajísima; puro escaneo.

---

## 2. Patrones que se repiten y los que aparecen una sola vez

**Recurrentes (≥ 3 de 4)**
| Patrón | Dónde | Por qué importa |
| --- | --- | --- |
| Una superficie principal centrada, muy redondeada (24–32 px), blanca sobre fondo gris/cálido muy claro, sombra suave | 1, 2, 3 | El usuario ve **un solo lugar** donde pasa todo: foco y calma. |
| Casi monocromo con **acento muy escaso** (violeta en un spinner, amarillo en una ilustración, micro-glifos) | 1, 3, 4 | El color se reserva para lo que está vivo o es importante. |
| Texto secundario en gris medio/claro y jerarquía por **tamaño y peso**, no por cajas | todas | Menos ruido visual; se lee de un vistazo. |
| Filas con marcador a la izquierda (círculo/número/miniatura) en lugar de tarjetas por elemento | 1, 2, 4 | Escaneo vertical rápido; densidad sin saturar. |
| Radios que decrecen hacia adentro; relleno generoso con contenido compacto | 1, 2, 3 | Jerarquía de superficies sin bordes pesados. |
| Primera/única acción primaria bien marcada; la secundaria es discreta | 1, 2, 3 | Siempre se sabe qué hacer. |

**Solo en una referencia (se adoptan de forma selectiva)**
| Patrón | Dónde | Decisión |
| --- | --- | --- |
| Serif de display para el título | 2 | **Adoptar**, solo para el título de la tarjeta (un único gesto tipográfico). |
| Teclado primero con `kbd` visibles (flechas, números, Esc, ⏎) | 2 | **Adoptar** en Revisión (Fase E) y en las acciones primarias. |
| Opciones tipo radio con borde fuerte al seleccionar | 3 | **Adoptar** para elecciones excluyentes (idioma, modo). |
| Ilustración hero / nota adhesiva | 3 | No adoptar (decoración); el "esqueleto" de documento sí sirve como estado vacío. |
| Barra de herramientas, selector de modelo, medidores de tokens/coste | 1 | **No** adoptar (es información técnica que el usuario no necesita). |
| Línea de progreso fina bajo la cabecera | 1 | No adoptar como decoración: el progreso solo aparece mientras la IA trabaja. |

---

## 3. Principios de diseño de CV Tailor

1. **Una stage, una tarjeta, una decisión.** El shell es una tarjeta centrada; cada pantalla pide una sola cosa.
2. **Una acción primaria por pantalla.** Todo lo demás es secundario (outline/ghost), colapsado o está fuera de la vista.
3. **Solo se muestra lo necesario para decidir.** Si el usuario no necesita un dato para aprobar o rechazar, no aparece.
4. **El color significa algo.** Base neutra fría; el violeta del tema marca lo primario y lo que la IA está haciendo. Nada de colores sueltos.
5. **Jerarquía por tamaño y peso**, no por cajas dentro de cajas. Filas en vez de tarjetas por elemento.
6. **La IA se ve trabajando, y solo entonces.** Aura ambiental sutil + mensajes de estado reales + `MatrixLoader`/`Skeleton`/`Progress`; fuera de ese momento, quietud.
7. **Teclado primero.** Atajos visibles (`kbd`) en las decisiones repetitivas; foco siempre visible.
8. **El movimiento informa, no decora.** Solo opacity, blur y translate; sin escalar texto; respeta `prefers-reduced-motion`.
9. **Una sola cosa memorable.** La aura ambiental y el mensaje que respira cuando la IA trabaja son el gesto distintivo; el resto es sobrio.
10. **Textos en español, frase corta, verbo claro** ("Reescribir para esta oferta", no "Enviar"). Los errores explican qué pasó y cómo arreglarlo.

---

## 4. Traducción a shadcn (componente · variante · token)

| Necesidad | Componente / clases | Tokens |
| --- | --- | --- |
| Página (stage) | `<main>` centrado, `min-h-dvh`, `bg-background` | `background` (gris claro frío) |
| Tarjeta principal | `Card` + `rounded-3xl` y `shadow-lg` | `card`, `ring`/`border`; el radio sale de `--radius` del tema |
| Subtarjeta / superficie interior | `rounded-2xl` + `bg-muted` | `muted` |
| Título de la tarjeta | `CardTitle` con `font-heading` (serif) | `foreground` |
| Texto secundario | `CardDescription`, `text-muted-foreground` | `muted-foreground` |
| Acción primaria | `Button` (default), `h-11`, con icono o `kbd` | `primary`, `primary-foreground` |
| Acción secundaria | `Button variant="outline"` o `ghost` | `border`, `accent` |
| Opciones excluyentes | filas con `RadioGroup`/`ToggleGroup`; seleccionada con `border-primary` + `bg-accent` | `primary`, `accent` |
| Fila de lista con marcador | `ItemGroup`/`Item` (o `li` con `flex`), marcador en `bg-muted` | `muted`, `accent` |
| Atajos | `Kbd` | `muted` |
| Indicador de pasos | segmentos pequeños (`bg-primary` actual, `bg-border` resto), `aria-current="step"` | `primary`, `border` |
| IA trabajando | `AiStage` = `AiAura` + `ThinkingTicker` + `MatrixLoader` | `primary`, `chart-4` (solo variables del tema) |
| Carga de contenido | `Skeleton` (solo mientras la IA trabaja) | `muted` |
| Progreso medible | `Progress` (solo mientras la IA trabaja) | `primary` |
| Vacío | `Empty` (icono en cuadrito + título + 1 línea) | `muted` |
| Error / aviso | `Alert` (`destructive` solo para errores) | `destructive` |
| Notificación | `Sonner` | `popover` |
| Diálogo secundario (historial, ajustes) | `Dialog`/`Drawer` | `popover` |

**Excepción única al "solo shadcn"**: los componentes propios de movimiento (`AiAura`, `ThinkingTicker`, `AiStage`, `StepTransition`), documentado en `components/ai/README.md` y que usa únicamente variables del tema (`var(--primary)`, `var(--chart-*)`, `var(--radius-*)`).

---

## 5. Movimiento (investigado y decidido)

**Qué se investigó** (búsqueda web, nov-2026) sobre cómo se hace un estado de "la IA piensa" sutil:
- Lo más usado y calmado: **texto de estado con shimmer** (una onda suave de brillo/opacidad) que termina con un estado concreto, y que se detiene con `prefers-reduced-motion`.
- **Entrada palabra por palabra** con blur + translate + opacity y un retardo corto entre palabras (≈ 0,04 s), con `motion` y `AnimatePresence` (documentación de Motion sobre animación de texto).
- Un "orbe" que **respira** con variaciones lentas de brillo cuando está en reposo.
- El borde luminoso con degradado angular que gira (estilo Siri) existe, pero es llamativo: **no encaja con "mucho más sutil"** y se descartó (nuestra primera versión, `AiBeam`, hacía justo eso).

**Decisión**: movimiento ambiental, lento y sin bordes.
1. **`AiAura`**: luz tenue que deriva despacio dentro de la tarjeta (translate ~16 s) en lugar de un borde que gira.
2. **`ThinkingTicker`**: entrada palabra por palabra con blur + una onda lenta de opacidad ("respiración"); cambia solo con el paso real del pipeline.
3. **`StepTransition`**: el paso saliente sube y se desenfoca; el entrante sube desde abajo y se aclara (el movimiento responde a la acción del usuario).
4. **`StepDots`**: los segmentos se llenan con un resorte suave (translate).
5. El contenido en espera solo se atenúa y desenfoca apenas (opacity 0,55 · blur 2 px).

**Reglas** (todas las pantallas):
- Librería `motion`; constantes únicas en `lib/motion.ts` (entradas 0,5 s, salidas 0,28 s, mismo easing).
- Solo **opacity, blur (filter) y translate (x, y)**. Nunca `scale`; ningún texto crece o se encoge. Sin giros ni bordes animados.
- El movimiento continuo (aura, onda) existe solo mientras la IA trabaja; en reposo, quietud.
- `prefers-reduced-motion`: sin translate, escalonado, onda ni deriva; opacidad y texto.
- Los mensajes de estado son texto real en `aria-live="polite"`.

## 6. Lista de "no hacer" (derivada de lo que las referencias evitan)

- ❌ Barras laterales, paneles secundarios, pestañas anidadas o cabeceras pesadas.
- ❌ Mostrar datos, tokens, costes o detalles técnicos que el usuario no necesita para decidir.
- ❌ Varias acciones primarias a la vez; botones del mismo peso compitiendo.
- ❌ Una tarjeta por cada elemento de una lista (usar filas con marcador).
- ❌ Barras de progreso decorativas o animaciones continuas cuando la IA no está trabajando.
- ❌ Colores sueltos o acentos por todas partes: el acento solo marca lo primario y lo vivo.
- ❌ Sombras duras, bordes gruesos permanentes, degradados decorativos.
- ❌ Etiquetas en MAYÚSCULAS sobre cada encabezado, marcadores numéricos (01/02) donde no hay secuencia real, flechas "→" añadidas a los botones.
- ❌ Escalar texto en animaciones; bordes que giran o parpadean; entradas "fade-and-slide" en cada sección; hover animado en cada tarjeta.
- ❌ Ilustraciones decorativas que no comunican estado.
- ❌ Textos en inglés o vagos ("Submit", "Error"); errores sin explicar qué hacer.

---

## 7. Cómo se valida cada fase

1. Capturas a 375, 768 y 1280 px, claro y oscuro, leídas una por una.
2. Comparar contra `docs/referencias/` y este documento: ¿una sola tarjeta?, ¿una acción primaria?, ¿acento solo donde hay estado?, ¿radios decrecientes?, ¿jerarquía por tamaño/peso?
3. Cualquier desviación se corrige antes de cerrar la fase y se anota en `docs/STATUS.md`.


---

## v2 — Referente `ui5ref-5.jpg` (17-nov-2026)

Leída una sola vez y sintetizada aquí. Es una pantalla de «resultado de análisis» sobre un degradado: casi no hay interfaz, solo texto, un ícono y un panel.

**Patrones**
- **(a) Fondo.** Degradado suave multicolor a pantalla completa (gris azulado arriba, durazno/rosa cálido abajo-izquierda), sin cortes ni bordes. Es el protagonista visual.
- **(b) Elementos libres.** Ícono, línea de estado y resultado flotan sobre el fondo, sin cajas, sin bordes, sin sombras.
- **(c) Encapsulado solo si hace falta.** El único contenedor es un panel translúcido: blur, fondo semitransparente, borde casi invisible, esquinas generosas, sin sombra. Deja ver el degradado.
- **(d) Una familia tipográfica**, tamaños pequeños, pesos 400 y 500. La jerarquía sale del contraste de color (texto fuerte vs. tenue), no del tamaño. El resultado final es apenas más grande que el resto.
- **(e) Línea de estado** pequeña (p. ej. «Listo en 64 s · 14 requisitos cruzados») con un brillo de gradiente que recorre el texto: una parte más contrastada y el resto tenue.
- **(f) Pasos como línea de tiempo** dentro del panel: puntos pequeños unidos por un conector fino; el paso activo con más contraste, los terminados más tenues.
- **(g) Ícono de carga** pequeño y suelto, a la izquierda del texto de estado, sin círculo ni caja a su alrededor más allá de un halo tenue.

**Cómo se traduce en CV Tailor**
- Fondo de la app: color sólido del tema (`--background`: claro `#fdfdfd`, oscuro `#121212`, ambos neutros); `AmbientBackground` se eliminó el 19-nov-2026.
- `GlassPanel` es (c) y su lista de usos es cerrada: línea de tiempo del análisis, tarjeta de cambio en la revisión, menús y diálogos.
- Tipografía: Geist en todo; `text-xs`/`text-sm` cuerpo, `text-base`/`text-lg font-medium` títulos; nada sobre `text-xl`; 400 y 500.
- (e) se implementa con la «respiración» de opacidad por palabra (`ThinkingTicker`): el brillo recorre el texto usando solo opacity, que cumple las reglas de motion (sin animar `background-position`, sin escalar).
- (g) es `MatrixLoader` (tamaño `sm`) suelto junto al texto de estado.
- Botones `h-9`, radio completo, una sola acción primaria por pantalla, y solo cuando hay algo que confirmar.
- Entrada: toda la página es zona de soltar; al arrastrar, el degradado se intensifica (opacity) en vez de dibujar un recuadro.

**Prohibido en v2**: `Card` fuera de la lista de `GlassPanel`, `border-dashed`, `font-serif`/`font-heading` serif, tamaños sobre `text-xl`, pesos 600+, cajas alrededor de títulos, sombras.

**Vista previa de documento (K7)**: la hoja del CV en el paso Exportar se muestra con un marco muy tenue (`border-border/40`, radio `rounded-xl`, sin sombra). No cuenta como contenedor de interfaz: es el propio documento. Decisión a revisar por Juan.

## Tarjeta del CV (componente compartido, 25-nov-2026)

Toda pantalla que muestre **el CV de la persona** usa `CvFileCard` (`components/cv/cv-file-card.tsx`). No se arma otra tarjeta con `Attachment` para el CV ni se cambia su contenido en una pantalla concreta: si hace falta un cambio, se hace en el componente y llega a todas.

| Orden | Parte | Contenido | Regla |
|---|---|---|---|
| 1 | Línea sobre la tarjeta (8 px) | «Afinidad ATS · N %», `text-xs text-muted-foreground/80`, centrada | Solo con medida real. Mientras se mide: «Midiendo afinidad ATS». Sin medida: no aparece. **En el panel «Mi CV» no se muestra** (`ats: null`) |
| 2 | Icono | `FileTextIcon` | Fijo |
| 3 | Título | Nombre original del archivo, con extensión | Sin datos del archivo guardados: nombre y cargo del CV |
| 4 | Descripción | «DOCX · 12 KB · leído en 1 s» (`cvFileDetail`) | Sin datos del archivo guardados: «Reabierto desde el historial» |
| 5 | Acción | «Cambiar» (`ghost`, `sm`, atenuado) | Siempre confirma con `ChangeCvDialog` |

- **Ancho**: el del contenedor (`w-full`); donde haga falta un tope, `max-w-sm`.
- **Propiedades**: `file` (`name`, `detail`, `ats`), `onChange` (al confirmar) y `changeHref` (si al confirmar hay que salir de la pantalla).
- **Estados extra** (p. ej. «Sin validar» en «Mi CV») van **debajo** de la tarjeta, nunca dentro.
- **Usos**: validación del CV (`validation-flow.tsx`), CV ya validado (`validated-cv.tsx`) y panel «Mi CV» (`search-profile-panel.tsx`).
- **No es esta tarjeta**: las filas de descarga de PDF y Word (`ats-version.tsx`, `tailored-ats.tsx`) son archivos generados, no el CV subido.
