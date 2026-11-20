import { z } from "zod"
import { describeChange } from "@/lib/rewrite/describe"
import { groupContext, groupItems, type RewriteItem } from "@/lib/rewrite/groups"
import { lengthViolation, verifyNoInvention, type Violation } from "@/lib/rewrite/verify"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"
import { getProvider } from "./index"

/** Reintentos tras el primer intento: si siguen inventando, se conserva el original. */
export const MAX_RETRIES = 2

export const rewriteOutputSchema = z.object({ items: z.array(z.string()) })

export const REWRITE_SYSTEM_PROMPT = `Eres un editor de currículums. Reformulas textos de un CV para destacar lo que pide una oferta SIN AÑADIR INFORMACIÓN.

REGLAS (no negociables):
- Usa SOLO los hechos del texto original. Está PROHIBIDO añadir cifras, porcentajes, fechas, empresas, cargos, herramientas, tecnologías, logros o responsabilidades que no estén en ese texto.
- Puedes: cambiar el orden de las ideas, empezar con un verbo de acción y usar el vocabulario de la oferta SOLO cuando describe exactamente lo mismo que ya dice el texto.
- Conserva tal cual todas las cifras y nombres propios. Conserva el idioma del texto original.
- No hagas el texto más largo de lo necesario (máximo 25 % más largo).
- Si no hay una mejora clara, devuelve el texto idéntico.
- Devuelve exactamente un elemento por cada texto recibido, en el mismo orden.
Responde únicamente con el JSON {"items": [...]}.`

function offerBrief(offer: Offer): string {
  const list = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (ninguno)")
  return `Oferta: ${offer.title}${offer.company ? ` en ${offer.company}` : ""}\nRequisitos:\n${list(offer.requirements)}\nSe valora:\n${list(offer.niceToHave)}`
}

type Pending = { id: string; label: string; text: string; section: string; feedback?: string[] }

/** Lo que el sistema ha aprendido de las decisiones de la persona (memoria de preferencias; NO es entrenamiento del modelo). */
export type Preferences = { rules: string[]; examples: { original: string; final: string }[] }
export type RewriteExtra = { preferences?: Preferences; /** frase de estilo del CV (diagnóstico) */ style?: string; /** idioma de salida si la oferta pide otro */ language?: "es" | "en" }

function preferencesBlock(p?: Preferences): string {
  if (!p || (p.rules.length === 0 && p.examples.length === 0)) return ""
  const rules = p.rules.length ? `Reglas:\n${p.rules.map((r) => `- ${r}`).join("\n")}` : ""
  const ex = p.examples.length ? `Ejemplos que esta persona aceptó o editó (solo como guía de estilo; no copies sus datos):\n${p.examples.map((e) => `Antes: ${e.original}\nDespués: ${e.final}`).join("\n")}` : ""
  return `PREFERENCIAS DE ESTA PERSONA (aprendidas de sus decisiones anteriores; respétalas siempre que no contradigan las reglas de no inventar):\n${[rules, ex].filter(Boolean).join("\n")}`
}

function buildUser(offer: Offer, context: string, pending: Pending[], extra?: RewriteExtra): string {
  const texts = pending.map((p, i) => `${i + 1}. ${p.text}`).join("\n")
  const rejected = pending
    .map((p, i) => (p.feedback?.length ? `Texto ${i + 1}: ${p.feedback.join(" ")}` : ""))
    .filter(Boolean)
    .join("\n")
  return [
    offerBrief(offer),
    extra?.style ? `Estilo del CV que debes conservar: ${extra.style}` : "",
    extra?.language ? `Escribe los textos en ${extra.language === "en" ? "inglés" : "español"}; conserva cifras y nombres propios.` : "",
    preferencesBlock(extra?.preferences),
    `Contexto (solo referencia, no lo copies): ${context}`,
    `Textos a reformular:\n${texts}`,
    rejected && `Tu respuesta anterior fue RECHAZADA:\n${rejected}\nCorrige solo eso: no añadas nada que no esté en el texto original y devuelve un elemento por cada texto.`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim()

/**
 * Reescribe un grupo (resumen o viñetas de un puesto/proyecto) y verifica cada texto.
 * Cada texto rechazado se reintenta hasta MAX_RETRIES veces; si sigue inventando, se conserva el original.
 */
export async function rewriteGroup(cv: CV, offer: Offer, group: string, signal?: AbortSignal, guard?: string, extra?: RewriteExtra): Promise<RewriteItem[]> {
  const source = groupItems(cv, group)
  const context = groupContext(cv, group)
  const done = new Map<string, RewriteItem>()
  let pending: Pending[] = source.map((s) => ({ ...s }))

  for (let attempt = 0; attempt <= MAX_RETRIES && pending.length; attempt++) {
    const { data } = await getProvider().generateStructured({
      system: REWRITE_SYSTEM_PROMPT,
      user: buildUser(offer, context, pending, extra),
      schema: rewriteOutputSchema,
      signal,
    })
    const failed: Pending[] = []
    pending.forEach((p, i) => {
      const proposed = data.items.length === pending.length ? (data.items[i] ?? "").trim() : ""
      const violations: Violation[] =
        data.items.length !== pending.length
          ? [{ kind: "format", value: "", message: "El modelo no devolvió un texto por cada elemento." }]
          : same(proposed, p.text)
            ? []
            : [...verifyNoInvention(guard ?? cv, proposed, { offer }).violations, ...[lengthViolation(p.text, proposed)].filter((v): v is Violation => !!v)]
      if (violations.length) {
        failed.push({ ...p, feedback: violations.map((v) => v.message) })
        if (attempt === MAX_RETRIES) {
          done.set(p.id, { id: p.id, label: p.label, original: p.text, proposed: p.text, status: "kept", kind: "cambiar", section: p.section, reasons: violations.map((v) => v.message) })
        }
      } else {
        if (same(proposed, p.text)) {
          done.set(p.id, { id: p.id, label: p.label, original: p.text, proposed: p.text, status: "unchanged", kind: "cambiar", section: p.section })
        } else {
          const d = describeChange(cv, offer, p.text, proposed)
          done.set(p.id, { id: p.id, label: p.label, original: p.text, proposed, status: "changed", kind: "cambiar", section: p.section, ...d })
        }
      }
    })
    pending = failed
  }
  return source.map((s) => done.get(s.id)!)
}

/**
 * Regenera UN texto con la retroalimentación de por qué el intento anterior no sirvió (K6). El resultado se verifica fuera
 * (anti-invención y longitud) antes de usarse; aquí solo se pide al modelo. Devuelve null si el modelo no entrega un texto.
 */
export async function regenerateOne(cv: CV, offer: Offer, item: { id: string; label: string; original: string; section?: string }, feedback: string[], signal?: AbortSignal, extra?: RewriteExtra): Promise<string | null> {
  const group = item.id === "summary" ? "summary" : item.id.split(".").slice(0, 2).join(".")
  const { data } = await getProvider().generateStructured({
    system: REWRITE_SYSTEM_PROMPT,
    user: buildUser(offer, groupContext(cv, group), [{ id: item.id, label: item.label, text: item.original, section: item.section ?? "", feedback }], extra),
    schema: rewriteOutputSchema,
    signal,
    options: { numPredict: 400 },
  })
  return data.items.length === 1 ? (data.items[0] ?? "").trim() || null : null
}
