# Conocimiento del CV en formato ATS (23-nov-2026)

**Para qué sirve este archivo.** Es la fuente única de las reglas de la versión ATS del CV. De aquí salen (a) la **plantilla** que impone la estructura (código, no IA), (b) la **guía mínima** que se le da a Ollama para redactar solo el resumen y las viñetas, y (c) las **reglas del verificador** que dan el porcentaje. Un cambio de regla se hace aquí primero.

**Qué NO afirma.** No existe una norma oficial de «CV ATS». Cada ATS (Workday, Greenhouse, Taleo…) lee distinto y no tenemos acceso a ninguno. Las reglas salen de guías de empleo (varias de empresas que venden creadores de CV, así que son opinión editorial). **El porcentaje mide cumplimiento de estas reglas de formato, no la probabilidad de pasar un ATS real.** La interfaz debe decirlo así.

**Fuentes leídas (23-nov-2026)**
- `[RIO]` Resume.io, «How to build a bulletproof ATS-friendly resume» (actualizada 21-ago-2026). Sin cifras de fuente, márgenes, encabezados exactos ni fechas.
- `[IND]` Indeed, «ATS resume template» (actualizada 13-nov-2026). Artículo corto; plantilla `.docx` enlazada **no leída**.
- `[ENH]` Enhancv UK, «How to write a CV that gets through the ATS» (actualizada 16-nov-2026). Es la única con márgenes y reglas de fecha/viñeta; se contradice en un punto (ver C3).
- `[GOO]` Capturas de la «visión general» de Google que pasó Juan (resumen de IA que cita Resume.io, Indeed y atsverification.com; **no se leyó atsverification.com**). Aporta la plantilla de secciones y «10,5–12 pt».
- `[WRK]` Workable, «How an ATS reads resumes» (proveedor de ATS; publicada 2014, modificada sep-2023; es marketing, no norma).
- `[ADO]` Adobe Express, «ATS resume tips» (leída 23-nov-2026). Trae fuentes, tamaños y **márgenes**.
- `[TOP]` Toptal, «ATS-friendly resumes: formatting, examples and common mistakes» (actualizada 2-nov-2026).
- `[NOV]` Novoresume, «ATS resume» (26-oct-2026; lo que atribuye a Greenhouse y USAJOBS **no se verificó**; la parte final de la página llegó resumida por el lector). Es la fuente más detallada: fechas, longitud, secciones, nombre de archivo.
- **No se pudo leer** ResumeGeni (dominio bloqueado por la red), atsverification.com ni RemakeCV (la búsqueda no los devolvió); tampoco la plantilla `.docx` de Indeed. No hay documentación oficial de Workday, Greenhouse ni Lever en esta base: lo que se dice de ellos viene de terceros.
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
| C3 | **Fechas**: `[ENH]` dice «Mes/Año» y sus ejemplos usan `06/2023`; `[IND]` y `[GOO]` usan «Mes Año». | **`MM/AAAA`** («05/2023 – Presente»), ver C6 (resuelto en A5; antes era «Mes Año»). Un solo formato en todo el documento. |
| C4 | **Foto y columnas**: `[ENH]` las tolera; el resto las prohíbe. | **Sin foto y sin columnas.** Regla conservadora. |
| C5 | **Longitud**: solo `[RIO]` da cifra (1–2 páginas). | 1–2 páginas; se avisa si pasa de 2. |
| C6 | **Formato de fecha**: `[IND]`, `[GOO]` y `[ENH]` (texto) usan mes en palabras («June 2019 – Current»); `[NOV]`, `[GOO]` (alternativa) y los ejemplos de `[ENH]` usan `MM/AAAA`; `[TOP]` solo pide coherencia (su ejemplo es «2022–2026»); `[WRK]` pide «un formato propio del país». **No hay unanimidad.** | **RESUELTO el 23-nov-2026 (decisión de Juan, con evidencia): `MM/AAAA`** (`03/2021 – Presente`). Prueba con el lector de Enhancv sobre un CV ficticio generado por nosotros: con «Marzo 2021 – Presente» **no leyó ninguna fecha**; con la misma plantilla y `03/2021 – Presente` **las leyó todas**. El formato numérico además no depende del idioma. Es 1 prueba con 1 lector (no probé «Mar 2021»). El verificador sigue exigiendo **un solo formato** y acepta cualquiera de los dos (así revisa también archivos ajenos). |
| C7 | **Resumen con o sin encabezado**: `[NOV]` dice que el resumen «no necesita encabezado»; `[IND]`, `[GOO]`, `[TOP]`, `[ENH]` lo tratan como sección estándar. | Con encabezado («Resumen profesional»): 4 fuentes contra 1. |
| C8 | **Orden de secciones**: `[NOV]` pone Habilidades antes de Educación (y dice que el orden no es obligatorio); `[IND]`, `[GOO]` y la plantilla de `[ENH]` ponen Educación antes. | Se genera Educación → Habilidades, pero **el verificador acepta ambos órdenes** (ATS-S5 pasa a peso bajo). |

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
| ATS-F7 | Nombre de archivo profesional: `Nombre-Apellido-Cargo.pdf/.docx`, sin espacios ni caracteres raros. | Expresión regular. | B | Media | RIO, WRK («pon tu nombre en el archivo»), NOV (ejemplo `Maria-Lopez-Project-Coordinator.pdf`) |
| ATS-F8 | El archivo pesa **menos de 2,5 MB**. | Tamaño del archivo. | M | Baja | NOV (lo atribuye a Greenhouse, no verificado); ENH (2 MB, límite de su herramienta, no de un ATS) |

### 3.2 Tipografía y aspecto
| Id | Regla | Cómo se verifica | Peso | Conf. | Fuente |
|---|---|---|---|---|---|
| ATS-T1 | Fuente **Arial, Calibri o Times New Roman**, una sola familia. | Fuentes declaradas en el archivo. | A | Alta | RIO, IND, GOO |
| ATS-T2 | **Cuerpo entre 10 y 12 pt** (se acepta 10,5–12). Nada por debajo de 10 pt. | Tamaños en el archivo; el cuerpo es el más frecuente. | A | Alta | IND, ENH, GOO |
| ATS-T3 | **Márgenes entre 1,25 y 2,5 cm.** | Medidas de página. | M | Media | ENH (1,25–2,5 cm), ADO (0,75–1 in = 1,9–2,5 cm) |
| ATS-T4 | Texto oscuro sobre fondo blanco, sin sombreados. | Color de texto/fondo en el archivo. | M | Baja | GOO, SN |
| ATS-T5 | Encabezados de sección destacados solo con **negrita o mayúsculas**, sin íconos, subrayados decorativos ni colores, y **sin espaciado entre letras**. | Estilo de cada encabezado; sin `letter-spacing`/`w:spacing` en el texto. | B | Media | NOV, WRK, SN |
| ATS-T6 | Espacio en blanco entre secciones. | Separación vertical > interlineado. | B | Baja | ENH |

### 3.3 Secciones y orden
Orden fijo de la plantilla `[SN]` apoyado en `[IND]`, `[ENH]` y `[GOO]`: **Contacto → Resumen → Experiencia → Educación → Habilidades → (Certificaciones, Idiomas, Proyectos, solo si existen en el CV)**.

| Id | Regla | Cómo se verifica | Peso | Conf. | Fuente |
|---|---|---|---|---|---|
| ATS-S1 | Encabezados **convencionales** (ver tabla 4). Sin títulos creativos. | Cada encabezado está en la lista del idioma del CV. | C | Alta | RIO, IND, ENH, GOO |
| ATS-S2 | Están **Experiencia, Educación y Habilidades** (si el CV original las tiene). | Presencia por encabezado. | A | Alta | RIO, IND, ENH |
| ATS-S3 | **Resumen** de 2–4 frases y **no más de 4 líneas impresas** (≈ 400 caracteres). | Frases y longitud del bloque; aviso, no fallo, si pasa de 4 líneas. | M | Media | GOO (2–4 líneas), NOV (2–3 líneas), ENH (3–4 frases), ADO («corto») |
| ATS-S4 | **Cronológico inverso**: la experiencia más reciente primero. | Fechas de inicio en orden descendente. | A | Alta | RIO, ENH, GOO |
| ATS-S5 | Orden recomendado: Resumen → Experiencia → (Educación y Habilidades, **en cualquier orden**) → resto. | Posición de cada encabezado. | B | Baja | IND, GOO, ENH (plantilla); NOV invierte Educación y Habilidades y aclara que el orden no es obligatorio (C8) |
| ATS-S6 | Un encabezado no aparece dos veces. | Conteo. | B | Baja | ENH |

### 3.4 Contacto
| Id | Regla | Cómo se verifica | Peso | Conf. | Fuente |
|---|---|---|---|---|---|
| ATS-K1 | Primera línea: **nombre completo** en texto. | Primera línea no vacía = nombre del CV. | C | Alta | IND, GOO, ENH |
| ATS-K2 | Una línea de **ciudad, país | teléfono | correo | enlaces**, con el separador `|`, entre las 3 primeras líneas (el cargo o titular del original, si lo trae, va en la línea 2). | Esa línea tiene el correo y el teléfono (o los que existan en el CV). | A | Alta | IND, GOO, ENH |
| ATS-K3 | El correo es válido y está como texto (no solo como ícono o enlace). | Expresión regular sobre el texto extraído. | A | Media | GOO, SN |
| ATS-K4 | LinkedIn/portafolio, **solo si estaban en el CV**, como URL completa en texto. | URL presente y con esquema o dominio completo. | B | Media | ENH, GOO |
| ATS-K5 | **Sin foto ni datos personales sensibles** (fecha de nacimiento, estado civil, nacionalidad, documento). | Sin imagen; sin esas etiquetas en el texto. | M | Baja | SN (C4) |

### 3.5 Experiencia, educación y habilidades
| Id | Regla | Cómo se verifica | Peso | Conf. | Fuente |
|---|---|---|---|---|---|
| ATS-E1 | Cada puesto: `Cargo — Empresa, Ciudad, País | MM/AAAA – MM/AAAA`. | Cada bloque tiene cargo, empresa y fechas en el orden y separadores definidos. | A | Alta | IND, ENH, GOO |
| ATS-E2 | **Un solo formato de fecha** en todo el documento: `MM/AAAA – MM/AAAA` o `MM/AAAA – Presente`. | Todas las fechas coinciden con el patrón; sin «Mes Año» mezclado (el verificador acepta uno u otro, pero no los dos). | A | Media | IND, GOO, ENH (C3) |
| ATS-E3 | Sin fechas con solo año ni huecos de formato; rango con guion largo `–`. | Patrón. | M | Baja | SN |
| ATS-E4 | **Viñetas simples** (`•` o `–`), una idea por viñeta. | Caracteres de viñeta permitidos; sin símbolos decorativos ni flechas. | A | Media | ENH, IND |
| ATS-E5 | Cada viñeta empieza con **verbo de acción** y **no pasa de ~25 palabras**. | Primer token en lista de verbos del idioma; conteo. | M | Baja | GOO, SN |
| ATS-E6 | Entre 1 y 6 viñetas por puesto. | Conteo; aviso si hay más de 6. | B | Baja | NOV (3–4 el puesto actual, 1–3 los anteriores), ENH (4) |
| ATS-E7 | **Educación**: `Título, campo — Institución | MM/AAAA` (rango `MM/AAAA – MM/AAAA` si el original trae inicio y fin). | Estructura de cada bloque. | M | Media | IND, GOO |
| ATS-E8 | **Habilidades** en texto plano, separadas por **comas** o viñetas, una lista por grupo (≤ 15 en total por grupo de 2–3), sin `|`, sin niveles ni barras. | Separador y ausencia de patrones de nivel («80 %», «★★★»). | A | Media | ENH, GOO, IND |
| ATS-E9 | Siglas con su forma completa **al menos una vez** (p. ej. «Search Engine Optimization (SEO)»). | Si el CV original traía la forma completa, aparece. **No se inventa** una expansión que no esté en el original. | B | Media | RIO, IND, ENH |
| ATS-E10 | **Cargos escritos completos**, sin abreviaturas como «Sr.», «Jr.», «Ssr.». | Lista de abreviaturas en cargos y titular. El generador las expande («Sr.» → «Senior», «Jr.» → «Junior», «Ssr.» → «Semi Senior») y lo avisa. | M | Media | NOV («spell job titles out in full»; Greenhouse cita «Sr. Account Exec»), WRK («títulos estándar sin adornos, solo abreviaturas comunes») |

### 3.6 Contenido (integridad)
| Id | Regla | Cómo se verifica | Peso | Conf. | Fuente |
|---|---|---|---|---|---|
| ATS-I1 | **Nada inventado**: todo empleo, fecha, cifra, título, herramienta y logro sale del CV original. | Cada cifra, año y término técnico del documento existe en el original (mismo verificador de datos del correo). | **C** | Regla del producto | `CLAUDE.md` |
| ATS-I2 | **Nada omitido** sin motivo: todos los empleos y estudios del original están. | Conteo de bloques frente al CV estructurado. | A | Regla del producto | SN |
| ATS-I3 | Sin **relleno de palabras clave** (la misma palabra ≥ 5 veces en el resumen + habilidades). | Frecuencia. | M | Media | RIO, IND, ENH |
| ATS-I4 | Sin frases vagas de moda («apasionado», «proactivo», «orientado a resultados») sin evidencia. | Lista de términos. | B | Baja | RIO, SN |
| ATS-Q1 | **Cifras en los logros**: al menos 1 de cada 4 viñetas trae un número o resultado medible. | Proporción de viñetas con dígitos ≥ 25 % (solo con 4 o más viñetas). **Consejo**, no resta. | B | Baja | ENH |
| ATS-Q2 | **Variedad al empezar**: ninguna palabra inicial se repite 3 veces o más entre las viñetas. | Frecuencia de la primera palabra. **Consejo**, no resta. | B | Baja | ENH |
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
Cargo o titular (solo si el CV original lo trae)
Ciudad, País | Teléfono | correo@dominio.com | linkedin.com/in/usuario

Resumen profesional
<2–4 líneas, solo con datos del CV>

Experiencia laboral
Cargo — Empresa, Ciudad, País | 05/2023 – Presente
Descripción de la empresa (solo si el original la trae)
• Verbo + tarea + resultado (solo si el original lo trae)
• …

Educación
Título, campo — Institución | MM/AAAA

Certificaciones
Curso o certificación — año (solo si el original los trae)

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

## 9. Decisiones de implementación (A2, 23-nov-2026)
- **Titular bajo el nombre**: el cargo del original (p. ej. «Ssr. Product designer») es palabra clave valiosa; va en la línea 2 y el contacto en la 3 (ATS-K2 ajustada).
- **Educación** no tiene ciudad en el CV estructurado, así que no se escribe (ATS-E7 ajustada).
- **Fechas con solo el año** («2018 – 2021») se dejan así: agregar un mes sería inventar un dato. El generador lo avisa; **el verificador (A3) debe tratar ATS-E3 como «no aplicable» cuando el original no trae mes**, no como fallo.
- **Habilidades**: se quitan duplicados (sin distinguir mayúsculas) pero **no se recorta** a 15: omitir sería perder datos (ATS-I2). El verificador solo avisa si un grupo pasa de 15.
- **Viñetas**: en A2 se conservan **tal como las escribió la persona** (solo se quitan símbolos de viñeta y espacios). El pulido con IA (verbo de acción, concisión) queda para después de ver qué reglas ATS-E5 fallan en A3; así no se arriesga reescribir logros sin necesidad.
- **Resumen**: si el CV trae uno, se usa tal cual. Si no, Ollama propone 2–4 frases con datos cerrados y un verificador (cifras, fechas, nombres, siglas y términos técnicos); si falla, la sección se omite. **Límite conocido**: el verificador no detecta palabras comunes en minúscula que el CV no diga (en una muestra con el modelo real se coló «modelado»). Por eso el resumen generado se marca como «Propuesto por IA» en la interfaz (A4) para que la persona lo revise.

## 9b. Decisiones de implementación (A5, 23-nov-2026): leer el CV a fondo
Problema: con un PDF de diseño (columnas, OCR) el análisis general del CV deja puestos sin viñetas, vuelca párrafos o porcentajes en «Habilidades» y pierde certificaciones, voluntariado y proyectos. Resultado: una versión ATS pobre y puntajes bajos que no eran de formato.
- **Segundo pase con la IA local sobre el TEXTO ORIGINAL** (`lib/ats/enrich.ts`). El modelo solo **localiza y copia**: devuelve fragmentos literales (viñetas, nota de la empresa, certificaciones, voluntariado, habilidades agrupadas, proyectos). El código descarta todo fragmento que no aparezca **tal cual** en el texto original (comparación sin tildes, mayúsculas ni signos, tolerante a líneas partidas por el OCR). Así no puede inventar ni reescribir.
- **Solo rellena, nunca pisa**: viñetas solo en puestos que quedaron vacíos; habilidades solo si las actuales parecen rotas (ítems de más de 40 caracteres, más de 60 ítems o con «%»); proyectos solo si no había. Los porcentajes de dominio («Figma 100 %») se reducen al nombre de la herramienta, porque un porcentaje no es una habilidad escrita.
- **Secciones nuevas**: Certificaciones (después de Educación) y Voluntariado (al final). El CV estructurado de la app no tiene dónde guardarlas; viven solo en la versión ATS.
- **Fechas**: `MM/AAAA` (C6). Lo que **no trae fecha** (un curso sin año) ya no impide ordenar: queda al final y no genera aviso. Solo una fecha escrita pero ilegible («verano») hace que se respete el orden original, con un mensaje que lo explica.
- **Resumen largo**: si el del CV pasa de 4 frases o 400 caracteres (ATS-S3) se cortan las últimas frases completas; no se reescribe nada y se avisa.
- **Verificador**: compara contra el CV **con lo recuperado** y el contenido nuevo se rastrea hasta el texto original completo (ATS-I1/I2).
- **Costo**: la lectura profunda es la parte lenta (una llamada larga a Ollama). Se hace **una vez por CV**: «Generar de nuevo» reutiliza lo recuperado. Medición en `docs/BENCHMARKS.md`.
- **Límites**: el texto original se guarda en el navegador junto al perfil (hasta 40 000 caracteres); un CV subido antes de A5 no lo tiene y se genera sin lectura profunda hasta que se vuelva a subir. Un modelo pequeño puede omitir contenido (no inventarlo).

## 10. Auditoría de la plantilla contra las fuentes (23-nov-2026)
Pedida por Juan: la plantilla no se decide por gusto sino por lo que dice la documentación. **Veredicto: la plantilla coincide con la de Google (`[GOO]`) y con Indeed en la estructura; ningún elemento va contra una fuente, salvo los puntos marcados «abierto».**

| Elemento de la plantilla | Qué dicen las fuentes | Veredicto |
|---|---|---|
| Una sola columna | RIO, IND, ENH, GOO, ADO, TOP, NOV, WRK: todas | ✔ unanimidad |
| Sin tablas, cuadros de texto, imágenes, íconos, barras de nivel | RIO, IND, ENH, GOO, ADO, TOP, NOV, WRK | ✔ unanimidad |
| Contacto en el cuerpo, sin encabezado ni pie | RIO, IND, GOO, TOP, NOV, WRK (NOV: el pie, vacío o solo con número de página) | ✔ |
| Nombre → titular → contacto | ADO («tu título» en la cabecera), NOV (titular tras el nombre), ENH (título en el encabezado); TOP e IND no lo ponen | ✔ 3 fuentes a favor, ninguna en contra |
| Contacto: ciudad, teléfono, correo, enlaces con `|` | IND y GOO usan exactamente esa línea; TOP incluye LinkedIn; NOV dice «solo nombre, teléfono, correo y ciudad» | ✔ (los enlaces solo salen si el CV original los trae) |
| Encabezados estándar («Experiencia laboral», «Educación», «Habilidades»…) | IND, GOO, ENH, TOP, NOV, ADO, WRK; todas prohíben títulos creativos | ✔ unanimidad |
| Resumen con encabezado | 4 a favor, NOV en contra (C7) | ✔ mayoría |
| Orden Resumen → Experiencia → Educación → Habilidades | IND, GOO, ENH; NOV pone Habilidades antes (C8) | ✔ aceptable, orden no obligatorio |
| Cronológico inverso | RIO, ENH, GOO, ADO, NOV, WRK («no funcional») | ✔ |
| `Cargo — Empresa, Ciudad | MM/AAAA – MM/AAAA` | GOO usa **exactamente** este orden (con mes en texto, ver C6); IND usa `Cargo | Empresa | Ciudad | Fechas`; TOP, `Empresa | Cargo | Fechas`; todas piden coherencia | ✔ |
| Fechas «Mes Año» + «Presente» | 3 a favor, `MM/AAAA` en NOV y ENH (C6) | ✔ **resuelto** (A5): `MM/AAAA`, con evidencia de un lector real (C6) |
| Viñetas «•» | TOP (ejemplo «•»), ENH («• o –») | ✔ |
| Habilidades separadas por comas, por grupo | ENH («comas, no barras»), GOO; IND y NOV usan viñetas | ✔ |
| Arial 10,5 pt | Arial en RIO, IND, GOO, ADO; 10–12 pt en IND, ADO, ENH; GOO 10,5–12; NOV ≥ 10 | ✔ |
| Márgenes de 2 cm | ENH 1,25–2,5 cm; ADO 1,9–2,5 cm | ✔ (dentro de ambos rangos) |
| PDF con texto **y** Word | Word: RIO, IND, WRK, ADO; PDF: ENH, TOP (por defecto), NOV (PDF de texto < 2,5 MB); todas: «si la oferta pide otro formato, manda la oferta» | ✔ |
| 1–2 páginas | RIO (1–2), NOV (1 con < 10 años, máximo 2) | ✔ |
| Sin foto | ADO, NOV; ENH la tolera (C4) | ✔ mayoría |
| Nombre de archivo `Nombre-Apellido-Cargo` | NOV (mismo patrón), RIO, WRK | ✔ |

**Ajustes que salieron de la auditoría** (ya aplicados arriba y en el generador): cargos sin abreviaturas (ATS-E10, NOV/WRK); resumen de ≤ 4 líneas (ATS-S3, GOO/NOV); tamaño de archivo < 2,5 MB (ATS-F8); orden de Educación y Habilidades flexible (ATS-S5); sin espaciado entre letras (ATS-T5); rango de viñetas más laxo (ATS-E6).

**Lo que sigue sin respaldo** (honestidad): (1) ninguna fuente es documentación oficial de un ATS; son guías de empresas de empleo, así que el porcentaje seguirá siendo «cumple las guías»; (2) nada en español; (3) el formato de fecha (C6); (4) si el PDF generado por Chromium se lee igual de bien que uno de Word en cada ATS: solo lo sabríamos probándolo contra un parser real.

## 11. Cómo mide el verificador y qué NO puede medir (A3, 23-nov-2026)
El verificador (`lib/ats/verify.ts`) lee el **archivo** generado (PDF o Word), no los datos de entrada. Cada regla da «cumple», «no cumple» o «no aplica» (las que no aplican no suman ni restan). Las reglas de peso crítico (C) fallidas limitan el máximo a 69 %.

| Tema | PDF | Word (.docx) |
|---|---|---|
| Texto, orden de lectura | Texto real extraído con pdf.js, agrupado por línea; se compara con el texto esperado | Párrafos de `document.xml` |
| Fuente real | Nombres `/BaseFont` del PDF (p. ej. `ArialMT`) | `w:rFonts` de lo que el documento usa |
| Tamaños y márgenes | Altura de cada texto y posición medida en la página | `w:sz` y `w:pgMar` |
| Imágenes, anotaciones | Operadores de imagen y anotaciones que no son enlaces | `word/media`, `w:drawing`, `w:pict` |
| Tablas y cuadros de texto | **No se detectan directamente**: se infieren por huecos horizontales grandes (indicio de columnas) | `w:tbl`, `w:txbxContent` |
| Columnas | Huecos horizontales > 3 × tamaño de letra | `w:cols w:num` > 1 |
| Encabezado/pie | Texto de contacto en la franja de 36 pt superior o inferior | Partes `header`/`footer` con texto |
| Colores | Operadores de color de relleno y trazo | `w:color`, `w:shd`, `w:highlight` **solo de los estilos que el documento usa** |
| Negrita de títulos | Se asocia cada texto con su fuente por el orden en que el PDF las declara (si no cuadra, queda «desconocida» y no falla) | `w:b` |
| Páginas | Sí (≤ 2) | **No**: depende de quien lo abra; solo se mide que no haya señales de encogimiento |
| Espaciado entre letras | **No se puede medir** | `w:spacing w:val` en el texto |

**Límites que conviene tener presentes**
- Los títulos de sección se detectan por tamaño (PDF: más grande que el cuerpo, salvo el nombre) o por el estilo «Título 1» (Word). Funciona con nuestros archivos; con un CV ajeno es una heurística.
- ATS-E5 (verbo de acción) usa listas y terminaciones por idioma: es una **heurística** de confianza baja.
- ATS-I1 (nada inventado) reutiliza el verificador de datos del resto de la app: revisa cifras, fechas, nombres, siglas y términos técnicos, **no palabras comunes en minúscula**.
- ATS-T1 acepta Liberation Sans/Serif y Arimo/Tinos como equivalentes métricos de Arial/Times (así un servidor Linux no suspende al PDF).
- Ninguna comprobación sustituye probar el archivo en un ATS real.

## 12. Calibración del verificador (A6, 23-nov-2026)
Motivo: con el CV real de Juan el porcentaje no llegaba a 100 % por cosas que el generador no controla, y un Word ajeno (hecho por otra herramienta) daba un fallo crítico falso.
- **Dos clases de regla** (`lib/ats/rules.ts`, `TIP_IDS`). **Formato**: lo controla el generador; define el porcentaje y debe poder llegar a 100 %. **Consejo** (ATS-F6 páginas, S3 resumen, E5 verbos y longitud, E6 viñetas por puesto, E9 siglas, I3 relleno, I4 frases vagas, y las nuevas Q1 y Q2): dependen de lo que la persona escribió; se muestran aparte en «Consejos para tu CV» y **no restan**. Razón: el generador no puede acortar un CV de 12 puestos sin omitir datos, y omitir viola ATS-I2.
- **Títulos en archivos ajenos**: además del estilo «Título» (Word) o el tamaño (PDF), una línea corta que es exactamente un título conocido («EXPERIENCIA LABORAL», «Habilidades:») cuenta como título. Con esto el Word de referencia dejó de fallar ATS-S1 (falso crítico).
- **Un puesto** empieza en una línea con « — »; sus descripciones y líneas partidas ya no se cuentan como puestos (falsos fallos de ATS-E1 y ATS-E6). Un puesto con descripción pero sin viñetas es válido.
- **Orden de secciones** (ATS-S5): Certificaciones se acepta junto a Educación y Habilidades; Voluntariado al final.
- **Tasa de lectura** (idea de Enhancv): se muestra el % de las palabras esperadas que se recupera del archivo (`readRate`).
- **Nuevas, Enhancv** (ENH): ATS-Q1 (≥ 25 % de viñetas con cifra) y ATS-Q2 (sin 3 viñetas que empiecen igual). Ambas B, confianza baja, consejos. Reglas: **42**.
- **Rangos con guion corto** copiados de certificaciones («2018 - 2021») se escriben con « – » (solo puntuación).
- **Resultado**: el Word de referencia pasa de 69 % por S1 falso a 69 % por **ATS-I1** (su contenido es de otra versión del CV, correcto que falle); nuestros archivos: 100 % de formato.
- **Límite**: 1 solo CV real y 1 documento ajeno calibrados; es una heurística, no una prueba contra un ATS real.
