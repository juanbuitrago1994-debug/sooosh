import type { Db } from "@/lib/db"
import type { Preferences } from "@/lib/ai/rewrite-cv"
import { examplesFor, listRules } from "./store"

/** Reglas activas + pocos ejemplos aceptados/editados, listos para inyectar en el prompt de reescritura. */
export async function loadPreferences(db: Db, section = "Experiencia"): Promise<Preferences> {
  // En paralelo: la base está en la nube y cada consulta cuesta un viaje de red.
  const [allRules, allExamples] = await Promise.all([listRules(db), examplesFor(db, "cambiar", section, 3)])
  const rules = allRules.filter((r) => r.enabled).map((r) => r.text)
  const examples = allExamples.map((e) => ({ original: e.original.slice(0, 220), final: e.final.slice(0, 220) }))
  return { rules, examples }
}
