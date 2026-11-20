# Rúbrica de análisis profundo (Fase K)

Código: `lib/analysis/rubric.ts` (fuente de verdad; `tests/rubric.test.ts` la protege). Aquí, el porqué.

## Principios
1. **Ficha, no porcentaje.** El resultado es una ficha de 9 dimensiones con hallazgos por criterio; el número global es solo un resumen derivado y ponderado.
2. **Todo hallazgo cumplido o parcial cita texto literal del CV** (`basis: "cita"`), o es una **medición del documento** (`basis: "medicion"`, p. ej. «2 páginas estimadas»). Sin cita solo puede ser brecha (`no-cumple`) o `no-aplica`. `unverifiedEvidence()` rechaza citas que no estén en el CV. Una dimensión que la oferta no pide queda `applicable: false` y no cuenta en el global.
3. **Reglas antes que modelo.** Lo que se puede contar (años, fechas, cifras, secciones, orden, contacto) se calcula sin IA (`regla`). El modelo local solo juzga lo cualitativo (`juez`) con salida JSON estricta, y lo `mixto` combina ambos.
4. **Herramientas e idiomas solo cuentan por nombre o sinónimo**, nunca por parecido semántico (brecha aunque haya algo parecido).
5. **Nada se inventa.** Las recomendaciones (K5) solo reordenan, reexpresan o priorizan lo que el CV ya demuestra; lo que falta se pregunta o se deja como brecha.
6. **Todo número de calidad o rendimiento sale de una medición propia** (`docs/BENCHMARKS.md`).

## Dimensiones y pesos (suman 100)
| Dimensión | Peso | Qué se mira |
|---|---|---|
| Experiencia profesional | 20 | relevancia, recencia, orden y énfasis, huecos |
| Habilidades técnicas | 15 | cobertura de obligatorios y deseables, uso en contexto, lo importante se ve primero |
| Logros e impacto | 15 | cifras, fórmula acción-contexto-resultado, verbos, longitud |
| Herramientas y tecnologías | 12 | presencia por nombre/sinónimo, uso, agrupación |
| Titular y resumen | 10 | alineación con el rol, fórmula, claves respaldadas, sin clichés |
| Educación y certificaciones | 8 | nivel pedido, certificaciones relevantes |
| Seniority y años | 8 | años sumados desde fechas, nivel demostrado |
| Estructura, formato y ATS | 7 | secciones estándar, cronología inversa, contacto, extensión, lectura como texto |
| Habilidades transversales | 5 | demostradas con hechos, no declaradas |

Los criterios exactos (id, `check`, pregunta) están en `DIMENSIONS`.

## Cómo alimenta lo siguiente
- K2 (oferta enriquecida) y K3 (CV por secciones) producen las entradas de la ficha.
- K4 calcula la ficha con el mismo motor antes y después de los cambios.
- K5 convierte hallazgos débiles en cambios atómicos con motivo, evidencia, impacto estimado y riesgo.
