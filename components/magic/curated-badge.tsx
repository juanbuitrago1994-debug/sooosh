import { BadgeCheckIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { EFFECT_COLORS } from "@/lib/design-tokens"

/**
 * Insignia rosa «Curated by Sooosh» (en inglés por decisión de Juan, 21-nov-2026: es el nombre de la marca de curaduría, como «Match» o «Nueva» es de la app): marca las ofertas que una persona de Sooosh revisó y cargó desde el panel. Es la excepción documentada de
 * `components/magic/*` (color pedido por Juan el 21-nov-2026): usa los tokens `curated-bg` y `curated-fg` (`docs/DESIGN-TOKENS.md`), un rosa sólido que se ve igual
 * en claro y oscuro. La forma y la tipografía son las del `Badge` de shadcn.
 */
export function CuratedBadge({ className }: { className?: string }) {
  return (
    <Badge className={`h-4 gap-0.5 px-1.5 ${className ?? ""}`} style={{ backgroundColor: EFFECT_COLORS["curated-bg"], color: EFFECT_COLORS["curated-fg"] }}>
      <BadgeCheckIcon data-icon="inline-start" aria-hidden />
      Curated by Sooosh
    </Badge>
  )
}
