import { BadgeCheckIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { EFFECT_COLORS } from "@/lib/design-tokens"

const PINK = EFFECT_COLORS["curated-pink"]
const SIZE = EFFECT_COLORS["curated-size"]

/**
 * Insignia «Curated by Sooosh» (en inglés por decisión de Juan, 21-nov-2026): marca las ofertas que una persona de Sooosh revisó y cargó desde el panel.
 * Excepción documentada de `components/magic/*`: pequeña (texto e icono de 10 px), de esquinas semiredondas, con un rosa de poca opacidad en el fondo y rosa en el
 * texto y el icono, para que contraste poco con el fondo. El texto mezcla el rosa con el color del texto del tema, así se lee en claro (rosa profundo) y en oscuro
 * (rosa claro). Tokens `curated-pink` y `curated-size` en `docs/DESIGN-TOKENS.md`; la forma y la tipografía base son las del `Badge` de shadcn.
 */
export function CuratedBadge({ className }: { className?: string }) {
  return (
    <Badge
      className={`h-3.5 gap-0.5 rounded-md px-1 font-medium ${className ?? ""}`}
      style={{
        fontSize: SIZE,
        backgroundColor: `color-mix(in oklab, ${PINK} 14%, transparent)`,
        color: `color-mix(in oklab, ${PINK} 75%, var(--foreground))`,
      }}
    >
      <BadgeCheckIcon data-icon="inline-start" aria-hidden style={{ width: SIZE, height: SIZE }} />
      Curated by Sooosh
    </Badge>
  )
}
