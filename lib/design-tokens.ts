/**
 * Tokens de diseño de la app: nombres con significado que apuntan a clases estándar de Tailwind (sin valores arbitrarios).
 * Documentados en docs/DESIGN-TOKENS.md: si cambia un valor, se cambia aquí y en ese documento (una prueba vigila que estén al día).
 */
export const TOKENS = {
  /** Título de portada del buscador: 24 px en móvil, 30 px desde `sm`, peso 500, espaciado entre letras muy cerrado (−0,05 em). */
  "hero-title": "text-2xl font-medium tracking-tighter text-balance sm:text-3xl",
  /** Subtítulo de portada: 14 px, peso 400, espaciado cerrado (−0,025 em), color atenuado. */
  "hero-subtitle": "text-sm tracking-tight text-balance text-muted-foreground",
  /** Pila título + subtítulo: centrada, ancho máx. 42 rem y 6 px entre ambos. */
  "hero-stack": "flex max-w-2xl flex-col items-center gap-1.5",
} as const

/** Colores de efectos (solo para `components/magic/*`); el resto de la app usa únicamente los colores del tema. */
export const EFFECT_COLORS = {
  /** azul hielo: el color con el que arranca el haz del distintivo «Ofertas encontradas» */
  "beam-ice": "oklch(0.82 0.09 235)",
  /** lila pálido: el color con el que termina (la cabeza) del haz */
  "beam-lilac": "oklch(0.78 0.11 305)",
  /** rosa: el color con el que arranca el haz en el tema claro */
  "beam-rose": "oklch(0.76 0.15 8)",
  /** naranja: el color con el que termina (la cabeza) del haz en el tema claro */
  "beam-orange": "oklch(0.78 0.15 55)",
  /** azul frío: la cabeza del haz `FlowBeam` de «Mi CV» al soltar un archivo (pedido por Juan el 23-nov-2026) */
  "flow-blue": "oklch(0.7 0.07 245)",
  /** más tonos fríos del mismo haz (24-nov-2026): hielo, cielo y pizarra */
  "flow-ice": "oklch(0.88 0.035 225)",
  "flow-sky": "oklch(0.78 0.06 238)",
  "flow-slate": "oklch(0.62 0.03 255)",
  /** gris azulado: la cola del mismo haz */
  "flow-gray": "oklch(0.8 0.02 250)",
  /** rosa de la insignia «Curated by Sooosh»: de aquí salen el fondo (translúcido) y el texto/icono (mezclado con el color del texto del tema para que se lea en claro y oscuro) */
  "curated-pink": "oklch(0.72 0.17 5)",
  /** tamaño del texto y del icono de esa insignia (más pequeño que `text-xs`, que es el mínimo de la escala) */
  "curated-size": "0.625rem",
} as const

export type TokenName = keyof typeof TOKENS
/** Clases de un token. */
export const token = (name: TokenName): string => TOKENS[name]
