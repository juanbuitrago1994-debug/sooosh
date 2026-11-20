/** Una oferta «hace match» con una persona cuando su encaje estimado llega a este mínimo (decisión de Juan, 19-nov-2026). */
export const MATCH_MIN = 75
export const isMatch = (score: number | null | undefined): boolean => typeof score === "number" && score >= MATCH_MIN
