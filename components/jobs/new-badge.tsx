import { FlameIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

/**
 * Insignia de oferta nueva (entró a Sooosh hace menos de 48 h; el servidor decide con `isNew`). La llama aparece con un pequeño
 * acercamiento de 300 ms, solo si la persona no pidió reducir el movimiento.
 */
export function NewBadge() {
  return (
    <Badge variant="outline" className="shrink-0 text-primary">
      <FlameIcon data-icon="inline-start" className="motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300" aria-hidden />
      Nueva
    </Badge>
  )
}
