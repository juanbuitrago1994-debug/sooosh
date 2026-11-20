import type { ZodType } from "zod"

export type StructuredRequest<T> = {
  system: string
  user: string
  schema: ZodType<T>
  signal?: AbortSignal
  /** Ajustes por llamada: contextos y respuestas cortas hacen las llamadas pequeñas mucho más rápidas. */
  options?: { numCtx?: number; numPredict?: number }
}

export type StructuredResult<T> = {
  data: T
  meta: { provider: string; model: string; ms: number; attempts: number; firstTokenMs?: number }
}

/** Contrato que cumple cualquier proveedor (Ollama hoy; otro modelo o API mañana). */
export interface AIProvider {
  readonly name: string
  generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>
}

export type AIErrorCode = "not_configured" | "unreachable" | "model_missing" | "timeout" | "invalid_output"

export class AIError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "AIError"
  }
}
