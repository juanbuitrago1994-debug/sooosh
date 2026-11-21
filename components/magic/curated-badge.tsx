import { HandshakeIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { EFFECT_COLORS } from "@/lib/design-tokens"

const PINK = EFFECT_COLORS["curated-pink"]
const SIZE = EFFECT_COLORS["curated-size"]
/** Mismo relleno en los cuatro lados y esquinas semiredondas (≈ 45 % del radio de la app, unos 6 px: esquinas suaves, no una píldora). */
const PAD = "0.1875rem"
const RADIUS = "calc(var(--radius) * 0.45)"

/**
 * Insignia «Curated by Sooosh» (en inglés por decisión de Juan, 21-nov-2026): marca las ofertas que una persona de Sooosh revisó y cargó desde el panel.
 * Excepción documentada de `components/magic/*`: pequeña (texto e icono de 10 px), de esquinas semiredondas y con el mismo relleno en los cuatro lados, con un rosa
 * de poca opacidad en el fondo y rosa en el texto y en el icono (dos manos que se estrechan: «escogida a mano»), para que contraste poco con el fondo. El texto mezcla el rosa con el color del texto del tema,
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
      <HandshakeIcon aria-hidden style={{ width: SIZE, height: SIZE, flexShrink: 0 }} />
      Curated by Sooosh
    </Badge>
  )
}
