import { z } from "zod"
import { getProvider } from "@/lib/ai"
import { embed, resolveEmbedModel } from "@/lib/ai/embeddings"
import { detectLanguage } from "@/lib/cv/diagnosis"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"
import { runMatch, type JudgeFn, type Relation } from "./engine"
import type { MatchResult } from "./types"

/** Conecta el motor con Ollama: embeddings locales + juez de salida mínima + traducción de términos (solo modelos no multilingües). */
const relationSchema = z.object({ relation: z.enum(["mismo", "relacionado", "ninguno"]) })
const translationSchema = z.object({ items: z.array(z.string()) })

export const JUDGE_PROMPT = `Comparas un REQUISITO de una oferta de trabajo con fragmentos de un CV (pueden estar en otro idioma). Responde con {"relation": ...}:
- "mismo": el fragmento demuestra esa capacidad o conocimiento, aunque use otras palabras u otro idioma.
- "relacionado": el fragmento muestra experiencia cercana en la misma área, que se podría redactar honestamente con las palabras del requisito SIN añadir nada que el candidato no haya hecho.
- "ninguno": no lo demuestra. Una herramienta, tecnología, idioma o certificación DISTINTA no cuenta.

Ejemplos:
Requisito: Train business users | Fragmento: Capacité a 10 usuarios del área comercial en el uso de tableros. -> mismo
Requisito: Data visualization | Fragmento: Diseñé 12 tableros en Power BI usados por la gerencia comercial. -> mismo
Requisito: Prepare weekly reports for management | Fragmento: Elaboré informes mensuales de ventas para 5 sucursales. -> relacionado
Requisito: Project management | Fragmento: Coordiné a un equipo de 3 analistas en la migración de informes. -> relacionado
Requisito: Kubernetes | Fragmento: Docker, Git, Linux -> ninguno
Requisito: PMP certification | Fragmento: Gestión de proyectos ágiles -> ninguno
Requisito: Machine learning | Fragmento: Elaboré reportes de ventas en Excel. -> ninguno`

export function makeJudge(signal?: AbortSignal): JudgeFn {
  return async (term, evidence): Promise<Relation | null> => {
    try {
      const { data } = await getProvider().generateStructured({
        system: JUDGE_PROMPT,
        user: `Requisito: ${term.text}\n\nFragmentos del CV:\n${evidence.map((e, i) => `${i + 1}. ${e.text}`).join("\n")}`,
        schema: relationSchema,
        signal,
        options: { numPredict: 20 },
      })
      return data.relation
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e
      return null
    }
  }
}

async function translate(texts: string[], to: "es" | "en", signal?: AbortSignal): Promise<string[]> {
  try {
    const { data } = await getProvider().generateStructured({
      system: `Traduce cada elemento de la lista al ${to === "es" ? "español" : "inglés"}, uno por uno y en el mismo orden. Devuelve {"items": [...]} con la misma cantidad de elementos. Conserva nombres de tecnologías.`,
      user: JSON.stringify(texts),
      schema: translationSchema,
      signal,
      options: { numPredict: Math.min(900, 30 + texts.length * 24) },
    })
    return data.items.length === texts.length ? data.items : texts
  } catch {
    return texts
  }
}

export async function matchWithOllama(cv: CV, offer: Offer, opts: { signal?: AbortSignal; cvLanguage?: "es" | "en" | "otro" } = {}): Promise<MatchResult> {
  const model = await resolveEmbedModel()
  if (!model) return runMatch(cv, offer, { embed: null })
  const cvLang = opts.cvLanguage ?? detectLanguage(JSON.stringify(cv)).lang
  // bge-m3 es multilingüe: compara entre idiomas tal cual. Un modelo solo-inglés necesita los términos en el idioma del CV.
  const needsTranslation = !model.multilingual && cvLang !== "otro" && offer.language !== "otro" && offer.language !== cvLang
  return runMatch(cv, offer, {
    embed: (texts) => embed(texts, model.model, opts.signal),
    judge: makeJudge(opts.signal),
    translate: needsTranslation ? (texts) => translate(texts, cvLang as "es" | "en", opts.signal) : null,
    embedModel: model.model,
  })
}
