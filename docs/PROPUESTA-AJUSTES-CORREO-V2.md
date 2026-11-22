# Propuesta: ajustes del correo, versión 2 (22-nov-2026)

Pedido de Juan tras probar S6: (1) el usuario elige qué datos van en el correo con el **toggle de transitions.dev**, usado en toda la app; (2) hay opciones que sobran (p. ej. «Registro»); (3) buscar una forma más estructurada y con menos carga cognitiva, inspirada en shadcn/create; (4) investigar prácticas de UX/UI y de contenido para dar a la IA local más base. **Es una propuesta: no hay código nuevo.**

## 1. Diagnóstico de S6
- 8 ajustes + 3 pestañas + 3 puntos de partida = **14 controles** antes de pedir una versión.
- **Registro, Calidez y Tipo de lenguaje** describen lo mismo (cómo suena) con tres ejes casi iguales; el modelo local no los distingue de forma fiable (no medido, impresión de las pruebas). Son el exceso que Juan nota.
- Los ajustes de **datos** y los de **estilo** se mezclan en pestañas: la persona no ve de un golpe qué saldrá en su correo.
- No hay **vista previa** del resultado dentro del drawer: se cambia a ciegas y se debe volver al paso 3.

## 2. Qué enseñan las referencias
**shadcn/create** (leído en el navegador): una sola columna de ~10 filas «nombre + valor actual» (Style, Base Color, Theme, Font, Radius…), cada fila abre un selector corto; arriba un **código de preset** y un botón **Shuffle**; el resultado se ve **en vivo** al lado. Cero pestañas, cero descripciones largas: el valor actual *es* la explicación.

**Buenas prácticas de ajustes** ([NN/g, divulgación progresiva](https://www.nngroup.com/articles/progressive-disclosure/), [KDE HIG](https://develop.kde.org/hig/powerful_when_needed/), [WooCommerce](https://developer.woocommerce.com/docs/extensions/ux-guidelines-extensions/settings/), [Wix](https://dev.wix.com/docs/wix-design-system/guidelines/guidelines/settings-panel-layout-guidelines), [Toptal](https://www.toptal.com/designers/ux/settings-ux)): mostrar primero pocas opciones importantes; valores por defecto seguros; lo más usado arriba; lo raro escondido; nombres en lenguaje llano. (Fuentes de blog/guías de diseño: sirven de criterio, no son estudios con cifras.)

**Herramientas de escritura**: Grammarly trata el tono como **pocas opciones con nombre** (formal, seguro, amable…), no como varios ejes; otras ofrecen 90 tonos, que es justo la sobrecarga que queremos evitar.

**Contenido del correo** (blogs de empleo, confianza media-baja; ver también `INVESTIGACION-CORREO-POSTULACION.md`): la primera frase pesa más que el resto y debe ser específica; menos de ~150 palabras; asunto concreto, nunca «Solicitud de empleo» a secas.

## 3. Propuesta: un solo panel, 3 bloques, sin pestañas

```
Ajustes de redacción
[ Cercano | Profesional | Directo ]      ← TONO (reemplaza Registro+Calidez+Lenguaje)
Longitud   [ Corto | Medio | Largo ]
Idioma     [ Auto | Español | Inglés ]

Qué incluye tu correo
  En el texto        Un logro de tu CV · Cómo vi la oferta · Tu salario* ...
  En la firma        Teléfono ⬤  Correo ⬤  Ciudad ◯  LinkedIn ◯  Portafolio ⬤
                     (cada fila: nombre + el dato real debajo + toggle)

Más ajustes ▸   (Enfoque, Saludo, Cierre, nombre de quien recibe)
─────────────────────────────────────────────
Vista previa (se actualiza al instante con los datos; el tono pide versión nueva)
[Cerrar]  [Pedir otras versiones]
```

Cambios concretos:
1. **Tono único** de 3 opciones (Cercano / Profesional / Directo): cada una fija registro, calidez y lenguaje juntos. «Registro», «Calidez» y «Tipo de lenguaje» desaparecen como controles. Tono «sobrio/casual» quedan fuera hasta que se pida (lo medimos con tus amigos).
2. **Longitud**: Corto, Medio, Largo (el «Mínimo» pasa a ser lo que hace «Directo»).
3. **Idioma** en una fila, con «Auto» por defecto.
4. **«Qué incluye»**: todo lo que *se puede poner o quitar* es un **toggle** (con el dato real debajo, como en tu captura de Datos). Solo existen los datos que el CV trae; el nombre siempre va. Agrupado en «En el texto» y «En la firma».
5. **«Más ajustes»** (colapsable): Enfoque, Saludo, Cierre y nombre del destinatario. Lo que casi nadie toca no ocupa pantalla.
6. **Vista previa viva** al pie del drawer: los datos (firma, saludo, cierre) cambian al instante porque son reglas; el tono necesita «Pedir otras versiones» y se avisa en una línea.
7. Se mantiene el selector deslizante solo para las 3 filas de opciones; las pestañas se van.

Resultado: de 14 controles a **3 selectores + toggles de datos (los que el CV tenga) + 1 sección plegada**.

## 4. Toggle de transitions.dev (leído en transitions.dev/detail.html?t=toggle)
- Es de la versión Pro de su biblioteca; el código mostrado es de uso libre en la página, pero conviene confirmar la licencia antes de copiarlo. Alternativa sin riesgo: reimplementar el **mismo comportamiento** (hecho público: la bolita viaja 14,66 px en 350 ms con curva `cubic-bezier(0.34, 1.35, 0.64, 1)`, pasa 1 px del final, vuelve y se asienta; el color del pista cambia aparte; sin animación al montar; sin movimiento con `prefers-reduced-motion`).
- Implementación: `MotionSwitch` en `components/motion/` sobre el `Switch` de shadcn (base-ui, ya accesible: `role="switch"`, teclado, foco), con la bolita animada por `motion` (ya aprobada) en lugar de CSS propio. Se reemplaza el `Switch` en **todos** los usos de la app para mantener consistencia (lo cuento antes con `grep`).
- Nota: es un rebote; la regla de CLAUDE.md dice «sin rebotes largos». 350 ms con un sobrepaso de 1 px cabe, pero lo dejo anotado.

## 5. Base de conocimiento para la IA local
No es RAG ni un modelo ajustado: el modelo local tiene poco contexto y cada token cuesta segundos (`BENCHMARKS.md`).
- `lib/apply/guidelines.ts`: **guía de estilo compacta** (≤ ~250 tokens por petición) con reglas citadas: primera frase específica y con el cargo, una sola petición al final, sin frases de relleno («me dirijo a usted para…»), sin superlativos, una idea por frase, verbos activos, tuteo; variantes por tono y longitud.
- **Ejemplos cortos por tono** (few-shot) escritos por nosotros con datos de ejemplo, pasados por el verificador anti-invención.
- La misma guía alimenta la **revisión final** por reglas (paso 4): primera frase sin relleno, <150 palabras, un solo CTA, asunto concreto.
- Pendiente de investigar a fondo (no lo hice aún): guías de lenguaje claro (p. ej. GOV.UK, Plain Language) y redacción en español latinoamericano formal/informal. Se hace como parte de esta fase y se cita.
- Todo cambio en el prompt se **mide** (tiempo y calidad) y se registra en `BENCHMARKS.md`.

## 6. Orden propuesto (una por vez)
- **S7a**: `MotionSwitch` + reemplazo en la app (rápido, aislado).
- **S7b**: panel único (Tono/Longitud/Idioma + «Qué incluye» + «Más ajustes») y vista previa viva; migración de lo guardado en localStorage.
- **S7c**: guía de estilo y ejemplos para la IA, con medición.
- Después: lo que quedaba de S7 (logro del CV, indicador de requisitos, adjunto) y S8.

## 7. Decisiones para Juan
1. ¿Tono único de 3 opciones (Cercano/Profesional/Directo) está bien, o quieres conservar «Sobrio» o «Casual»?
2. ¿Sin pestañas y con «Más ajustes» plegado?
3. ¿Vista previa al pie del drawer, o prefieres que el drawer sea más bajo y la vista previa se vea en el paso 3?
4. Toggle: ¿lo reimplemento con `motion` imitando el comportamiento (recomendado) o copio su código si la licencia lo permite?
