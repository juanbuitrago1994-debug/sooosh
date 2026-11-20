# Tokens de diseño

Los tokens son **nombres con significado** que apuntan a clases estándar de Tailwind (nunca valores arbitrarios como `text-[13px]`). Viven en `lib/design-tokens.ts` y se usan con `token("nombre")`. Los colores, radios y fuentes siguen en `app/globals.css` (los de shadcn: `--primary`, `--background`, …). Una prueba (`tests/design-tokens.test.ts`) comprueba que cada token de código esté documentado aquí con las mismas clases.

## Tipografía de portada del buscador (20-nov-2026, pedido por Juan)

Ajuste: título y subtítulo más pequeños, más juntos y con menos espaciado entre letras.

| Token | Clases de Tailwind | Valores |
|---|---|---|
| `hero-title` | `text-2xl font-medium tracking-tighter text-balance sm:text-3xl` | 24 px (móvil) / 30 px (≥ `sm`), peso 500, interletraje −0,05 em (antes: 30/36 px y −0,025 em) |
| `hero-subtitle` | `text-sm tracking-tight text-balance text-muted-foreground` | 14 px, peso 400, interletraje −0,025 em (antes: 16 px y 0 em), color atenuado |
| `hero-stack` | `flex max-w-2xl flex-col items-center gap-1.5` | ancho máx. 42 rem, **6 px** entre título y subtítulo (antes: 12 px) |

Uso: `components/jobs/job-search.tsx` (portada). El título de portada es la única excepción a la escala tipográfica general (`CLAUDE.md`).

## Cómo añadir o cambiar un token
1. Cambia el valor en `lib/design-tokens.ts`.
2. Actualiza la fila de esta tabla (misma cadena de clases).
3. Corre `pnpm test`: la prueba falla si el código y este documento no coinciden.

## Regla de las hojas con carga (20-nov-2026, pedido por Juan)
En cualquier hoja (Dialog en escritorio o Drawer en móvil) que tarde en mostrar su contenido, **mientras carga solo aparece el cargador con sus frases (`LoadingState`), centrado en vertical y en horizontal respecto a la hoja; todo lo demás se oculta** (título, descripciones, botones). El título se conserva solo para lectores de pantalla (`sr-only`). Aplica hoy a **Fuentes** (mientras llega el estado) y a **Mi CV** (mientras se lee el archivo); toda hoja nueva con carga debe seguirla.

## Colores de efectos (20-nov-2026, pedidos por Juan)
Solo para `components/magic/*` (excepción documentada en `CLAUDE.md`); el resto de la app usa únicamente los colores del tema. Definidos en `lib/design-tokens.ts` (`EFFECT_COLORS`). Los colores se funden de dos en dos a lo largo del haz del distintivo «Ofertas encontradas»: en el tema **oscuro**, fríos (azul hielo en la cola, lila pálido en la cabeza); en el tema **claro**, cálidos (rosa en la cola, naranja en la cabeza).

| Token | Valor | Uso |
|---|---|---|
| `beam-ice` | `oklch(0.82 0.09 235)` | azul hielo: cola del haz |
| `beam-lilac` | `oklch(0.78 0.11 305)` | lila pálido: cabeza del haz |
| `beam-rose` | `oklch(0.76 0.15 8)` | rosa: cola del haz en el tema claro |
| `beam-orange` | `oklch(0.78 0.15 55)` | naranja: cabeza del haz en el tema claro |
