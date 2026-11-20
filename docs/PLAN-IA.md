# Plan para poner inteligencia en el negocio (propuesta, 19-nov-2026)

Estado: **borrador para discutir**, no está construido. Parte de lo que ya existe: lectura del CV (reglas + modelo local), motor de coincidencia `computeFit` (7,6 ms por oferta), embeddings `bge-m3` en `jobs.embedding`, juez local con cita por número, memoria de decisiones y el puerto de fuentes (≈ 1 300 ofertas).

## Reglas del juego (no cambian)
- **IA solo local** (Ollama: qwen2.5:7b, gemma4, qwen3.5, bge-m3). Un modelo de 7B es **confiable señalando números y clasificando**, y poco confiable copiando texto o razonando largo (medido en K4). Por eso: el modelo elige o puntúa, el código verifica.
- **Nada inventado**: todo lo que se muestre del CV debe poder rastrearse a una cita; lo que se muestre de una oferta, a su texto.
- **«La IA aprende»** no significa entrenar el modelo. Significa tres cosas distintas: (1) **estadísticas** del mercado y del uso, (2) un **ordenador** pequeño (regresión) cuyos pesos se ajustan con lo que la gente hace, y (3) **memoria** de preferencias de cada persona (como la que ya hay para la reescritura). El LLM se usa para entender lenguaje y explicar.
- **Privacidad**: el CV no sale del equipo; los eventos de uso se guardan sin datos personales y con consentimiento.
- **Todo se mide** en `docs/BENCHMARKS.md` (tiempo y calidad); sin una medición propia no se afirma una mejora.

## Un concepto de producto antes de la IA
- **CV base (perfil de búsqueda)** ≠ **CV adaptados**. El primero es lo que el buscador sabe de ti (ya implementado: se elige a propósito y optimizar otro CV no lo cambia). Los adaptados son versiones por oferta y viven en una **biblioteca de CV** enlazada a la oferta (hoy es el historial).
- **Preferencias de búsqueda** (cargos objetivo, nivel, modalidad, ciudades, piso salarial, «no quiero…») además del CV: 4–5 preguntas con botones, guardadas aparte.

## Capas de IA por momento del recorrido
| # | Momento | Qué hace la IA | Cómo (y cómo se verifica) |
|---|---|---|---|
| 1 | **Tú subes tu CV** | Perfil de carrera: cargos a los que apuntas, nivel, habilidades **con la evidencia** de dónde salen, huecos de fechas | Reglas + modelo con cita por número (ya existe el esqueleto); verificación contra el texto |
| 2 | **Llegan ofertas** (ingesta) | Enriquecer las que vienen pobres (hoy Cabify 2 de 28 y Fintual 0 de 4 tienen contenido para estimar encaje): requisitos, tareas, años, nivel, salario; **familia de cargo y sector** (para el filtro «tecnología primero»); calidad del aviso; repetidas entre fuentes | Cola en segundo plano con caché por huella; el modelo señala líneas del texto; solo se guarda lo que existe literalmente |
| 3 | **Buscas** | Entender la búsqueda («diseñador UX remoto con Figma») → filtros + sinónimos es↔en; ya hay texto + significado | Modelo pequeño devuelve filtros estructurados; el resto es SQL |
| 4 | **Te recomendamos** | Embudo en 3 pasos: (a) candidatas por región y cercanía de vectores perfil↔oferta (miles en ms), (b) encaje por reglas sobre las ~200 mejores (1,5 s), (c) **juez local solo sobre las 10–20 primeras**: «por qué encaja / qué falta» con cita del CV | Caché por (huella del CV, huella de la oferta); medir NDCG y acierto contra un conjunto de pares etiquetados |
| 5 | **Ves una oferta** | Una frase honesta de encaje («encaja porque… / te falta…») y «cómo cerrar el hueco» **sin inventar cursos ni logros** | Misma cita por número; si no hay evidencia, no se dice |
| 6 | **Vas a postular** | Adaptar el CV (existe); **carta** y **respuestas a preguntas de formulario** («¿por qué quieres trabajar aquí?», pretensión salarial) basadas solo en tu CV y la oferta; preparación de entrevista | Verificador anti-invención que ya usa la reescritura |
| 7 | **Después** | Seguimiento de postulaciones, recordatorios, qué cambió en el aviso (cerrado, editado) | Eventos + estado de la oferta (ya se cierra lo que desaparece) |
| 8 | **El mercado** | **Tendencias**: qué habilidades y cargos suben o bajan por país y semana (de nuestro propio corpus); «lo que piden donde buscas y tu CV no muestra» | Conteos con la taxonomía + series por semana; sin modelo, sin costo |
| 9 | **El uso** | Búsquedas más frecuentes por región (sugerencias), qué se abre/guarda/postula/descarta → **ordenador aprendido** que mejora el orden | Registro de eventos sin datos personales; regresión logística entrenada fuera de línea; se compara contra el orden actual antes de activarlo |

## Orden propuesto (impacto / esfuerzo)
1. **Cola de enriquecimiento de ofertas + familia de cargo y sector** (capa 2): desbloquea el filtro «tecnología» y mejora el encaje de las ofertas pobres. *Alto impacto, esfuerzo medio.*
2. **Embudo de recomendación y explicación** (capas 4 y 5) con **conjunto de evaluación**: primero etiquetamos ~100 pares CV×oferta (tú juzgas «buen/mal match») para tener con qué medir. *Alto impacto, esfuerzo medio.*
3. **Eventos y tendencias** (capas 8 y 9): sugerencias de búsqueda, panel de mercado, ordenador aprendido. *Medio, bajo costo.*
4. **Asistente de postulación** (capa 6). *Medio-alto, esfuerzo medio.*
5. **Entendimiento de la búsqueda y preferencias** (capas 3 y 1). *Medio.*
6. **Cuentas, consentimiento y alertas** (capas 7 y la privacidad de todo lo anterior). *Habilitador.*

## Decisiones tomadas (19-nov-2026)
1. **Tecnología primero: sí.** El buscador abre con el filtro «Tecnología» (familias técnicas: desarrollo, datos, diseño digital, producto, infraestructura, calidad, seguridad, gestión de tecnología, soporte TI, consultoría TI). Implementado con reglas (`lib/jobs/classify.ts`); la IA se reserva para lo ambiguo.
2. **Match = encaje de 75 % o más** (`MATCH_MIN` en `lib/jobs/match.ts`). Implementado: insignia «Match», filtro «Solo los que hacen match» y orden por encaje sobre las mejores candidatas.
3. **Eventos**: se registran búsquedas, aperturas, postulaciones, guardados y descartes con consentimiento (aprobado y construido el 19-nov-2026): ver `docs/CONSENTIMIENTO.md`. Primer uso real: el orden «Para mí» y las búsquedas populares.
4. **Cálculo**: en el momento, con caché por (CV, oferta) y vectores para traer primero las candidatas más cercanas al CV; sin lotes nocturnos hasta que existan cuentas (hoy el CV vive en el navegador de cada persona).

## Decisiones que necesito de ti (pendientes)
1. **¿Tecnología primero?** Propongo etiquetar cada oferta con familia de cargo (diseño, datos, desarrollo, producto, operaciones…) y sector, y abrir el buscador con «Tecnología» activado.
2. **¿Qué es un «match»?** Una definición operativa (p. ej. ≥ 70 % de encaje y sin faltar ningún requisito obligatorio) que usaremos para el aviso «hacen match contigo» y para medir.
3. **Eventos de uso**: ¿qué registramos (búsquedas, aperturas, postulaciones, descartes)? y ¿cómo pedimos el consentimiento?
4. **Cálculo**: ¿en el momento (más simple) o por lotes cada noche por persona (más rápido al abrir, requiere cuentas)?
5. **Modelos**: probar qwen2.5:7b vs gemma4:e4b para el juez/explicador; elijo con una medición.
