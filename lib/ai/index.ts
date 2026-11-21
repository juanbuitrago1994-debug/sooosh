import { createOllamaProvider, type OllamaConfig } from "./ollama"
import type { AIProvider } from "./types"

export * from "./types"

/** Único punto donde se elige el proveedor. Cambiar de modelo = cambiar .env.local; de proveedor = cambiar esta línea. */
export function getProvider(config?: Partial<OllamaConfig>): AIProvider {
  return createOllamaProvider(config)
}
