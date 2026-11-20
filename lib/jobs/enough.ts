import type { Offer } from "@/lib/schemas/offer"

/** Una oferta con menos de 2 requisitos o tareas no permite estimar un encaje con sentido (saldría un porcentaje de relleno). */
export const hasEnoughForFit = (o: Offer): boolean => o.requirements.length + o.niceToHave.length + o.responsibilities.length + (o.tools?.length ?? 0) >= 2
