import { getProvider, type AIProvider } from "@/lib/ai"

/**
 * Modelo de la versión ATS (A8). Medido con un CV real de 11 500 caracteres en un Mac M4 de 16 GB (docs/BENCHMARKS.md, «Lectura profunda por
 * modelo»): `gemma4:e4b` hace la lectura completa en ≈ 45–55 s con la misma calidad que `qwen2.5:7b-instruct` (≈ 135 s), y los modelos de 14 B
 * (`qwen2.5:14b-instruct`, `qwen3:14b`, `phi4`) no terminan dentro de los 5 min de espera por llamada. Se elige con `OLLAMA_ATS_MODEL`; si no
 * está definido se usa el modelo general (`OLLAMA_MODEL`). `keepAlive` corto: dos modelos de ~9 GB cargados a la vez en 16 GB hacen que el equipo
 * use el disco y todo se vuelva lento (se vio en la medición), así que el de la versión ATS se descarga a los 2 minutos de usarse.
 */
export const ATS_KEEP_ALIVE = "2m"
export const atsModel = (): string | undefined => process.env.OLLAMA_ATS_MODEL?.trim() || undefined

export function atsProvider(temperature = 0): AIProvider {
  return getProvider({ model: atsModel(), temperature, keepAlive: ATS_KEEP_ALIVE } as Parameters<typeof getProvider>[0])
}
