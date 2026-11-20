import { z, type ZodType } from "zod"

const STRIP = new Set(["$schema", "pattern", "format", "minLength", "maxLength", "minItems", "maxItems", "minimum", "maximum"])

function strip(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strip)
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(([k]) => !STRIP.has(k))
        .map(([k, v]) => [k, strip(v)]),
    )
  }
  return node
}

/**
 * JSON Schema para el parámetro `format` de Ollama, generado desde Zod.
 * Se quitan las restricciones de longitud/formato (la gramática del modelo las maneja mal);
 * la validación estricta la hace Zod sobre la respuesta.
 */
export function toModelSchema(schema: ZodType): Record<string, unknown> {
  return strip(z.toJSONSchema(schema, { io: "output" })) as Record<string, unknown>
}

/** Quita "" y null de objetos (los modelos rellenan con "" lo que no aparece) y conserva los arrays. */
export function cleanEmpty(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanEmpty).filter((v) => v !== undefined)
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      const c = cleanEmpty(v)
      if (c !== undefined) out[k] = c
    }
    return out
  }
  if (value === null) return undefined
  if (typeof value === "string" && value.trim() === "") return undefined
  return value
}
