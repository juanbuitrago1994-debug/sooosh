---
description: Ejecuta solo la siguiente fase pendiente del plan, la verifica, hace commit y se detiene
---

1. Lee `CLAUDE.md`, `docs/PLAN.md` y `docs/STATUS.md`. Respeta todas las reglas permanentes.
2. Identifica la **primera fase con criterios sin marcar** en PLAN.md. Si el STATUS indica cambios pedidos por Juan, atiéndelos primero dentro de esa fase.
3. Lee la guía relevante de `node_modules/next/dist/docs/` antes de escribir código de Next.
4. Implementa **solo esa fase**. No adelantes trabajo de otras.
5. Verifica con la definición de terminada de CLAUDE.md: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` y `pnpm test`. (Las capturas y la auditoría de accesibilidad las hace Juan en la app; no corras `pnpm shots` ni `pnpm a11y` salvo que lo pida.) Verifica uno por uno los criterios de aceptación y marca `[x]` en PLAN.md solo los comprobados por código, tests o pruebas reales; lo puramente visual déjalo anotado en "Para revisar por Juan".
6. Actualiza `docs/STATUS.md`: fase actual, qué quedó hecho, qué verificaste (con resultados reales) y la lista "Para revisar por Juan" con pasos exactos y cortos.
7. Haz `git commit` con mensaje claro (`feat(faseN): ...`). Solo añade los archivos de la fase.
8. **Detente.** No empieces la siguiente fase. Resume en pocas líneas lo hecho y qué debe revisar Juan.

Si algo no puede quedar en verde, no marques la fase como terminada: documenta el bloqueo en STATUS.md y detente.
