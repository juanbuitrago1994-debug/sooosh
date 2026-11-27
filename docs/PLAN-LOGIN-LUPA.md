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

## Estado de la implementación (27-nov-2026)
Juan indicó como referencia el tutorial de Codrops («Creating a Bulge Distortion Effect with WebGL», OGL) y pidió que, en vez de seguir al ratón, el efecto ocurra solo al cargar o recargar el login. Se construyó **directamente la lupa real (camino A)**, sin pasar por la etapa de solo `motion`:
- **Tecnología**: **OGL 1.0.11** (`ogl`, versión fijada; sin dependencias; licencia Unlicense, de dominio público; última publicación enero de 2025). La fórmula de abombamiento sale del repositorio de ejemplo del tutorial (Robin Payot, MIT, `main.frag`): `1 / (1 + distancia⁴)`. El artículo de Codrops devolvió 403 a la lectura automática, así que se leyó el repositorio. Cambios nuestros: la lente la mueve el tiempo; corrige la proporción de la pantalla (círculo, no elipse); fuera de la lente la imagen queda intacta (el original encoge lo lejano); y los elementos aparecen al pasar la lente. La animación usa `motion` (ya instalado); no hace falta GSAP.
- **La «foto»** (`lib/lens/rasterize.ts`): se dibuja en un canvas 2D lo que muestra el DOM leyendo sus estilos calculados (rectángulos, textos línea por línea, SVG), sin `foreignObject`: si cambia el login, la foto cambia sola. Lo que no se copia (pseudoelementos, sombras) se pierde, pero el efecto termina fundiéndose con la página real.
- **Piezas**: `lib/lens/frame.ts` (línea de tiempo y parámetros `LENS`: 2 s, radio 0,3, fuerza 0,5 ≈ ×2, lente de arriba abajo), `shaders.ts`, `rasterize.ts`, `run.ts` (OGL), `components/auth/login-lens.tsx` (envuelve toda la pantalla; el contenido real existe desde el principio pero invisible hasta el final; un clic o una tecla saltan el efecto).
- **Sin efecto**: con «reducir movimiento» aparece al instante; sin WebGL, con un fundido de 0,6 s; un seguro de 7 s garantiza que la página nunca quede invisible. Se perdió la entrada escalonada (`Rise`) del login: la sustituye la lupa.
- **Pendiente de Juan**: ver el efecto a ojo y ajustar `LENS` (fuerza, radio, duración); las demás decisiones del §5 (referencias en vídeo, frecuencia) quedan abiertas: hoy se ve en CADA carga, como pidió.

## Ronda 2 (27-nov-2026): prisma, estela, más rápido y más fuerte
Juan mostró tres fotogramas de referencia: franjas verticales con color (azul/violeta arriba, naranja abajo), texto borroso con bordes de colores y tarjetas curvadas con franjas iridiscentes a los lados. Se añadió al shader (`lib/lens/shaders.ts`):
- **Prisma lateral** (`dispersion`): rojo, verde y azul se abomban con distinta fuerza → franjas de color en los bordes de la lente.
- **Prisma vertical** (`prism`): los canales de color se desplazan hacia arriba y abajo → azul arriba, naranja abajo.
- **Estela vertical** (`blur`): desenfoque direccional de 9 muestras que crece con la intensidad.
- **Fuerza en el borde** (`rim`): la intensidad se concentra en el borde de la lente (donde se ve el color) en vez de en su centro.
- **Lente ancha** (`widthFactor`): de círculo a banda casi tan ancha como la pantalla, como en las referencias.
- **Más rápido y fuerte**: 1,2 s (antes 2 s), curva con más ímpetu (`easePower` 1,8), lupa ×4–5 (`strength` 0,22; antes 0,5), la lente arranca pegada al borde superior (antes había ~0,7 s de pantalla vacía).
- **Panel de ajuste en vivo** (solo en desarrollo, `http://localhost:3000/login?afinar=1`): 11 controles con los parámetros de abajo, «Repetir efecto», «Copiar valores» (JSON para pegarle a Claude) y «Restablecer». Valores por defecto en `DEFAULT_LENS` (`lib/lens/frame.ts`).

**Parámetros para explorar**: `durationMs`, `easePower`, `radius`, `widthFactor`, `strength`, `dispersion`, `prism`, `blur`, `rim`, `plateau` (cuánto se sostiene el pico), `band` (suavidad con que aparecen los elementos), y fuera del panel `startY`/`endY` (por dónde entra y sale) y `x` (posición horizontal).
**Ideas que NO están hechas** (siguiente ronda si Juan las quiere): curvatura global tipo pantalla curva (la referencia 3: las tarjetas laterales se doblan hacia afuera), estela horizontal o diagonal, brillo/«blanqueado» en el pico, ondulación con ruido, dos lentes a la vez, entrada desde un lado, y desenfoque de las zonas aún no reveladas.

## Ronda 3 (27-nov-2026): curvatura global, color breve y ligero, más ágil
Pedido de Juan tras ver la ronda 2: curvatura global como la tercera referencia; el color duraba casi toda la animación y debía ser muy ligero y notarse poco, solo al comienzo; más fluidez y agilidad; la deformación era demasiado grande.
- **Curvatura global** (`curve`, 0,12 por defecto): toda la pantalla se curva como un cristal (los bordes se doblan hacia afuera) mientras dura el efecto y vuelve a cero al terminar. Rango 0–0,6 en el panel.
- **Color con su propia envolvente** (`colorPeak` 0,3, `colorWidth` 0,1): antes el color seguía a la deformación (casi todo el efecto); ahora es una campana breve en torno al momento en que aparecen los primeros elementos y se apaga antes de la mitad. Medido con fotogramas exactos: color apreciable solo entre el 25 % y el 55 % del avance (máx. 69 de 255 en el pico, solo 5 % de los píxeles), 0 % desde el 60 % hasta el final (antes: hasta 224 de 255 y en la mayor parte de la animación).
- **Menos deformación**: lupa `strength` 0,4 (antes 0,22 en la ronda 2), `radius` 0,45, estela 0,07.
- **Más ágil**: 0,9 s (antes 1,2 s en la ronda 2 y 2 s en la 1), curva `easePower` 1,3.
- **Más fluido (por reducción de trabajo, estimado, no medido en un Safari real)**: el lienzo se anima al 60 % de resolución (`renderScale`) y pasa a la completa al 80 % del avance; 7 muestras de estela (antes 9); `preserveDrawingBuffer` solo en desarrollo. En una pantalla Retina (dpr 2) son ~31 millones de lecturas de textura por fotograma frente a ~110 millones antes (≈ 3,6 veces menos).
- **Defecto corregido (solo desarrollo)**: React ejecuta los efectos dos veces y se creaban DOS lienzos superpuestos; ahora la ejecución cancelada se destruye.
- **Herramientas de prueba (solo desarrollo)**: `window.__LENS_OVERRIDE` (valores a probar desde un script) y `window.__lensRenderAt(p)` (dibuja el fotograma exacto de un avance, para medir sin depender del ritmo del navegador).
- **Límite de lo medido**: el navegador de pruebas (WebKit de Playwright, sin GPU) corre incluso la página SIN efecto a ~180 ms por fotograma, así que NO sirve para medir los fotogramas por segundo reales; la fluidez en el Safari de Juan queda por comprobar a ojo.
