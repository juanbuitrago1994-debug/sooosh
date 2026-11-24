import { setProfileExtras } from "@/lib/profile/search-profile"
import type { CV } from "@/lib/schemas/cv"
import { readExtrasClient } from "./client"

/**
 * Lectura profunda en segundo plano (A8): al subir el CV se lanza sin esperar y se guarda en el perfil; cuando la persona pulsa «Generar versión
 * ATS» ya está lista (o se espera a la que está en curso). Es la parte lenta de la versión ATS; así se paga mientras mira otra cosa. No bloquea nada y
 * si falla no pasa nada: la versión ATS se genera igual. Todo local (Ollama); el texto del CV no sale del equipo.
 */
export function prefetchExtras(cv: CV, sourceText: string | undefined, fileId?: string): void {
  if (!sourceText || sourceText.length < 200) return
  void readExtrasClient(cv, sourceText).then((extras) => {
    if (extras) setProfileExtras(extras, fileId)
  })
}
