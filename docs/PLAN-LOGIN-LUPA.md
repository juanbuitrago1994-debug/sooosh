# Plan: animación de entrada «lupa / espejo» en la pantalla de login (solo `/login`)

Propuesta del 27-nov-2026. **Estado: investigación y plan; nada de esto está construido.** Pedido de Juan: que al cargar o recargar `/login` (la primera impresión de la app) los elementos salgan de arriba hacia abajo y se distorsionen un instante, como vistos a través de una lupa o un espejo.

## 0. Lo que NO pude ver
Los dos pines de Pinterest (`894597913511159450` y `858709853990355964`) no se pueden leer desde aquí (devuelven la página vacía: piden sesión o bloquean clientes automáticos), y además son imágenes o vídeo. **Este plan parte de la descripción de Juan, no de los pines.** Antes de construir hay que fijar el movimiento exacto: lo ideal es que Juan **grabe la pantalla de cada referencia** (o los descargue) y los deje en `docs/referencias/` (como las demás referencias de diseño), o describa con palabras: ¿la lente es un círculo que recorre el contenido (referencia 1) o una banda de distorsión que baja barriendo todo (referencia 2)? ¿cuánto dura? ¿qué tan fuerte es la deformación?

## 1. Qué hace falta técnicamente
Una **lupa real** (abombar el contenido) o un **espejo que deforma** no se puede lograr con CSS normal: hay que **deformar píxeles**. Hay cuatro caminos:

| Camino | Cómo funciona | Pros | Contras / riesgos |
|---|---|---|---|
| **A. WebGL encima (OGL / Three.js / PixiJS)** | Un `<canvas>` a pantalla completa dibuja una «foto» del contenido final y le aplica un *shader* de lupa/ondulación que se anima; al terminar, se funde con el HTML real y el canvas desaparece | Es el efecto verdadero, fluido y con control total (radio, fuerza, aberración de color) | Hay que fabricar la «foto» (ver §3); más código; peso de la librería; WebGL en Safari tiene sus manías |
| **B. Filtro SVG sobre el HTML real** (`feDisplacementMap`) | `filter: url(#lente)` sobre el contenedor; se anima la fuerza del desplazamiento | Sin foto: deforma el HTML vivo; muy poco código | **En Safari es frágil**: `backdrop-filter: url()` no funciona (WebKit bug 245510) y `feDisplacementMap` sobre HTML dentro de `foreignObject` falla (bug 313914, mayo 2026); además puede ser lento. Juan usa Safari |
| **C. Solo `motion` (transformaciones + desenfoque)** | Los elementos caen de arriba con un **estiramiento vertical** (`scaleY`/`skew`) y desenfoque que se asienta con resorte, más una banda de cristal que barre la pantalla (`backdrop-filter: blur`, sí soportado en Safari) | Seguro en Safari, accesible, sin librerías nuevas, 60 fps | Es una *sugerencia* de espejo, no una distorsión real de lupa; rompe la regla «nunca `scale`» de `lib/motion.ts` (habría que documentarlo como excepción) |
| **D. Librerías «de cristal» para DOM** (p. ej. liquidGL) | Refracción tipo vidrio sobre elementos | Rápido de probar | Proyecto joven; su documentación dice que la refracción en tiempo real funciona con textos animados por GSAP pero no con animaciones CSS; hay que revisar licencia y mantenimiento |

**GSAP** no deforma píxeles: es el *reloj* (la línea de tiempo y las curvas). Sirve para mover los parámetros del *shader* del camino A, pero `motion` (que ya usamos) hace lo mismo; no hace falta añadirlo.

## 2. Recomendación
**Camino A (WebGL con OGL) como efecto principal y camino C como respaldo**, construido por etapas para tener algo bueno desde la primera:
1. **Etapa 1 – base segura (camino C)**: entrada escalonada de arriba hacia abajo con estiramiento y desenfoque que se asientan. Funciona en cualquier navegador y con «reducir movimiento». Ya sería una mejora clara sobre la entrada actual.
2. **Etapa 2 – lupa real (camino A)**: `OGL` (librería WebGL mínima, ~29 KB comprimida, licencia MIT; la versión se fija exacta y se revisa el *lockfile* como pide `CLAUDE.md`) con un *shader* de abombamiento (hay un tutorial de Codrops que explica este mismo efecto con OGL, y un reinicio con GSAP). Solo se descarga en `/login` (importación dinámica). Si no hay WebGL2, o el usuario pidió «reducir movimiento», se usa la etapa 1 o nada.

## 3. El punto difícil: la «foto» del contenido
El *shader* necesita una textura. Opciones (se decide con un experimento en Safari):
- **Dibujar a mano en un canvas 2D** el logo, los textos y los botones (con la fuente Geist ya cargada). Control total y sin trucos, pero duplica el diseño del login: si cambia el layout, hay que cambiar el dibujo (se mitiga con una prueba que compara posiciones).
- **`html-to-image`** (rasteriza el HTML real): sin duplicar el diseño, pero usa `foreignObject`, que en Safari tiene fallos conocidos (fuentes e imágenes que salen en blanco la primera vez).
- **Capturar los elementos uno a uno** como texturas pequeñas (logo, título…) y mover cada uno por separado: más fiel al «salen de arriba hacia abajo» de la referencia 2.

## 4. Plan de trabajo (cada etapa termina en una revisión de Juan)
0. **Aclarar el movimiento** (grabaciones o descripción de Juan; ver §0) y fijar un guion con tiempos: duración total ≤ 2 s, contenido legible hacia 0,8 s.
1. **Etapa 1 (camino C)** en `components/auth/login-intro/` (todo aislado: ningún otro archivo cambia). Excepción documentada en `CLAUDE.md` (como `ColdGlow` y `FlowBeam`): estiramiento permitido SOLO en `/login`.
2. **Experimento de la «foto»** en una ruta de laboratorio local (`/laboratorio/lupa`, no se despliega): probar las tres opciones del §3 en **Safari 26, Chrome y Firefox**, midiendo fotogramas por segundo y fidelidad.
3. **Etapa 2 (camino A)**: `LoginLens` con OGL, línea de tiempo con `motion`, pasada final que funde con el HTML real y desmonta el canvas.
4. **Accesibilidad y seguridad del primer pintado**: el HTML real existe desde el principio (lectores de pantalla, enfoque con teclado); el canvas es decorativo (`aria-hidden`, `pointer-events: none`); se puede saltar con clic o tecla; sin «reducir movimiento» no hay efecto; si se pierde el contexto WebGL, se retira solo.
5. **Rendimiento**: límite de resolución del canvas (DPR ≤ 2), pausa si la pestaña se oculta, nada se carga fuera de `/login`, y se mide el efecto en el tiempo de carga (LCP) antes y después con `docs/BENCHMARKS.md`.
6. **Pruebas**: lógica de la línea de tiempo (progreso → parámetros del *shader*) con pruebas unitarias; prueba de que con «reducir movimiento» el contenido aparece al instante; revisión visual de Juan en Safari, con una pestaña y con varias.

## 5. Decisiones que necesito de Juan
1. Las **grabaciones o la descripción** de las dos referencias (§0): ¿lupa que recorre, o banda de espejo que baja?
2. ¿Aceptamos la **excepción** a «nunca `scale`/distorsión» solo en `/login`?
3. ¿El efecto debe verse **en cada recarga** (como dijo Juan) o solo la primera vez de cada sesión? (En cada recarga, quien entra a menudo lo ve muchas veces; se puede dejar un interruptor.)
4. ¿Empezamos por la **etapa 1** (rápida, segura) mientras se prepara la 2?

## Fuentes consultadas
- Codrops, «Creating a Bulge Distortion Effect with WebGL» (OGL, abombamiento, reinicio con GSAP): https://tympanus.net/codrops/2023/06/28/creating-a-bulge-distortion-effect-with-webgl/
- Codrops, «Building a Mouse-Following Square Lens Effect with Three.js and GLSL»: https://tympanus.net/codrops/2026/08/25/building-a-mouse-following-square-lens-effect-with-three-js-and-glsl/
- liquidGL (refracción de vidrio para elementos DOM): https://cdn.jsdelivr.net/npm/liquid-gl@2.0.1/README.md
- WebKit 245510, `backdrop-filter: url(#svg)` no funciona en Safari: https://bugs.webkit.org/show_bug.cgi?id=245510
- WebKit 313914, `feDisplacementMap` sobre HTML en `foreignObject` falla en Safari: https://bugs.webkit.org/show_bug.cgi?id=313914
- Smashing Magazine, «A Deep Dive Into The Wonderful World Of SVG Displacement Filtering»: https://www.smashingmagazine.com/2021/09/deep-dive-wonderful-world-svg-displacement-filtering/
