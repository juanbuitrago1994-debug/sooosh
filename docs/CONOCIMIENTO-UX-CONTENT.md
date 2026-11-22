# Conocimiento de UX content para el correo de postulación (22-nov-2026)

**Para qué sirve este archivo.** Es la base de conocimiento de la que se alimentan (a) la guía de estilo que se le da al modelo local (Ollama) al redactar, (b) el verificador y la revisión final por reglas, y (c) las decisiones de diseño del texto de toda la app. Está escrito para que una persona lo lea y para que se pueda recortar en piezas pequeñas: cada regla tiene un **código** (`R-…`), una **fuente** y una **confianza**.

**Cómo leer la confianza**
- **Alta**: la regla está en una fuente primaria o en varias que coinciden y se leyó la página.
- **Media**: una sola fuente seria, o varias fuentes de blog que coinciden sin estudio detrás.
- **Baja**: una sola fuente de blog, o fuentes en conflicto, o es una síntesis nuestra.
- **Síntesis nuestra** (`[SN]`): decisión de producto que combina fuentes; no es una cita.

**Qué NO afirma este archivo.** No hay estudios rigurosos sobre qué correo de postulación recibe más respuestas. Las cifras de longitud de los blogs de empleo no tienen fuente primaria. Lo que sí tiene estudio detrás (NN/g) es **cómo se lee en pantalla** y **cómo el tono cambia la percepción**, y eso es lo que sostiene las reglas generales. Cómo se obtuvo: lectura directa de las páginas (fecha de lectura: 22-nov-2026); lo que no se pudo leer está en la sección 9.

---

## 1. Principios (el orden de prioridad)

| Código | Principio | Fuente | Confianza |
|---|---|---|---|
| R-P1 | **Claridad primero, brevedad segundo, carácter tercero.** El tono nunca debe estorbar la claridad ni la brevedad. | NN/g «3 C's of informational microcopy» (2026) | Media (recomendación sin estudio) |
| R-P2 | **Escribe para tu lector concreto**, no «para todos»: su conocimiento, su prisa y su estado de ánimo. En un correo de postulación, quien lee es una persona de selección con muchos correos. | digital.gov Plain language; Atlassian voz y tono | Alta |
| R-P3 | **La voz es constante; el tono cambia con la situación** (quién lee, cómo se siente, qué está haciendo). | Mailchimp; Atlassian | Alta (coinciden dos guías de producto) |
| R-P4 | **Sé veraz y específico**: sin exageraciones ni promesas vacías. Lo promocional se lee peor y se filtra. | NN/g Morkes & Nielsen 1997 (estudio con 51 personas: la versión «objetiva» mejoró usabilidad ≈ 27 % frente al control); Mailchimp «habla con verdad» | Alta para «objetivo mejora la lectura» |
| R-P5 | **Una sola idea por párrafo y una sola petición por correo.** | NN/g; Plain language; fuentes de empleo | Alta / Media |
| R-P6 | **Nunca inventes datos** (empleos, cifras, herramientas, fechas): todo lo que el texto afirme debe salir del CV o de la oferta. | Regla permanente de Sooosh (`CLAUDE.md`) | Regla del producto |

## 2. Cómo se lee en pantalla (evidencia de NN/g)

| Código | Hallazgo | Detalle y alcance | Fuente |
|---|---|---|---|
| R-L1 | **Se escanea antes de leer.** 79 % de las personas siempre escaneó una página nueva y 16 % leyó palabra por palabra (estudio de 1997; la página enlazada con la muestra no se leyó). | La cifra es antigua y de páginas web, no de correos. Se usa como guía, no como porcentaje a prometer. | `nngroup.com/articles/how-users-read-on-the-web/` |
| R-L2 | **Concisión + escaneabilidad + objetividad se suman.** En 5 versiones de un mismo sitio (51 personas): concisa −42 % de tiempo de tarea (209 s frente a 359 s, p < .05); escaneable −36 % (229 s); combinada −58 % (149 s) y de 0,82 a 0,10 errores. Memoria y satisfacción mejoran. | Es un estudio de sitio web de turismo, 1997. El texto «conciso» usa ≈ la mitad de palabras. | `nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/` |
| R-L3 | **Pirámide invertida**: lo más importante primero; la primera frase de cada párrafo lleva la idea; las primeras palabras de cada frase, informativas. | Sin estudio en la página; se apoya en R-L1/R-L2. | `nngroup.com/articles/inverted-pyramid/` |
| R-L4 | **Lenguaje claro sirve también a personas expertas.** | Estudio con personas expertas (ciencia, tecnología, medicina); la página no da muestra, sus citas son ilustrativas. | `nngroup.com/articles/plain-language-experts/` |

## 3. Tono (qué es y cómo se elige)

**Cuatro dimensiones de NN/g** (cada una es un espectro; se elige una posición, no un extremo):
1. **Formal ↔ casual**
2. **Serio ↔ gracioso**
3. **Respetuoso ↔ irreverente**
4. **Neutral (de datos) ↔ entusiasta**

Evidencia (NN/g, Moran 2016, encuestas de 50 y 100 personas de EE. UU. sobre páginas casi idénticas que solo cambian de tono): el tono **cambia la percepción de amabilidad, confianza y deseabilidad**, con diferencias **pequeñas (≈ 0,3 a 1 punto en escala de 5)** y significativas (p < 0,05). La confianza explicó ≈ 52 % de la varianza de la deseabilidad (asociación, no causalidad). **Los tonos casuales, conversacionales y moderadamente entusiastas rindieron mejor en general**; el tono juguetón/irreverente fue más amable pero **menos confiable** en el caso del seguro. Muestra estadounidense y de sitios web: no es de correos de empleo.

| Código | Regla | Fuente | Confianza |
|---|---|---|---|
| R-T1 | Define el tono combinando las 4 dimensiones y afínalo con **pocas** palabras de tono (≤ 5); anota también las palabras de tono **a evitar**. | NN/g tone-of-voice-dimensions | Media |
| R-T2 | **No vayas a los extremos**: enfatiza lo elegido sin que domine. | NN/g | Media |
| R-T3 | Varía el tono con el **estado emocional** de quien lee (confundida, apurada, aliviada…); la voz no cambia. | NN/g; Mailchimp; Atlassian | Alta |
| R-T4 | **Humor: solo si encaja y sale natural**; si dudas, no. El humor forzado es peor que ninguno. En un primer contacto laboral, no lo uses. | Mailchimp; Atlassian; NN/g (riesgo en confianza) | Alta |
| R-T5 | Sé **llano**: sin exageración, sin «upsells», sin sobreprometer; traduce la jerga a explicación simple. | Mailchimp | Alta |
| R-T6 | **Positivo**: evita «no puedo / no hay» cuando haya una forma afirmativa. Ej.: «Para recibir X, haz Y», no «No recibirás X si no haces Y». | Mailchimp | Media |
| R-T7 | **Exclamaciones**: pocas y nunca más de una seguida; ninguna en avisos o errores. En un primer contacto laboral, ninguna. | Mailchimp; Google (evitar); Enhancv (sin emojis ni exclamaciones en primer contacto) | Alta para «pocas»; Media para «ninguna» |
| R-T8 | **Sin emojis** en un correo de postulación. | Enhancv (baja); consistente con Mailchimp «con moderación» | Baja |
| R-T9 | Mantén **el mismo registro de principio a fin**. | Proton | Baja |
| R-T10 | Evita muletillas de relleno: «tenga en cuenta», «por favor note», «cabe destacar». Evita «simplemente», «fácilmente», «rápidamente». Evita «por favor» repetido en instrucciones. | Google developer style (tono) | Media |
| R-T11 | Evita metáforas, modismos y referencias culturales difíciles de traducir. | Google; Atlassian (audiencia global) | Media |
| R-T12 | Evita comenzar todas las frases igual («Tengo…», «Soy…»); usa transiciones sin estancar. Léelo en voz alta: lo que suena raro, se reescribe. | Google | Media |

### Cómo se traducen los 3 tonos de Sooosh a estas dimensiones `[SN]`
| Tono Sooosh | Formal↔casual | Serio↔gracioso | Respetuoso↔irreverente | Neutral↔entusiasta | Palabras de tono | Evitar |
|---|---|---|---|---|---|---|
| **Cercano** | medio-casual | serio | respetuoso | levemente entusiasta | amable, natural, directo | jerga, confianza excesiva, chistes |
| **Profesional** | formal | serio | respetuoso | neutral | claro, preciso, sobrio | frialdad, rigidez, palabras de relleno |
| **Directo** | formal-neutro | serio | respetuoso | neutral | breve, concreto | adornos, cortesías largas, adjetivos |

## 4. Estructura y mecánica del texto

| Código | Regla | Ejemplo | Fuente | Confianza |
|---|---|---|---|---|
| R-E1 | **Abre con lo principal** y dile a quien lee qué esperar. | «Me postulo a la vacante de X publicada en Y.» | digital.gov; Mailchimp; GOV.UK; fuentes de empleo (4 de 4 coinciden) | Alta |
| R-E2 | **Frases cortas**: unas 15 a 20 palabras (NN/g); GOV.UK sugiere partir lo que pase de ≈ 25 [resumen, no verificado en la página]. | Parte con punto o «y». | NN/g plain-language-experts; GOV.UK A–Z | Media |
| R-E3 | **Párrafos cortos y de una sola idea**; ≤ 3 párrafos en este correo. | | NN/g; fuentes de empleo | Alta |
| R-E4 | **Voz activa**: el sujeto realiza la acción. | «La empresa contaminó el lago», no «El lago fue contaminado por la empresa». | digital.gov; Mailchimp | Alta |
| R-E5 | **Verbos en vez de sustantivos «escondidos»** (-ción, -miento, -ancia). | «Analizamos los datos», no «Realizamos un análisis de los datos». | digital.gov | Alta |
| R-E6 | **Tiempo presente** salvo que la precisión pida otro. | | digital.gov | Media |
| R-E7 | **Palabras corrientes**; si usas un término técnico, que sea el de la oferta y que la persona lo entienda. | | NN/g; Mailchimp; digital.gov | Alta |
| R-E8 | **Sin abreviaturas ni siglas** sin explicar la primera vez; sin «etc.»; sin «e.g./i.e.». | «por ejemplo», «es decir» | GOV.UK A–Z (verificado en página) | Media |
| R-E9 | **Fechas sin ordinales ni coma**; rangos con «a»/«al», no con guion. | «10 al 21 de noviembre» | GOV.UK A–Z (verificado) | Media |
| R-E10 | Listas con viñetas solo si hay varios puntos; frase de introducción antes; un solo punto por viñeta. | | GOV.UK A–Z; digital.gov | Media |
| R-E11 | Coma de serie solo si el idioma de destino la usa: **en español no se pone coma antes de «y» en enumeraciones**. | | `[SN]` (la regla de Mailchimp es para inglés) | — |
| R-E12 | **No uses negritas** para énfasis en un correo; el énfasis se logra poniendo lo importante primero. | | GOV.UK A–Z | Media |
| R-E13 | **Direcciones de correo completas y en minúscula**, sin palabras en el enlace. | | GOV.UK A–Z | Media |

## 5. El correo de postulación: estructura y contenido

Fuentes leídas: elempleo (Colombia, 10-abr-2026), Magneto365 (Colombia), Enhancv (19-nov-2026), Proton (8-dic-2025); de reclutador o de correo en frío (solo principios): Workable (2023), Underdog (2026), Grammarly (2026). **Ninguna cita un estudio primario** para sus cifras.

| Código | Regla | Fuente | Confianza |
|---|---|---|---|
| R-C1 | **Estructura**: asunto → saludo → 3 párrafos cortos → mención del adjunto → cierre con una petición → firma. | elempleo, Magneto, Enhancv, Proton (coinciden) | Alta |
| R-C2 | **Saludo** con el nombre si se conoce; si no, «Estimado equipo de Talento Humano» o similar. **Nunca «a quien corresponda»**. | elempleo, Enhancv; Magneto, Proton | Alta |
| R-C3 | **P1 (propósito)**: cargo exacto, código de la vacante si existe y **dónde viste la oferta**. | las cuatro | Alta |
| R-C4 | **P2 (ajuste)**: 2 o 3 logros o experiencias concretos que respondan a **requisitos de la oferta**, con verbos de acción y cifras **si el CV las trae**. | las cuatro | Alta |
| R-C5 | **P3 (interés y disponibilidad)**: algo real y específico de la empresa y disponibilidad para conversar. Si no hay un dato real de la empresa, no lo inventes. | elempleo, Magneto, Enhancv | Alta |
| R-C6 | Si la oferta usa una palabra concreta de un requisito que la persona sí cumple, **úsala textual** una vez. | elempleo (única fuente explícita) | Baja |
| R-C7 | **Cierre**: una sola petición (una conversación corta) + agradecimiento. | elempleo, Magneto, Enhancv, Grammarly, Workable, Underdog | Alta |
| R-C8 | **Longitud**: el **techo** es ≈ 200 palabras (Magneto, Workable); Enhancv propone 120–180; Grammarly 75–125 para correo en frío. **Ninguna cifra tiene estudio.** Usar 120–180 como objetivo y 200 como límite duro. | Magneto, Workable, Enhancv, Grammarly | Alta para el techo; Baja para el rango |
| R-C9 | **Asunto**: `Postulación [cargo] – [Nombre]` (+ código si existe); evitar «Hoja de vida» a secas, mayúsculas, signos de exclamación, «urgente». Corto (< 60 caracteres; NN/g: lo que pasa de 60 suele truncarse). | elempleo, Magneto, Enhancv, Proton, NN/g | Alta (patrón); Baja (cifra de largo) |
| R-C10 | **Adjunto**: PDF salvo que la oferta pida otro; nombre con **nombre y apellido + tipo de documento (+ empresa)**; sin «final_2». Menciónalo en una frase. | elempleo, Magneto, Enhancv, Proton | Alta |
| R-C11 | **Firma**: nombre completo, teléfono con indicativo, correo, LinkedIn o portafolio, ciudad. | Magneto, Enhancv, elempleo | Alta |
| R-C12 | **Mismo correo para varias vacantes sin adaptar** = error. | Proton, Workable | Alta |
| R-C13 | **Seguimiento**: esperar ≈ 7–10 días; máximo 2–3 mensajes. | Enhancv, Proton (7–10 días); Grammarly (3–5 días hábiles, correo en frío) | Alta (7–10); Baja (resto) |
| R-C14 | **Frases a evitar**: «a quien corresponda»; «excelente/gran oportunidad»; «su prestigiosa empresa»; «soy una persona proactiva/responsable» **sin dato que lo respalde**; «Mi nombre es… y le escribo porque…» como apertura. | elempleo, Enhancv, Workable, Underdog, Grammarly | Alta / Baja según frase |
| R-C15 | **Errores**: olvidar el adjunto o mencionarlo sin adjuntar; ortografía, sobre todo del **nombre** de la persona; correo personal poco profesional. | Proton, Enhancv, Magneto, Workable | Alta |
| R-C16 | **No repitas el CV palabra por palabra**: el correo señala lo que el CV demuestra. | Proton | Baja |

### Tuteo y «usted» `[SN]`
Los ejemplos colombianos (Magneto, Proton) usan **«usted» en el primer contacto**; ninguna fuente prohíbe el tuteo. **Decisión de producto de Juan (21-nov-2026): el correo sale siempre de «tú»** (`CLAUDE.md`, plan P0.5). Se mantiene. Queda como **pregunta abierta** para validar con sus amigos y con ofertas reales: ¿en cargos formales (banca, legal, sector público) conviene un tono «Profesional» con tratamiento neutro (frases sin sujeto de segunda persona: «quedo atento a una conversación»)? Esto se resuelve por plantilla, no por IA.

## 6. Pautas de lenguaje (español) — solo lo verificado

### Gramática
Fuente: Wikipedia en español (páginas «Queísmo», «Dequeísmo», «Gerundio»), leídas el 22-nov-2026. La RAE y la Fundéu **no se pudieron leer** (bloqueo de la herramienta); lo que se les atribuye aquí viene de esas páginas y debe contrastarse con la RAE antes de tratarlo como norma. Los ejemplos incorrecto → correcto salen de las páginas.

| Código | Regla | Ejemplo | Confianza |
|---|---|---|---|
| R-G1 | **Queísmo**: no omitas «de» ante «que» cuando el verbo lo pide. Prueba: cambia la subordinada por «eso». | ✗ «Me alegro que te vayas» → ✓ «Me alegro de que te vayas» · ✗ «Estoy de acuerdo que…» → ✓ «Estoy de acuerdo en que…» | Media |
| R-G2 | **Dequeísmo**: no pongas «de» ante «que» si el verbo no lo pide (pensar, creer, opinar, afirmar, temer, desear, ordenar…). | ✗ «Me ha dicho de que vendrá» → ✓ «Me ha dicho que vendrá» · ✗ «Creo de que…» → ✓ «Creo que…» | Media |
| R-G3 | **Gerundio de posterioridad**: no lo uses para acciones que ocurren **después** de la principal sin inmediatez; usa verbos conjugados. | ✗ «Trabajé en X, desarrollando Y y obteniendo Z» → ✓ «Trabajé en X y desarrollé Y; después obtuve Z» | Media (los prescriptivistas lo censuran; algunos autores lo aceptan) |
| R-G4 | **Gerundio adjetivo** (sustantivo + gerundio): evítalo; usa «que + verbo». | ✗ «Un documento confirmando…» → ✓ «Un documento que confirma…» (reescritura nuestra) | Media |
| R-G5 | **Gerundio con objeto directo inanimado**: incorrecto. | ✗ «levantó el saco transportando grava» → ✓ «levantó el saco que transportaba grava» | Media |
| R-G6 | Gerundios válidos: anterioridad, simultaneidad, modo, causa («Habiendo terminado…»). El de conclusión («Resumiendo,…») es válido. | | Media |

### Lenguaje claro en español (páginas leídas; **no** son las guías oficiales colombianas)
Fuentes: artículo de prensa sobre la guía del Ministerio de Justicia de España ([economistjurist.es](https://www.economistjurist.es/actualidad-juridica/justicia-impulsa-una-guia-que-insta-a-los-juristas-a-escribir-normal)) y resumen de la norma ISO de lenguaje claro ([meer.com](https://www.meer.com/es/84337-redaccion-en-lenguaje-claro-segun-la-iso-y-otras-fuentes)). Son fuentes secundarias y de España/general; coinciden con las reglas de GOV.UK y digital.gov (§4), lo que les da confianza media.

| Código | Regla | Fuente | Confianza |
|---|---|---|---|
| R-G7 | **Evita oraciones de más de 40 palabras** y usa más puntos y seguido. (Nuestro objetivo es más estricto: R-E2, 15–25.) | economistjurist (guía de Justicia, España) | Media |
| R-G8 | Reduce el **gerundio ilativo** (el que encadena acciones) porque alarga las frases. | economistjurist | Media |
| R-G9 | **Limita las nominalizaciones**: «que el proceso se desarrolle correctamente», no «el correcto desarrollo de la causa». | economistjurist; meer | Media |
| R-G10 | **Un tema por párrafo, con el núcleo al inicio**; evita párrafos de una sola oración; usa el punto y aparte para estructurar. | economistjurist; meer | Media |
| R-G11 | **Voz activa** y orden sujeto + verbo + complemento; nombra quién hace la acción. | meer | Media |
| R-G12 | **No acumules negaciones**; formula en positivo. | meer | Media |
| R-G13 | **Siglas**: desarróllalas la primera vez, salvo las muy comunes. | meer | Media |
| R-G14 | **Palabras breves**, sin las innecesarias, **el mismo término para el mismo concepto**, y explica los términos técnicos. | meer | Media |

### Correo formal en español (una sola fuente comercial legible: [IONOS](https://www.ionos.com/es-us/digitalguide/correo-electronico/e-mail-marketing/escribir-correos-electronicos-como-dar-la-talla/); no es RAE ni Fundéu)
| Código | Regla | Confianza |
|---|---|---|
| R-M1 | **Saludo**: «Estimado/a …:» con **dos puntos** y el texto siguiente **en línea nueva y con mayúscula**. Si no sabes el género de quien recibe, búscalo en la web de la empresa o redes; si no aparece, usa una fórmula neutra («Estimado equipo de …»). | Baja (una sola fuente; coincide con los ejemplos de elempleo/Magneto) |
| R-M2 | **Cuerpo**: frases cortas, vocabulario sencillo, párrafos de ≈ 3 líneas; varios datos → lista. | Baja |
| R-M3 | **Cierre** con una frase que invite a actuar; **evita «esperamos noticias suyas pronto»** si la persona no lo ha aceptado: presiona. **Despedida**: «Saludos cordiales». | Baja |
| R-M4 | Tono positivo; **evita el imperativo al pedir algo**. | Baja |
| R-M5 | **Evita** abreviaturas, ironía, humor, emoticonos, texto sin párrafos y posdatas («P. D.»). | Baja |
| R-M6 | **Adjuntos**: solo los imprescindibles, ≈ 5 MB como máximo; si pesan más, un enlace. | Baja |

**Pendiente de contrastar (no verificado, no se usa como regla)**: reglas con cifras de las guías colombianas (DNP 2015, Colombia Compra, SIC, Bogotá: sus PDF no tienen texto legible para las herramientas), RAE y Fundéu (bloqueadas), «con el fin de» → «para», «a nivel de», «aplicar a una vacante», «cordial saludo» y la forma de adjuntar («adjunto / se adjunta / adjuntamos»). **Acción para Juan o su equipo**: abrir a mano la guía del DNP (secciones «Simplifique la estructura de las oraciones», «Utilice voz activa», «Use palabras sencillas»), el [Manual de lenguaje claro de Colombia Compra 2025](https://www.colombiacompra.gov.co/wp-content/uploads/2026/01/Manual-de-Lenguaje-Claro-e-Incluyente-2025_Para-publicacion.pdf) y la [cartilla de la Cancillería](https://cancilleria.gov.co/sites/default/files/FOTOS2018/cartilla_lenguaje_claro.pdf), y pegar aquí el texto para poder citarlas.

## 7. Cómo usa esto la app (propuesta para S7c)

1. **Guía compacta para el modelo** (≤ ≈ 300 tokens, por petición; ver §8): principios R-P4/R-P5, estructura R-C1…R-C5, reglas de frase R-E2/R-E4/R-E5, gramática R-G1…R-G3 y las frases a evitar R-C14. Variantes según tono (§3) y longitud.
2. **Verificador por reglas** (ya existe para datos inventados): agregar frases prohibidas (R-C14), exclamaciones (R-T7), emojis (R-T8), apertura «Mi nombre es» (R-C14), gerundio de posterioridad frecuente («…, desarrollando/obteniendo/logrando») y largo de frase > 25 palabras (R-E2).
3. **Revisión final del paso 4** (por reglas): longitud total ≤ 200 palabras (R-C8), asunto < 60 caracteres (R-C9), adjunto mencionado (R-C15), nombre del adjunto (R-C10), una sola petición (R-C7).
4. **Plantillas** de respaldo escritas siguiendo las mismas reglas.
5. **Medición**: antes y después de poner la guía en el prompt, medir tiempo de respuesta y la tasa de propuestas que el verificador acepta, en `docs/BENCHMARKS.md`. No se promete mejora de calidad sin medirla.

## 8. Guía compacta (el texto que se le daría al modelo)

> *Borrador, aún no está conectado al código. Se afina en S7c y se mide.*

```
Escribes el párrafo central de un correo para postularse a una vacante. Quien lo lee tiene poco tiempo.
- Primera frase: lo más importante (qué cargo y por qué encajas). Sin «Mi nombre es» ni «Le escribo para».
- 2 o 3 frases cortas (≈ 15–20 palabras). Voz activa, verbos en vez de sustantivos («analicé», no «realicé un análisis de»).
- Usa solo datos del CV y términos de la oferta que te doy. Nunca inventes cifras, empresas ni herramientas.
- Palabras corrientes. Sin adjetivos de relleno («proactivo», «excelente oportunidad», «prestigiosa empresa»).
- Una sola idea por frase. Sin exclamaciones ni emojis. Sin gerundios de posterioridad («…, desarrollando X y logrando Y»).
- Trato de tú, neutro (sin formas con género).
```
Variantes por tono: **Cercano** «amable y natural; frases simples» · **Profesional** «formal y preciso; usa el vocabulario de la oferta» · **Directo** «sobrio; la información mínima necesaria, sin cortesías largas».

## 9. Fuentes y lo que no se pudo leer

**Leídas (22-nov-2026)**
- NN/g: `tone-of-voice-dimensions`, `tone-voice-users`, `3-cs-microcopy`, `plain-language-experts`, `how-users-read-on-the-web`, `inverted-pyramid`, `concise-scannable-and-objective-how-to-write-for-the-web` (esta última, cortada al final: sus cifras normalizadas no se verificaron y no se usan).
- GOV.UK A–Z (la primera mitad en texto completo; el resto por resumen) y digital.gov (plain language, principios y escritura). `plainlanguage.gov` redirige a digital.gov.
- Mailchimp (voice and tone, writing principles, grammar and mechanics), Atlassian (voice and tone), Google developer style (tone).
- Correo de postulación: elempleo, Magneto365, Enhancv, Proton; de reclutador o correo en frío: Workable, Underdog, Grammarly.
- Wikipedia en español: Queísmo, Dequeísmo, Gerundio. Prensa y resumen de lenguaje claro en español: economistjurist.es y meer.com. Correo formal: IONOS.

**No se pudieron leer (no se usaron)**: RAE (DPD, Libro de estilo; error 403), Fundéu (bloqueo), PDF de la guía de lenguaje claro del DNP (certificado), PDF de SIC y Colombia Compra (el PDF no tiene texto extraíble por las herramientas), páginas de Atlassian de lenguaje y gramática, y los artículos de NN/g enlazados `applying-writing-guidelines-web-pages`, `writing-domain-experts`, `tone-voice-samples`, `tone-voice-words`.

**Límites a recordar**: casi todo el material es en inglés y de sitios web, no de correos de empleo; las fuentes de empleo son blogs; en español la base es Wikipedia, dos artículos secundarios y una guía comercial (ninguna oficial colombiana). Falta validar con personas reales (Juan y sus amigos) qué tono funciona en ofertas colombianas.
