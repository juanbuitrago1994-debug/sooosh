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
  /** rosa llamativo: fondo de la insignia «Seleccionada por Sooosh» (sólido, igual en claro y oscuro) */
  "curated-bg": "oklch(0.80 0.15 5)",
  /** texto de la insignia «Seleccionada por Sooosh»: rosa muy oscuro, con buen contraste sobre el fondo rosa */
  "curated-fg": "oklch(0.26 0.07 5)",
} as const

export type TokenName = keyof typeof TOKENS
/** Clases de un token. */
export const token = (name: TokenName): string => TOKENS[name]
