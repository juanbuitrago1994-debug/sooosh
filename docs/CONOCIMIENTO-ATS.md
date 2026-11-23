# Conocimiento del CV en formato ATS (23-nov-2026)

**Para qué sirve este archivo.** Es la fuente única de las reglas de la versión ATS del CV. De aquí salen (a) la **plantilla** que impone la estructura (código, no IA), (b) la **guía mínima** que se le da a Ollama para redactar solo el resumen y las viñetas, y (c) las **reglas del verificador** que dan el porcentaje. Un cambio de regla se hace aquí primero.

**Qué NO afirma.** No existe una norma oficial de «CV ATS». Cada ATS (Workday, Greenhouse, Taleo…) lee distinto y no tenemos acceso a ninguno. Las reglas salen de guías de empleo (varias de empresas que venden creadores de CV, así que son opinión editorial). **El porcentaje mide cumplimiento de estas reglas de formato, no la probabilidad de pasar un ATS real.** La interfaz debe decirlo así.

**Fuentes leídas (23-nov-2026)**
- `[RIO]` Resume.io, «How to build a bulletproof ATS-friendly resume» (actualizada 21-ago-2026). Sin cifras de fuente, márgenes, encabezados exactos ni fechas.
- `[IND]` Indeed, «ATS resume template» (actualizada 13-nov-2026). Artículo corto; plantilla `.docx` enlazada **no leída**.
- `[ENH]` Enhancv UK, «How to write a CV that gets through the ATS» (actualizada 16-nov-2026). Es la única con márgenes y reglas de fecha/viñeta; se contradice en un punto (ver C3).
- `[GOO]` Capturas de la «visión general» de Google que pasó Juan (resumen de IA que cita Resume.io, Indeed y atsverification.com; **no se leyó atsverification.com**). Aporta la plantilla de secciones y «10,5–12 pt».
- `[SN]` Síntesis nuestra: decisión de producto, no es cita.

**Confianza**: **Alta** = coinciden ≥ 3 fuentes. **Media** = coinciden 2, o 1 con cifra concreta. **Baja** = una sola fuente o síntesis nuestra.

---

## 1. Qué es (definición de trabajo)
Un CV ATS es **un documento de texto real, de una sola columna, en orden cronológico inverso, con encabezados de sección convencionales, fuente común y sin elementos que escondan texto** (tablas, cuadros, imágenes, íconos, encabezado/pie). `[RIO]` lo resume así: una columna, encabezados estándar, fuente común, palabras clave de la oferta y archivo de texto.

## 2. Conflictos entre fuentes y cómo los resolvemos
| Id | Conflicto | Decisión |
|---|---|---|
| C1 | **Archivo**: `[RIO]`/`[IND]` prefieren Word; `[ENH]` dice que PDF es lo más seguro. | Generamos **los dos**: PDF con texto real y DOCX. Nunca PDF de imagen. Se avisa que, si la oferta pide un formato, manda la oferta. |
| C2 | **Fuente**: `[ENH]` admite Lato, Rubik, Volkhov; `[RIO]`/`[IND]` solo Arial, Calibri, Times New Roman. | Solo **Arial, Calibri o Times New Roman** (las que coinciden en 2 de 3). |
| C3 | **Fechas**: `[ENH]` dice «Mes/Año» y sus ejemplos usan `06/2023`; `[IND]` y `[GOO]` usan «Mes Año». | **Mes en texto + año** («Mayo 2023 – Presente»). Un solo formato en todo el documento. |
| C4 | **Foto y columnas**: `[ENH]` las tolera; el resto las prohíbe. | **Sin foto y sin columnas.** Regla conservadora. |
| C5 | **Longitud**: solo `[RIO]` da cifra (1–2 páginas). | 1–2 páginas; se avisa si pasa de 2. |

## 3. Reglas (cada una es verificable sí/no)
**Peso**: **C** crítica (si falla, el documento no se considera ATS), **A** alta, **M** media, **B** baja. Columna «Cómo se verifica» = sobre el **archivo final** (texto extraído del PDF/DOCX), no sobre los datos de entrada.

### 3.1 Archivo y estructura
| Id | Regla | Cómo se verifica | Peso | Conf. | Fuente |
|---|---|---|---|---|---|
| ATS-F1 | El archivo contiene **texto seleccionable** (no es una imagen). | Se extrae texto; debe haber ≥ 200 caracteres y ≥ 95 % de las palabras del contenido esperado. | C | Alta | RIO, GOO |
| ATS-F2 | Formato permitido: `.pdf` con texto o `.docx`. | Extensión y firma del archivo. | C | Alta | RIO, IND, ENH |
| ATS-F3 | **Una sola columna**: el orden de lectura extraído coincide con el orden del documento. | Las secciones salen en el orden esperado y ninguna línea mezcla dos bloques. En DOCX: sin columnas de sección. | C | Alta | RIO, IND, ENH, GOO |
| ATS-F4 | **Sin tablas, cuadros de texto, imágenes, íconos, gráficos ni barras de habilidades.** | DOCX: sin `w:tbl`, `w:txbxContent`, `w:drawing`, `w:pict`. PDF: sin imágenes incrustadas ni anotaciones. | C | Alta | RIO, IND, ENH, GOO |
| ATS-F5 | **Contacto en el cuerpo**, no en encabezado ni pie de página. | DOCX: sin `header`/`footer` con texto. PDF: el nombre y el correo están en el texto de la primera página, fuera de la franja de margen. | C | Alta | RIO, IND, GOO |
| ATS-F6 | 1–2 páginas; no se reduce fuente o márgenes para «caber». | Número de páginas ≤ 2; ver ATS-T2 y ATS-T3. | M | Media | RIO |
| ATS-F7 | Nombre de archivo profesional: `Nombre-Apellido-Cargo.pdf/.docx`, sin espacios ni caracteres raros. | Expresión regular. | B | Baja | RIO (idea), SN (patrón) |

### 3.2 Tipografía y aspecto
| Id | Regla | Cómo se verifica | Peso | Conf. | Fuente |
|---|---|---|---|---|---|
| ATS-T1 | Fuente **Arial, Calibri o Times New Roman**, una sola familia. | Fuentes declaradas en el archivo. | A | Alta | RIO, IND, GOO |
| ATS-T2 | **Cuerpo entre 10 y 12 pt** (se acepta 10,5–12). Nada por debajo de 10 pt. | Tamaños en el archivo; el cuerpo es el más frecuente. | A | Alta | IND, ENH, GOO |
| ATS-T3 | **Márgenes entre 1,25 y 2,5 cm.** | Medidas de página. | M | Baja (solo ENH) | ENH |
| ATS-T4 | Texto oscuro sobre fondo blanco, sin sombreados. | Color de texto/fondo en el archivo. | M | Baja | GOO, SN |
| ATS-T5 | Encabezados de sección destacados solo con **negrita o mayúsculas**, sin íconos, subrayados decorativos ni colores. | Estilo de cada encabezado. | B | Baja | SN |
| ATS-T6 | Espacio en blanco entre secciones. | Separación vertical > interlineado. | B | Baja | ENH |

### 3.3 Secciones y orden
Orden fijo de la plantilla `[SN]` apoyado en `[IND]`, `[ENH]` y `[GOO]`: **Contacto → Resumen → Experiencia → Educación → Habilidades → (Certificaciones, Idiomas, Proyectos, solo si existen en el CV)**.

| Id | Regla | Cómo se verifica | Peso | Conf. | Fuente |
|---|---|---|---|---|---|
| ATS-S1 | Encabezados **convencionales** (ver tabla 4). Sin títulos creativos. | Cada encabezado está en la lista del idioma del CV. | C | Alta | RIO, IND, ENH, GOO |
| ATS-S2 | Están **Experiencia, Educación y Habilidades** (si el CV original las tiene). | Presencia por encabezado. | A | Alta | RIO, IND, ENH |
| ATS-S3 | **Resumen** de 2–4 líneas (`[GOO]`: 2–4; `[ENH]`: 3–4 frases). | Líneas/frases del bloque. | M | Media | GOO, ENH, IND |
| ATS-S4 | **Cronológico inverso**: la experiencia más reciente primero. | Fechas de inicio en orden descendente. | A | Alta | RIO, ENH, GOO |
| ATS-S5 | Las secciones salen en el orden de arriba. | Posición de cada encabezado. | M | Media | SN, IND, GOO |
| ATS-S6 | Un encabezado no aparece dos veces. | Conteo. | B | Baja | ENH |

### 3.4 Contacto
| Id | Regla | Cómo se verifica | Peso | Conf. | Fuente |
|---|---|---|---|---|---|
| ATS-K1 | Primera línea: **nombre completo** en texto. | Primera línea no vacía = nombre del CV. | C | Alta | IND, GOO, ENH |
| ATS-K2 | Segunda línea: **ciudad, país | teléfono | correo | enlaces**, con el separador `|`. | Línea 2 con ≥ correo y teléfono (o los que existan en el CV). | A | Alta | IND, GOO, ENH |
| ATS-K3 | El correo es válido y está como texto (no solo como ícono o enlace). | Expresión regular sobre el texto extraído. | A | Media | GOO, SN |
| ATS-K4 | LinkedIn/portafolio, **solo si estaban en el CV**, como URL completa en texto. | URL presente y con esquema o dominio completo. | B | Media | ENH, GOO |
| ATS-K5 | **Sin foto ni datos personales sensibles** (fecha de nacimiento, estado civil, nacionalidad, documento). | Sin imagen; sin esas etiquetas en el texto. | M | Baja | SN (C4) |

### 3.5 Experiencia, educación y habilidades
| Id | Regla | Cómo se verifica | Peso | Conf. | Fuente |
|---|---|---|---|---|---|
| ATS-E1 | Cada puesto: `Cargo — Empresa, Ciudad, País | Mes Año – Mes Año`. | Cada bloque tiene cargo, empresa y fechas en el orden y separadores definidos. | A | Alta | IND, ENH, GOO |
| ATS-E2 | **Un solo formato de fecha** en todo el documento: `Mes Año – Mes Año` o `Mes Año – Presente`. | Todas las fechas coinciden con el patrón; sin `06/2023` mezclado. | A | Media | IND, GOO, ENH (C3) |
| ATS-E3 | Sin fechas con solo año ni huecos de formato; rango con guion largo `–`. | Patrón. | M | Baja | SN |
| ATS-E4 | **Viñetas simples** (`•` o `–`), una idea por viñeta. | Caracteres de viñeta permitidos; sin símbolos decorativos ni flechas. | A | Media | ENH, IND |
| ATS-E5 | Cada viñeta empieza con **verbo de acción** y **no pasa de ~25 palabras**. | Primer token en lista de verbos del idioma; conteo. | M | Baja | GOO, SN |
| ATS-E6 | Entre 2 y 6 viñetas por puesto (ENH propone 4). | Conteo. | B | Baja | ENH, SN |
| ATS-E7 | **Educación**: `Título — Institución, Ciudad, País | Mes Año`. | Estructura de cada bloque. | M | Media | IND, GOO |
| ATS-E8 | **Habilidades** en texto plano, separadas por **comas** o viñetas, una lista por grupo (≤ 15 en total por grupo de 2–3), sin `|`, sin niveles ni barras. | Separador y ausencia de patrones de nivel («80 %», «★★★»). | A | Media | ENH, GOO, IND |
| ATS-E9 | Siglas con su forma completa **al menos una vez** (p. ej. «Search Engine Optimization (SEO)»). | Si el CV original traía la forma completa, aparece. **No se inventa** una expansión que no esté en el original. | B | Media | RIO, IND, ENH |

### 3.6 Contenido (integridad)
| Id | Regla | Cómo se verifica | Peso | Conf. | Fuente |
|---|---|---|---|---|---|
| ATS-I1 | **Nada inventado**: todo empleo, fecha, cifra, título, herramienta y logro sale del CV original. | Cada cifra, año y término técnico del documento existe en el original (mismo verificador de datos del correo). | **C** | Regla del producto | `CLAUDE.md` |
| ATS-I2 | **Nada omitido** sin motivo: todos los empleos y estudios del original están. | Conteo de bloques frente al CV estructurado. | A | Regla del producto | SN |
| ATS-I3 | Sin **relleno de palabras clave** (la misma palabra ≥ 5 veces en el resumen + habilidades). | Frecuencia. | M | Media | RIO, IND, ENH |
| ATS-I4 | Sin frases vagas de moda («apasionado», «proactivo», «orientado a resultados») sin evidencia. | Lista de términos. | B | Baja | RIO, SN |
| ATS-I5 | **Mismo idioma que el CV original** (detectado al subirlo), incluidos los encabezados. | Detección de idioma del texto y de los encabezados. | A | Decisión de Juan 23-nov | — |

## 4. Encabezados estándar por idioma `[SN]`
Basados en los nombres que usan `[IND]`, `[ENH]` y `[GOO]` en inglés; la versión en español es nuestra traducción convencional.

| Sección | Inglés | Español |
|---|---|---|
| Resumen | Professional Summary (también «Summary») | Resumen profesional |
| Experiencia | Work Experience (también «Professional Experience») | Experiencia laboral |
| Educación | Education | Educación |
| Habilidades | Skills | Habilidades |
| Certificaciones | Certifications | Certificaciones |
| Idiomas | Languages | Idiomas |
| Proyectos | Projects | Proyectos |

Contacto no lleva encabezado: es el bloque superior (nombre + línea de datos). Otros idiomas se resuelven al llegar a ellos; mientras tanto, si el CV no está en español ni inglés, se avisa y se usa el inglés.

## 5. Plantilla (estructura exacta que impone el código)
```
Nombre Apellido
Ciudad, País | Teléfono | correo@dominio.com | linkedin.com/in/usuario

Resumen profesional
<2–4 líneas, solo con datos del CV>

Experiencia laboral
Cargo — Empresa, Ciudad, País | Mayo 2023 – Presente
• Verbo + tarea + resultado (solo si el original lo trae)
• …

Educación
Título — Institución, Ciudad, País | Mes Año

Habilidades
Habilidad 1, Habilidad 2, Herramienta 1, …
```

## 6. Qué hace cada parte (reparto código / IA)
| Parte | Quién | Por qué |
|---|---|---|
| Estructura, orden, encabezados, separadores, fechas, tipografía, márgenes | **Código** (determinista) | Es 100 % verificable y no debe depender del modelo. |
| Contacto, empleos, estudios, habilidades | **Código**, desde el CV estructurado | Nada se reescribe → no hay riesgo de inventar. |
| Resumen y pulido de viñetas (verbo de acción, concisión) | **Ollama**, con guía mínima y verificador de datos | Es texto libre. Medido en el correo: guía completa en el prompt no mejoró y fue más lenta; aquí se usa solo la guía mínima. |
| Si Ollama falla o inventa algo | **Plantilla** | El resumen sale de los datos del CV; las viñetas se dejan como estaban. |

## 7. Cómo se calcula el porcentaje (propuesta, por aprobar)
- Cada regla aplicable vale su peso: **C = 5, A = 3, M = 2, B = 1**. «Aplicable» significa que la regla tiene sentido para ese CV (p. ej. ATS-K4 solo si había enlaces; ATS-S2 solo para secciones que existen en el original).
- **Porcentaje = puntos de reglas cumplidas ÷ puntos de reglas aplicables.**
- **Tope por críticas**: si falla **alguna regla crítica**, el máximo mostrado es **69 %** y se etiqueta «No cumple lo esencial», aunque lo demás esté bien.
- Etiquetas: **≥ 90 %** «Listo para ATS»; **75–89 %** «Casi: corrige estos puntos»; **< 75 %** «Necesita cambios».
- Se muestra siempre la lista de reglas, con ✓ / ✗, el peso y **cómo corregir**. Las reglas de confianza **Baja** se marcan como «recomendación» y pesan igual pero se pueden revisar con evidencia.
- Todo porcentaje se acompaña de la frase: «Mide el formato según guías públicas; no garantiza que un ATS concreto lo acepte».

## 8. Lo que falta o no está confirmado
- La plantilla `.docx` de Indeed y la página de atsverification.com no se leyeron.
- Ninguna fuente da cifra de márgenes salvo `[ENH]` (ATS-T3 es de confianza baja).
- Los verbos de acción y las palabras de relleno (ATS-E5, ATS-I4) son listas nuestras por idioma; hay que armarlas y probarlas.
- Las estadísticas de los sitios (p. ej. «49 % de reclutadores descarta CVs de IA») **no se usan**: no están verificadas.
- La adaptación de palabras clave a una oferta concreta **queda fuera** de esta versión (decisión de Juan: una sola versión ATS por CV).
