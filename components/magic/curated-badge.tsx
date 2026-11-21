import { Badge } from "@/components/ui/badge"
import { EFFECT_COLORS } from "@/lib/design-tokens"

const PINK = EFFECT_COLORS["curated-pink"]
const SIZE = EFFECT_COLORS["curated-size"]
/** Mismo relleno en los cuatro lados y esquinas semiredondas (≈ 30 % del radio de la app: un rectángulo de esquinas suaves, no una píldora). */
const PAD = "0.1875rem"
const RADIUS = "calc(var(--radius) * 0.3)"

/** Círculo con la marca de verificación recortada (relleno sólido). Trazado de Heroicons «check-circle» (sólido, licencia MIT). */
function SolidCheck() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" style={{ width: SIZE, height: SIZE, flexShrink: 0 }}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
      />
    </svg>
  )
}

/**
 * Insignia «Curated by Sooosh» (en inglés por decisión de Juan, 21-nov-2026): marca las ofertas que una persona de Sooosh revisó y cargó desde el panel.
 * Excepción documentada de `components/magic/*`: pequeña (texto e icono de 10 px), de esquinas semiredondas y con el mismo relleno en los cuatro lados, con un rosa
 * de poca opacidad en el fondo y rosa en el texto y el icono (sólido), para que contraste poco con el fondo. El texto mezcla el rosa con el color del texto del tema,
 * así se lee en claro (rosa profundo) y en oscuro (rosa claro). Tokens `curated-pink` y `curated-size` en `docs/DESIGN-TOKENS.md`; base: `Badge` de shadcn.
 */
export function CuratedBadge({ className }: { className?: string }) {
  return (
    <Badge
      className={`h-auto font-medium leading-none ${className ?? ""}`}
      style={{
        fontSize: SIZE,
        padding: PAD,
        gap: PAD,
        borderRadius: RADIUS,
        backgroundColor: `color-mix(in oklab, ${PINK} 14%, transparent)`,
        color: `color-mix(in oklab, ${PINK} 75%, var(--foreground))`,
      }}
    >
      <SolidCheck />
      Curated by Sooosh
    </Badge>
  )
}
