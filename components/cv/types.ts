import type { z } from "zod"
import type { cvSchema } from "@/lib/schemas/cv"

/** Valores del formulario (entrada de Zod: las listas con default pueden faltar). */
export type CVInput = z.input<typeof cvSchema>
