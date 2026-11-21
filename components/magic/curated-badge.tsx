import { BadgeCheckIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { EFFECT_COLORS } from "@/lib/design-tokens"

/**
 * Insignia rosa «Seleccionada por Sooosh»: marca las ofertas que una persona de Sooosh revisó y cargó desde el panel. Es la excepción documentada de
 * `components/magic/*` (color pedido por Juan el 21-nov-2026): usa los tokens `curated-bg` y `curated-fg` (`docs/DESIGN-TOKENS.md`), un rosa sólido que se ve igual
 * en claro y oscuro. La forma y la tipografía son las del `Badge` de shadcn.
 */
export function CuratedBadge({ className }: { className?: string }) {
  return (
    <Badge className={className} style={{ backgroundColor: EFFECT_COLORS["curated-bg"], color: EFFECT_COLORS["curated-fg"] }}>
      <BadgeCheckIcon data-icon="inline-start" aria-hidden />
      Seleccionada por Sooosh
    </Badge>
  )
}
