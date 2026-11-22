# Investigación: el correo de postulación como primer contacto (21-nov-2026)

Pedido de Juan: sus amigos probaron el asistente y piden **más libertad** (tono, calidez, extensión, tipo de lenguaje, poner o no el correo, el teléfono, datos personales…). Como este correo es el primer contacto con la empresa, se investigó qué más aporta valor. **No hay código nuevo en este documento: es una propuesta para decidir.**

## 1. Qué dice la evidencia (y cuánta confianza merece)
Casi todo viene de blogs de empleo y encuestas de proveedores; **no hay estudios rigurosos** sobre qué correo de postulación recibe más respuestas. Se usa como guía, no como cifra a prometer.

| Tema | Lo que coincide entre fuentes | Confianza |
|---|---|---|
| **Asunto** | Cargo + nombre (+ código de referencia si la oferta lo trae); corto (≈ 40–50 caracteres útiles porque el móvil corta); evitar «Hoja de vida» a secas; **respetar el formato de asunto que pida la oferta**. [Indeed](https://au.indeed.com/career-advice/career-development/write-email-subject-job-application), [elempleo](https://www.elempleo.com/co/noticias/consejos-profesionales/como-enviar-tu-hoja-de-vida-por-correo-electronico-6016), [Kickresume](https://www.kickresume.com/es/blog/resume-email-tips-and-samples/) | Media |
| **Extensión** | Corto gana: 2–3 párrafos, ≈ 120–200 palabras; el reclutador lee unos 30 s. [Magneto](https://www.magneto365.com/es/blog/redactar-correo-para-enviar-hoja-de-vida), [Zety](https://zety.com/blog/recruiting-preferences), [Enhancv](https://enhancv.com/blog/email-to-send-resume/) | Media (encuestas de blogs) |
| **Estructura** | Saludo → quién eres y a qué vacante → por qué encajas (conectar con requisitos, con palabras de la oferta) → cierre con llamada a la acción y contacto. Mencionar **cómo te enteraste** de la oferta. [elempleo](https://www.elempleo.com/co/noticias/tendencias-laborales/que-escribir-al-enviar-tu-cv-tres-parrafos-que-te-abriran-las-puertas-8828), [Magneto](https://www.magneto365.com/es/blog/redactar-correo-para-enviar-hoja-de-vida) | Media |
| **Tono** | Respetuoso sin rigidez, **consistente de principio a fin**; saludar por nombre si se conoce. [Proton](https://proton.me/es-419/business/blog/job-application-email) | Media |
| **Adjunto** | PDF por defecto salvo que la oferta pida Word; nombre claro («Nombre_Apellido_CV_Empresa.pdf»); nada de ZIP ni imágenes. [TopResume](https://topresume.com/career-advice/resume-file-formats), [The Muse](https://www.themuse.com/advice/the-answer-to-should-my-resume-be-submitted-as-a-word-doc-or-pdf) | Media |
| **Seguimiento** | Esperar ≈ 1 semana (rango 5 días–2 semanas), respetar el plazo que diga la oferta, un solo recordatorio. [Seek](https://nz.seek.com/career-advice/article/how-to-follow-up-a-job-application), [The Muse](https://www.themuse.com/advice/heres-how-long-you-should-wait-to-follow-up-at-every-point-in-the-job-search) | Media |
| **Datos personales** | Datos de contacto sí; no hay fuente que respalde mandar documento de identidad, fecha de nacimiento, foto o estado civil. En Colombia, la Ley 1581 pide consentimiento y finalidad; los datos de contacto no son sensibles. (El tema legal lo cubre tu abogado.) [SIC / texto de la ley](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981+) | Baja (no hallé guía específica para selección) |

**No afirmamos**: «aumenta X % las respuestas». Una cifra de 53 % de más llamadas para cartas de 200–400 palabras circula en un blog sin fuente verificable; no se usa.

## 2. Qué ya hace bien la app y dónde está el hueco
Ya: destinatario correcto, asunto de la oferta, cuerpo con datos reales del CV, verificador anti-invención, 3 propuestas, ajustes de longitud/tono/enfoque.
Hueco (lo que más valor aporta): **la app no sabe qué pide la oferta en el correo** (aspiración salarial, disponibilidad, enlace a portafolio, LinkedIn, referencias, idioma) y un correo que ignora esas instrucciones suele descartarse. Además el usuario no controla qué datos suyos salen.

## 3. Propuesta de ajustes (agrupados para no sobrecargar)
Principio: **valores por defecto buenos + presets arriba; lo avanzado, escondido por pestañas**. El drawer de ajustes usa el `SlidingChoice` ya hecho como selector de pestañas: **Estilo · Datos · Contenido**, con una fila de **presets** encima («Cercano y breve», «Formal», «Directo», «Mi estilo» guardado).

### Pestaña «Estilo» (cómo suena)
| Ajuste | Opciones | Cómo se implementa |
|---|---|---|
| Registro | Sobrio · Profesional · Cercano · Casual (**siempre de tú**) | instrucción al modelo + plantillas de respaldo por registro |
| Calidez | Neutra · Cálida · Entusiasta | idem; el verificador ya evita formas con género |
| Tipo de lenguaje | Sencillo · Técnico (usa el vocabulario de la oferta) · Narrativo | el «técnico» toma términos de los requisitos (ya los tenemos) |
| Longitud | Mínimo (1–2 frases) · Corto · Medio · Largo | hoy 3; se agrega «mínimo» |
| Idioma | Automático (el de la oferta, ya se detecta) · Español · Inglés | útil en ofertas de empresas internacionales |
| Saludo y cierre | «Hola, equipo de X» · «Estimado equipo de selección» · por nombre si la oferta lo trae; cierre con pedir una conversación / ofrecer disponibilidad / solo agradecer | reglas, sin IA |

### Pestaña «Datos» (qué sale de ti) — el pedido de tus amigos
Interruptores por dato, cada uno solo existe si el CV lo trae (nunca inventado): **teléfono · correo en la firma · ciudad · LinkedIn · portafolio/web · GitHub/Behance**. Por defecto: nombre + teléfono + correo + portafolio; ciudad apagada. Aviso suave (no bloqueo) si la persona escribe a mano documento de identidad, fecha de nacimiento o estado civil: «no hace falta en un primer contacto».
- **Datos que pide la oferta y el CV no tiene** (alto valor): se detectan por reglas en el texto («aspiración salarial», «disponibilidad inmediata», «adjuntar portafolio», «enviar LinkedIn», «referencias») y aparecen como campos a completar (`Falta: aspiración salarial`). **Se llenan solo con lo que la persona escribe**, nunca con una cifra inventada. Este es el cambio que más evita que un correo sea descartado.

### Pestaña «Contenido» (qué dice)
| Ajuste | Qué aporta | Fuente de verdad |
|---|---|---|
| Enfoque (ya existe) | experiencia / habilidades / motivación / variado | CV + oferta |
| **Un logro de mi CV** | la persona elige 1 viñeta de su CV (ordenadas por relevancia con la oferta); se cita tal cual, sin reescribir cifras | viñetas del CV |
| **Dónde vi la oferta** | «Vi su publicación en LinkedIn» (dato real de la fuente) | `job.source` |
| **Me recomendó…** | si hay referido, un campo que la persona llena | lo que escribe la persona |
| Llamada a la acción | pedir conversación · ofrecer disponibilidad · ninguna | reglas |

## 4. Más valor fuera de los ajustes
1. **«Qué tan bien responde este correo a la oferta»**: indicador simple «menciona 3 de 5 requisitos clave» (ya existe el cálculo de cubiertos/relacionados) y chips de lo que falta; sin promesas de resultado.
2. **Revisión final antes de copiar (paso 4)**: lista corta de comprobaciones por reglas: asunto ≤ ~60 caracteres (con vista previa de cómo lo corta un móvil), sin marcadores sin rellenar, empresa bien escrita, destinatario elegido, **nombre sugerido del adjunto** (`CV-Nombre-Empresa.pdf`, ya lo genera `cvFileName`) con botón de copiar y de descargar.
3. **Unir con «Adaptar mi CV»**: ofrecer primero adaptar el CV a la oferta y luego el correo (misma oferta, mismo flujo).
4. **Seguimiento**: guardar localmente «postulé el …» y, a los 7 días (o el plazo de la oferta), un recordatorio con un borrador de correo de seguimiento (otra fase; encaja con el «Después» del plan).
5. **Mi estilo**: recordar presets y datos activos para todas las ofertas (localStorage hoy; cuenta mañana).
6. **Confianza**: al pasar el cursor por una frase, mostrar de dónde sale («tu CV» / «la oferta»). Es lo que más diferencia frente a un redactor de IA genérico, pero es la pieza más cara; va al final.

## 5. Riesgos y límites a tener presentes
- **Rendimiento del modelo local**: hoy ≈ 21 s la primera propuesta y 7–14 s las siguientes (`docs/BENCHMARKS.md`); más ajustes = más texto en el prompt. Conviene que la parte de datos, saludo, cierre y firma siga siendo **determinista** (reglas), y que la IA solo escriba el párrafo central.
- **Calidad del modelo**: ya observamos arranques repetidos, formas con género y «la área»; cada ajuste de estilo nuevo necesita su prueba y, donde falle, su plantilla de respaldo.
- **Más opciones ≠ mejor**: por eso presets + pestañas + valores por defecto; medir con tus amigos cuáles ajustes se tocan de verdad antes de sumar más.

## 6. Orden recomendado (una por vez, con tu visto bueno)
1. **S5 · Datos y lo que pide la oferta**: interruptores de datos en la firma, detección de lo que pide la oferta (salario, disponibilidad, enlaces, referencias) con campos a completar, «dónde vi la oferta». *(Reglas, sin riesgo de IA; es lo que más pidieron y lo que más valor da.)*
2. **S6 · Estilo**: pestañas Estilo/Datos/Contenido en el drawer, presets, registro, calidez, tipo de lenguaje, longitud «mínimo», idioma, saludo y cierre.
3. **S7 · Contenido y revisión**: logro del CV a elección, indicador de requisitos, revisión final con nombre del adjunto, unión con «Adaptar mi CV».
4. **S8 · Seguimiento**: registro local y borrador de seguimiento.

## 7. Decisiones para Juan
1. ¿Empezamos por **S5 (datos + lo que pide la oferta)**?
2. Valores por defecto de datos: ¿**nombre + teléfono + correo + portafolio** encendidos y ciudad apagada?
3. **Inglés**: ¿lo incluimos desde S6 (automático según la oferta)?
4. ¿El «Seguimiento» entra en este alcance o queda para después de P2/P3?
