@AGENTS.md

# CV Tailor — reglas permanentes

Estas reglas aplican a toda fase y toda tarea. No se negocian.

## UI
- Solo componentes de shadcn (`components/ui/*`, añadidos con `pnpm dlx shadcn@latest add`) y sus **tokens semánticos** (`bg-background`, `text-muted-foreground`, `border`, `bg-primary`, etc.).
- Prohibido: tokens propios, CSS propio (más allá de `app/globals.css` generado por shadcn), colores literales (`bg-blue-500`, `#fff`) y **valores arbitrarios** de Tailwind (`w-[480px]`, `text-[13px]`, `p-[7px]`).
- Antes de crear un componente a mano, busca en shadcn (MCP `shadcn` o `shadcn add`). Compón con Sidebar, Empty, Field, Progress, Sonner, Card, etc.
- Web **responsiva**: móvil (375), tableta (768) y escritorio (1280). Sin scroll horizontal en ningún ancho. Objetivos táctiles ≥ 44 px (`size-11`/`min-h-11`).
- Tema claro y oscuro deben verse bien.
- **Excepciones documentadas a "solo shadcn"** (solo dos): `components/ai/*` (movimiento de IA, p. ej. `AiAura`, `MatrixLoader`; sin giros ni bordes animados) y `components/magic/*` (efectos pedidos expresamente por Juan el 20-nov-2026 para el distintivo «Ofertas encontradas»: haz de luz en el borde, `BeamBadge`, y dígitos que giran en tambor 3D, `DrumNumber`; y la insignia rosa «Curated by Sooosh», `CuratedBadge`, pedida por Juan el 21-nov-2026, con los tokens `curated-pink`/`curated-size` de `docs/DESIGN-TOKENS.md`; usan solo variables del tema o esos tokens documentados y respetan `prefers-reduced-motion`). Fondo de la app: color sólido del tema (`--background`), sin degradados ni valores arbitrarios de Tailwind.
- **Movimiento y microinteracciones** (aprobado por Juan el 20-nov-2026): primero las utilidades de Tailwind (`tw-animate-css`, `transition-*`, `motion-safe:`, retrasos con los pasos fijos `delay-75…`, sin valores arbitrarios). Para lo que no alcance se permiten librerías abiertas de movimiento ya existentes, **verificadas antes de añadirlas** (licencia MIT, mantenimiento activo y uso masivo, sin dependencias dudosas, versión fijada exacta, revisión del lockfile) y sin reescribir ni envolver componentes de shadcn. Aprobadas: `motion` (ya instalada), `@formkit/auto-animate` (candidata, 63 KB, sin dependencias) y `border-beam` (MIT, fija en 1.4.1, sin dependencias, revisada el 20-nov-2026: sin red, sin `eval`, sin scripts de instalación; se usa solo a través de `components/magic/beam.tsx`). Duraciones cortas (≤ 200–300 ms), sin rebotes largos y **siempre** respetando `prefers-reduced-motion`. Los efectos se centralizan en `components/ai/*` o en un componente de movimiento reutilizable; no se dispersa CSS propio.
- **Contenedores (UI v2)**: `components/glass-panel.tsx` (`GlassPanel`: blur, fondo semitransparente, borde muy tenue, sin sombra) es el único contenedor permitido y solo en esta lista cerrada: (1) línea de tiempo del análisis, (2) tarjeta de cambio en la revisión, (3) menús y diálogos, (4) tarjeta de oferta del buscador (aprobado por Juan el 19-nov-2026), (5) panel lateral (Drawer de shadcn) con el estado de las fuentes de ofertas (aprobado por Juan el 20-nov-2026), (6) panel lateral (Drawer de shadcn) del asistente de correo de postulación (aprobado por Juan el 21-nov-2026). En cualquier otro lugar `Card` está prohibido (las pantallas aún no rediseñadas lo conservan hasta que les toque).
- **Anillo de foco de los campos** (21-nov-2026): `Input`, `Textarea`, `NativeSelect`, `Select` e `InputGroup` dibujan el anillo **hacia adentro** (`ring-2 ring-inset`), así ningún contenedor con scroll u `overflow-hidden` lo recorta por los lados.
- **Espaciado de paneles laterales (Drawer)** (definido con Juan el 21-nov-2026): **24 px (`gap-6`)** entre bloques —título + descripción, cada campo o grupo de campos, cada lista— y **8 px (`gap-2`)** entre elementos de un mismo bloque (filas de una lista, campo y su botón). Cabecera: solo título y **una** descripción, **dentro de la zona con scroll** y sin relleno propio (`p-0`: el `DrawerHeader` trae `p-4` y se sumaría al del contenedor; todo el drawer comparte los mismos 16 px laterales) (se va con el contenido, no queda fija arriba); fijos quedan solo el pie (pasos y botones) y, si hace falta, nada más. Un drawer de ajustes no usa pestañas: un solo panel en **secciones según lo que hace cada ajuste** (título `text-sm font-medium` + una línea `text-xs` + controles, separadas por `Separator`, 24 px entre bloques). Las elecciones entre pocas opciones usan `StepSlider` (`components/step-slider.tsx`: slider de pasos fijos, paso actual arriba, extremos abajo, explicación del paso, área de toque de 44 px); los sí/no, el interruptor (22-nov-2026). Orden: primero los campos de entrada y después las listas u opciones. Todo drawer nuevo sigue este espaciado.
- **Tipografía (UI v2)**: una sola familia sans (Geist) en toda la app; prohibido `font-serif`/`font-heading` con serifa. Escala: `text-xs`, `text-sm` (cuerpo), `text-base` y `text-lg font-medium` como máximo para títulos; nada sobre `text-xl`, **salvo el título de portada del buscador** (token `hero-title` en `docs/DESIGN-TOKENS.md`: `text-2xl` en móvil y `text-3xl` desde `sm`, peso 500; pedido por Juan el 20-nov-2026). Pesos 400 y 500. Botones `h-9` por defecto y radio completo (los de solo ícono, en cambio, son cuadrados con esquinas redondeadas, `rounded-lg`: así el fondo al pasar el cursor no es un círculo; pedido por Juan el 20-nov-2026); el área táctil de 44 px en móvil se conserva ampliando el área de toque, sin agrandar el texto. **Escala de botones de solo ícono** (pedida por Juan el 21-nov-2026): se elige el tamaño según dónde van —`icon-xs` 24 px (dentro de filas y listas), `icon-sm` 28 px (barras densas), `icon` 36 px (cabeceras), `icon-lg` 40 px— y el radio crece con el tamaño (`rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-lg`) para que **todos** sean semiredondos y ninguno parezca un círculo al pasar el cursor.

## Idioma
- Todo texto visible de la interfaz (etiquetas, errores, toasts, vacíos, aria-label) va en **español**. Código, nombres y commits pueden ir en inglés o español, pero consistentes.

## Costo cero
- Solo **Ollama local** para IA. Ninguna API de pago ni servicio de IA en la nube. Playwright y librerías open source son válidos.
- **Datos**: Supabase (plan gratuito, proyecto `Sooosh`) está permitido SOLO para guardar datos (memoria de preferencias y ofertas). Decisión de Juan del 19-nov-2026. Claves y contraseñas solo en `.env.local` (nunca en el repositorio ni en el chat); todas las tablas con RLS activo. Los CV y su caché (datos personales) se quedan locales hasta que existan cuentas de usuario.

## Datos del CV
- **Nunca inventar datos del CV**: ni empleos, fechas, cifras, títulos, herramientas ni logros. Todo lo que aparezca en el CV adaptado debe poder rastrearse al CV original del usuario. Si falta información, se deja vacía o se pregunta.

## Next.js
- Esta versión de Next tiene cambios incompatibles: lee la guía relevante en `node_modules/next/dist/docs/` antes de escribir código (ver AGENTS.md).

## Servidores
- No arranques otro servidor de desarrollo. El servidor de Juan corre en el puerto 3000 con `pnpm dev`. Si necesitas probar algo, usa ese. Si no responde, avísame en vez de iniciar otro. `pnpm shots` usa ese servidor y falla con aviso si no responde.

## Definición de "fase terminada"
Una fase solo termina cuando, en este orden, **todo** está en verde:
1. `pnpm lint`
2. `pnpm exec tsc --noEmit`
3. `pnpm build`
4. `pnpm test`


**La auditoría visual es de Juan, no mía** (regla del 17-nov-2026, sustituye a la del mismo día sobre capturas). No tomo capturas para revisarlas, no leo imágenes, no ejecuto `pnpm shots` ni `pnpm a11y` y no hago matrices de viewport o tema, salvo que Juan lo pida en un mensaje. Los scripts `shots` y `a11y` se conservan sin tocar, solo para uso bajo petición. Verificación permitida: lint, tsc, test, build y aserciones de DOM en texto (p. ej. fuente calculada del body). Las imágenes de `docs/referencias/` se leyeron una vez y se sintetizaron en `docs/DESIGN-PATTERNS.md`; se trabaja solo con ese documento. Ahorro de contexto: no leer archivos grandes completos (grep y rangos), no repetir suites completas más de una vez por entrega, diffs mínimos.

Cada fase deja en `docs/STATUS.md` qué se hizo, qué se verificó con resultados reales y una lista "Para revisar por Juan" con las pantallas y estados exactos a mirar (claro/oscuro, escritorio y 375 px). Si algo falla, se corrige; no se marca la fase como hecha. Luego: commit claro. **Todo dato de rendimiento que se cite sale de una medición propia registrada en `docs/BENCHMARKS.md`.**

## Flujo
- **Fase UI-2** (rediseño v2, 17-nov-2026) se inserta antes de la Fase G; se rediseña una pantalla por vez y se espera la aprobación de Juan antes de pasar a la siguiente.
- **Fase K** (análisis profundo, 18-nov-2026) tiene prioridad sobre G y H; se avanza K1→K8 un paso por vez (ver `docs/PLAN.md`, rúbrica en `docs/RUBRICA.md`). Ya no se busca reproducir el diseño del CV original: se reconstruye con plantilla propia y se muestra una vista previa antes de descargar (PDF, Word, TXT, Markdown).
- Plan: `docs/PLAN.md`. Estado: `docs/STATUS.md`. Comando: `/siguiente-fase`.
- Fases A–E se hicieron de corrido (16-nov-2026). Desde la tanda F–J (17-nov-2026): **una fase por vez**; al terminar, detenerse y esperar `/siguiente-fase`.
