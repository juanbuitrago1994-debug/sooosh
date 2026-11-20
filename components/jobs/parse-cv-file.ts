import { uploadAndParseCv } from "@/lib/profile/parse-client"

/** Igual que `uploadAndParseCv`, con los errores de red de siempre en español. */
export async function parseCvFileSafe(file: File, onStage: (label: string) => void) {
  try {
    return await uploadAndParseCv(file, onStage)
  } catch (e) {
    const m = (e as Error).message
    throw new Error(/fetch|network|failed/i.test(m) ? "No se pudo conectar con el servidor. ¿Está la app corriendo?" : m)
  }
}
