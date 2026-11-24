# Componentes de IA y movimiento (`components/ai/`)

Única excepción a la regla "solo componentes y tokens de shadcn" (ver `docs/DESIGN-PATTERNS.md` §5). Todo el movimiento usa la librería `motion` y las constantes de `lib/motion.ts`. Principio: **lento, suave y casi imperceptible**; solo se mueve algo cuando responde a una acción del usuario o a un avance real del pipeline.

| Pieza | Qué hace |
| --- | --- |
| `AiAura` | Luz ambiental muy tenue dentro de la tarjeta mientras la IA trabaja: dos manchas difuminadas que **derivan despacio** (translate, ~16 s por ciclo) y aparecen/desaparecen con opacity. Sin bordes ni giros. Solo variables del tema (`var(--primary)`, `var(--chart-4)`). Es el único componente con `style` en línea. |
| `ThinkingTicker` | Mensaje de estado (`role="status"`, `aria-live="polite"`): cada palabra entra con blur + translate + opacity, escalonadas (0,045 s), y luego "respira" con una onda lenta de opacidad. **Cambia solo cuando cambia `step`**, el paso real del pipeline; nunca por temporizador. El texto completo va una vez en `sr-only`. |
| `AiStage` | Envuelve la tarjeta. Con `working`: el contenido se atenúa y desenfoca apenas (opacity 0,55 · blur 2 px, e `inert`), aparece `AiAura` y un overlay con `MatrixLoader` + `ThinkingTicker` (+ "Cancelar"). |
| `MatrixLoader` | Matriz 4×4 de puntos que pulsan solo con opacidad, con 4 patrones (ola, onda, barrido, espiral) elegidos por el **paso real** del análisis (`patternForStep`). Decorativa (`aria-hidden`); quieta con movimiento reducido. Inspirada en transitions.dev, reimplementada con `motion`. |
| `StepTransition` | Transición fluida entre pasos: la pantalla saliente sube y se desenfoca, la entrante sube desde abajo y se aclara. |
| `AiWorkProvider` / `useAiWork` | Estado compartido: los pasos llaman `start(mensajes, onCancel)`, `advance(i)` y `stop()`; el shell lo pinta con `AiStage`. |

(`StepDots`, en `components/wizard/`, rellena cada segmento con un resorte suave usando solo translate.)

## Reglas
- Solo **opacity, blur (filter) y translate (x, y)**. Nunca `scale`: ningún texto crece ni se encoge. Sin rotaciones, sin bordes animados.
- `prefers-reduced-motion`: sin translate, sin escalonado, sin onda ni deriva; el estado se comunica con opacidad y texto.
- Misma duración y easing en todas las pantallas: solo desde `lib/motion.ts` (hay un test que lo vigila).
- Entradas (0,5 s) más lentas que salidas (0,28 s).

## Uso
```tsx
const ai = useAiWork()
ai.start(["Leyendo tu CV", "Estructurando"], cancel)  // al empezar
ai.advance(1)                                          // cuando el pipeline pasa de verdad a la etapa 2
ai.stop()                                              // al terminar o fallar
```
