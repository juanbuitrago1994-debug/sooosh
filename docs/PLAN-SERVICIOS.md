# Plan de servicios y funciones (propuesta, 20-nov-2026)

Cuatro frentes, cada uno con **objetivo medible**, pasos, qué necesito de ti, riesgos y cómo sabremos que terminó. Las cifras de partida son de la base real de hoy.

## Orden recomendado
| # | Frente | Esfuerzo | Por qué en este orden |
|---|---|---|---|
| 1 | **B. Cola de estructurado con IA** | Bajo | Mejora ya la calidad del encaje; casi todo está construido |
| 2 | **A. Cobertura de Colombia y Argentina** | Medio-alto | Mayor efecto en tus mercados; tiene tareas tuyas (contactos) con plazos largos, así que conviene arrancarlas pronto |
| 3 | **D. Revisión legal del consentimiento** | Bajo (nuestro) + externo | Hay que empezarla antes de tener usuarios reales; el abogado tarda |
| 4 | **C. Capas de IA que faltan** | Alto, por etapas | Valor alto, pero necesita primero buenos datos (B), más cobertura (A) y un conjunto de evaluación |

A, B y D pueden avanzar en paralelo. C se hace por etapas, y cada etapa tiene su meta.

---

## Frente A — Cobertura de Colombia y Argentina

**Punto de partida (hoy).** Hay dos formas de contarla, y conviene no confundirlas:
- *Ofertas con sede en el país* (presenciales o híbridas): **Colombia 164** (58 de tecnología), **Argentina 129** (69). Es lo más flojo.
- *Ofertas que ve una persona que busca desde ese país* (las del país + las remotas abiertas a toda Latinoamérica): **Colombia 910** (481 de tecnología), **Argentina 850** (476). Chile 1.521 y México 1.087. La cobertura real es mejor de lo que parece, pero depende de las remotas.

**Objetivos medibles (a 8 semanas)**
1. Ofertas con sede en Colombia: 164 → **400** (tecnología 58 → **150**).
2. Ofertas con sede en Argentina: 129 → **300** (tecnología 69 → **150**).
3. Que ninguna sola fuente aporte más del 50 % de las ofertas de esos dos países (hoy, casi todo depende de pocas empresas).
4. Mantener el estándar legal: cero fuentes leídas sin respetar `robots.txt`, términos o atribución.

**Pasos**
- **A1 · Diagnóstico (1–2 días, yo).** Qué empresas aportan hoy las ofertas de Colombia y Argentina, y cuáles faltan frente a una lista de unas 300 empresas que contratan allí. Entregable: lista priorizada.
- **A2 · Más empresas con tablero público (1 semana, yo).** Repetir el barrido de Greenhouse, Lever, Ashby, Workable, Recruitee y SmartRecruiters con nombres de empresas de Colombia y Argentina, más buscar el tablero que cada empresa enlaza desde su página de empleo. Esto es lo más barato y legal.
- **A3 · Fuentes públicas oficiales (investigación 2–3 días, yo).** Portales de empleo públicos y datos abiertos de cada país. *Por verificar:* no sé aún si tienen API o datos abiertos utilizables; la investigación lo dirá.
- **A4 · «Publica tu oferta» (2 semanas, yo).** Un formulario donde una empresa pega el enlace de su tablero; tú apruebas en el panel. Da cobertura a cambio de visibilidad y no necesita cuentas.
- **A5 · Feed de socio (plazo largo, tuyo + yo).** Computrabajo, Bumeran/Navent, elempleo y similares no se pueden leer sin su permiso (bloquean robots o cargan con JavaScript). Preparo una propuesta de una página (qué ofrecemos: tráfico cualificado y atribución; qué pedimos: un feed); la parte de contactar es tuya.
- **A6 · Seguimiento (continuo).** Con la foto diaria por fuente ya existente, un indicador por país en el panel de administración.

**Lo que necesito de ti:** priorizar países (¿Colombia primero?), enviar la propuesta a los portales (A5) y decidir si aceptamos A4.
**Riesgos:** los portales grandes pueden no responder (por eso A2–A4 no dependen de ellos); los datos de fuentes públicas pueden venir sin estructura (se enriquecen con la cola de IA del frente B).
**Terminado cuando:** se cumplen los objetivos 1–3 en el panel durante 2 semanas seguidas.

---

## Frente B — Cola de estructurado con IA

**Punto de partida.** 412 ofertas en cola, 239 hechas, 11 omitidas, 3 fallidas. 586 de las ofertas activas siguen «pobres» (menos de 2 elementos entre requisitos, deseables y tareas): sin eso, su encaje con un CV no se puede calcular bien. Costo medido: unos 12–17 s por oferta en tu Mac (≈ 1,5–2 h para vaciar la cola actual).

**Objetivos medibles**
1. Vaciar la cola actual: 412 → **0** (esta semana).
2. Régimen estable: **el 95 % de las ofertas nuevas pobres, estructuradas en menos de 24 h**, y menos de 100 pendientes en cualquier momento.
3. Bajar las ofertas pobres de 586 → **menos de 250** (de las que una parte vendrá de mejores lectores, no de la IA).
4. Calidad: en una muestra semanal de 20 ofertas, **100 % de los requisitos y tareas son frases literales del aviso** (la regla de oro, nunca inventar) y ≥ 90 % son útiles al leerlas.

**Pasos**
- **B1 · Vaciar la cola (hoy, tú o yo).** `pnpm sync --phase=enrich --minutes=120` en tu Mac, o el botón «Enriquecer 10» varias veces. Necesita tu Mac encendido y Ollama abierto.
- **B2 · Prioridad inteligente (½ día, yo).** Procesar primero tecnología, luego Colombia y Argentina, luego lo más reciente.
- **B3 · Menos trabajo para la IA (1–2 días, yo).** Mejorar los lectores de HTML de Remotive, Jobicy y Himalayas para sacar listas sin modelo; así solo llegan a la IA las ofertas realmente sin estructura.
- **B4 · Vigilancia (½ día, yo).** Profundidad de la cola y antigüedad de la más vieja en el estado de la sincronización; aviso si pasa de 500 pendientes o 48 h.
- **B5 · Control de calidad (½ día, yo).** Una prueba automática de «literalidad» (cada elemento aparece en el texto original) y un informe semanal de la muestra.

**Lo que necesito de ti:** dejar el Mac encendido con Ollama abierto durante B1 (y, a futuro, decidir si algún día vale la pena un equipo siempre encendido).
**Riesgos:** si el Mac está apagado, la cola crece (se mide con B4); un modelo local lento limita el ritmo.
**Terminado cuando:** objetivos 1–4 cumplidos durante una semana.

---

## Frente C — Capas de IA que faltan

Basado en `docs/PLAN-IA.md`. Cada etapa tiene una meta medible y un criterio para detenerse si no rinde. Todo con IA local; los datos personales (CV) nunca salen de tu equipo.

| Etapa | Qué | Objetivo medible | Depende de |
|---|---|---|---|
| **C1** | **Entender lo que busca la persona** («diseñador UX remoto con Figma» → filtros + sinónimos español↔inglés) | ≥ **85 %** de 50 búsquedas de prueba (escritas a mano) se traducen en los filtros correctos; ≤ **1,5 s** local; si falla, cae a la búsqueda actual sin romperse | Nada |
| **C2** | **Conjunto de evaluación + juez y explicación** («encaja porque… / te falta…») | Juez local sobre las 10–20 primeras mejora la precisión de las 10 primeras en **+15 puntos** frente a las reglas; **100 %** de las frases de la explicación citan el CV o la oferta | ~100 pares CV×oferta etiquetados por ti (≈ 2 h tuyas) y frente B |
| **C3** | **Asistente de postulación** (carta y respuestas de formulario) | En una muestra de 30, **≥ 90 %** de las frases se pueden rastrear al CV o a la oferta, y **0** datos inventados (mismo verificador que el CV adaptado) | C2 (la misma disciplina de evidencia) |
| **C4** | **Panel de tendencias del mercado** (qué habilidades y cargos suben por país y semana) | Panel con ≥ 4 semanas de datos propios, con conteos reproducibles | La foto diaria (ya existe) + semanas de datos |
| **C5** | **Orden aprendido con la actividad** (aperturas, guardados, postulaciones) | Cuando haya datos suficientes: **+10 %** de aperturas entre las 10 primeras frente al orden actual, medido sin conexión | Tráfico real: ≥ 5.000 impresiones y ≥ 300 aperturas con consentimiento «Para todos», y cuentas |

**Recomendación:** C1 → C2 → C3 → C4; **C5 queda en espera** hasta que haya usuarios.
**Lo que necesito de ti:** C2 (etiquetar 100 pares) y elegir el modelo con una medición (qwen2.5:7b frente a otro) cuando lleguemos.
**Riesgos:** un juez local lento (por eso solo sobre las 10–20 primeras); sin etiquetas propias no hay cómo demostrar que mejora, por eso C2 va antes que C3.

---

## Frente D — Revisión legal del consentimiento

**Punto de partida.** El texto y el flujo están construidos (`docs/CONSENTIMIENTO.md`): dos niveles («Para mí» / «Para todos»), 90 días de retención, mínimo de 5 personas distintas para agregados, borrar mis datos. **No es asesoría legal**: es un borrador técnico que debe validar un abogado antes de tener usuarios reales.

**Objetivos medibles**
1. **Visto bueno escrito de un abogado** con experiencia en protección de datos en Latinoamérica (Colombia: Ley 1581 de 2012; Chile: Ley 19.628 y la nueva ley de datos; Argentina: Ley 25.326; México y Perú, si se abren).
2. Publicar **política de privacidad y términos de uso** en el sitio, antes del primer usuario real.
3. Un registro de cumplimiento por fuente (términos, `robots.txt`, atribución) con fecha de revisión (ya existe `terms_reviewed_on` en la tabla `sources`).
4. Decidir la **licencia del código público** (hoy el repositorio no tiene ninguna, así que está «todos los derechos reservados»).

**Pasos**
- **D1 · Expediente para el abogado (1–2 días, yo).** Inventario de datos (qué se guarda, dónde, cuánto tiempo), diagramas de flujo, texto del consentimiento, cómo se borra, qué NO se guarda, quién tiene acceso (secretos), uso de Supabase y GitHub, y el tratamiento local del CV.
- **D2 · Buscar y contratar al abogado (tú).** Te preparo un resumen de una página y las preguntas concretas a resolver (¿consentimiento suficiente?, ¿transferencia internacional a Supabase?, ¿qué avisos son obligatorios por país?, ¿responsabilidad por mostrar ofertas de terceros?).
- **D3 · Incorporar sus observaciones (yo, 1–2 días).** Con nueva versión de consentimiento (el sistema ya vuelve a pedirlo si cambia la versión).
- **D4 · Páginas legales (yo, 1–2 días).** `/privacidad` y `/terminos`, enlazadas desde el pie y desde el consentimiento.
- **D5 · Licencia (tú decides, yo lo dejo listo).**

**Lo que necesito de ti:** contratar al abogado y decidir la licencia.
**Riesgos:** el abogado puede pedir cambios al diseño del consentimiento (por eso va antes de abrir al público); plazos externos.
**Terminado cuando:** hay visto bueno escrito y las páginas legales están publicadas.

---

## Cronograma sugerido (semanas)
| Semana | B | A | D | C |
|---|---|---|---|---|
| 1 | B1–B2 (vaciar y priorizar) | A1–A2 (diagnóstico y más empresas) | D1 (expediente) | C1 (entender la búsqueda) |
| 2 | B3–B5 (lectores, vigilancia, calidad) | A3 (fuentes públicas) y envío de la propuesta A5 | D2 (tú: abogado) | C2 (te pido las etiquetas) |
| 3–4 | Régimen estable | A4 («Publica tu oferta») | D3–D4 | C2 (juez) |
| 5–8 | — | Seguimiento de A y ajustes | D5 | C3, luego C4 |

## Decisiones que necesito de ti
1. ¿Empiezo por **B1** hoy (vaciar la cola, requiere tu Mac con Ollama abierto) y por **A1–A2**?
2. **País prioritario** para la cobertura: ¿Colombia primero?
3. ¿Apruebas el formulario **«Publica tu oferta»** (A4) y quién contacta a los portales (A5)?
4. ¿Tienes un abogado en mente (D2) o te preparo una lista de criterios para buscarlo?
