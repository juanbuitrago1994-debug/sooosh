import { offerSchema, type Offer } from "@/lib/schemas/offer"

/**
 * Del buscador al flujo de adaptación: «Adaptar mi CV a esta oferta» deja la oferta en sessionStorage y la pantalla de inicio la recoge.
 * Solo vive mientras la pestaña esté abierta.
 */
export const PREFILL_KEY = "sooosh:oferta-del-buscador"

const section = (title: string, items: string[]) => (items.length ? `${title}:\n${items.map((i) => `- ${i}`).join("\n")}` : "")

/** Texto de la oferta reconstruido SOLO con lo ya extraído (nada nuevo): es lo que lee el análisis de coincidencia. */
export function offerToText(offer: Offer, extra: { location?: string | null; remoteScope?: string | null } = {}): string {
  return [
    offer.company ? `${offer.title} — ${offer.company}` : offer.title,
    extra.location ? `Ubicación: ${extra.location}` : "",
    extra.remoteScope ?? "",
    section("Responsabilidades", offer.responsibilities),
    section("Requisitos", offer.requirements),
    section("Se valora", offer.niceToHave),
    offer.tools?.length ? `Herramientas: ${offer.tools.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function savePrefill(offer: Offer, extra: Parameters<typeof offerToText>[1] = {}): boolean {
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify({ offer, text: offerToText(offer, extra) }))
    return true
  } catch {
    return false
  }
}

export function readPrefill(): { offer: Offer; text: string } | null {
  try {
    const raw = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(PREFILL_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { offer?: unknown; text?: unknown }
    const offer = offerSchema.safeParse(data.offer)
    return offer.success && typeof data.text === "string" ? { offer: offer.data, text: data.text } : null
  } catch {
    return null
  }
}

export function clearPrefill() {
  try {
    sessionStorage.removeItem(PREFILL_KEY)
  } catch {
    /* sin almacenamiento */
  }
}
