import { fold } from "@/lib/keywords/normalize"
import { languagesIn, seniorityIn, yearsIn } from "@/lib/ai/parse-offer-lines"
import { applyChannels } from "./apply"
import type { JobDraft } from "./draft"
import { COUNTRIES } from "./geo"
import { FIELD_KEYS, FIELD_LABELS, fieldValues, type FieldKey } from "./field-values"
import { detectSalary } from "./salary"
import { titleFromHook } from "@/lib/offer/identity"

/**
 * Evidencia de cada dato de la tarjeta, para revisarlo uno por uno:
 *  - texto: el dato está escrito en la oferta (con la frase de donde sale).
 *  - inferido: lo dedujimos (ciudad → país, frase de apertura → cargo…): conviene confirmarlo.
 *  - falta: la oferta no lo dice.
 * Es determinista: la frase sale del propio texto, nunca del modelo.
 */
export type EvidenceStatus = "texto" | "inferido" | "falta"
export type FieldEvidence = { key: FieldKey; label: string; value?: string; status: EvidenceStatus; quote?: string }

const MAX_QUOTE = 180
const COMPANY_FROM = { pagina: "Es el perfil que publica la oferta en LinkedIn", encabezado: "Viene en el encabezado de la publicación que pegaste", tu: "La escribiste tú" } as const

/** Frase (o línea) del texto donde `test` se cumple; si es muy larga, solo la oración que lo contiene. */
export function findQuote(text: string, test: (line: string) => boolean): string | undefined {
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.length > MAX_QUOTE ? line.split(/(?<=[.!?])\s+/) : [line]
    const hit = parts.find((p) => test(p))
    if (hit) return hit.length > MAX_QUOTE ? `${hit.slice(0, MAX_QUOTE - 1)}…` : hit
  }
  return undefined
}

const has = (needle: string) => {
  const n = fold(needle)
  return (line: string) => n.length > 1 && fold(line).includes(n)
}

const MODE_RE: Record<string, RegExp> = {
  remoto: /\b(remot[oa]|remote|teletrabajo|home office|desde casa)\b/,
  hibrido: /\b(hibrid[oa]|hybrid)\b/,
  presencial: /\b(presencial|on-?site|en oficina)\b/,
}
const TYPE_RE = /\b(tiempo completo|full[- ]?time|medio tiempo|part[- ]?time|contrato|temporal|practicas|pasantia|freelance|por proyecto|indefinido|termino fijo)\b/

export function buildEvidence(d: JobDraft, text: string, opts: { companyFrom?: "pagina" | "tu" | "encabezado" } = {}): FieldEvidence[] {
  const values = fieldValues(d)
  const ev = (key: FieldKey, status: EvidenceStatus, quote?: string): FieldEvidence => ({ key, label: FIELD_LABELS[key], value: values[key], status: values[key] ? status : "falta", quote: values[key] ? quote : undefined })
  const quote: Partial<Record<FieldKey, string | undefined>> = {
    empresa: d.company ? findQuote(text, has(d.company)) : undefined,
    ubicacion: d.locationText ? findQuote(text, has(d.locationText.split(",")[0])) : undefined,
    modalidad: d.workMode ? findQuote(text, (l) => MODE_RE[d.workMode!].test(fold(l))) : undefined,
    contrato: d.employmentType ? findQuote(text, (l) => TYPE_RE.test(fold(l))) : undefined,
    nivel: d.seniority ? findQuote(text, (l) => seniorityIn(l) === d.seniority) : undefined,
    experiencia: d.offer.yearsExperience ? findQuote(text, (l) => !!yearsIn(l)) : undefined,
    salario: d.salary ? findQuote(text, (l) => !!detectSalary(l)) : undefined,
    idiomas: d.offer.languagesRequired?.length ? findQuote(text, (l) => !!languagesIn([l])?.length) : undefined,
  }
  const country = COUNTRIES.find((c) => c.code === d.country)
  const countryQuote = country ? findQuote(text, (l) => has(country.name)(l) || (!!d.locationText && has(d.locationText.split(",")[0])(l))) : undefined
  const emails = applyChannels(d.apply).flatMap((c) => (c.email ? [c.email] : c.url ? [c.url] : []))
  const applyQuote = emails.length ? findQuote(text, (l) => emails.some((e) => l.includes(e.replace(/^mailto:/, "")))) : undefined
  const titleQuote = d.titleSource === "inferido" ? findQuote(text, (l) => !!titleFromHook(l)) : d.title ? findQuote(text, has(d.title)) : undefined
  const listed = (n: number) => (n ? ("texto" as const) : ("falta" as const))

  return FIELD_KEYS.map((key): FieldEvidence => {
    switch (key) {
      case "empresa":
        // la empresa que entrega la página (perfil que publica) no está en el texto, pero es un dato de la fuente
        if (opts.companyFrom && d.company) return ev(key, "texto", COMPANY_FROM[opts.companyFrom])
        return ev(key, quote.empresa ? "texto" : "inferido", quote.empresa)
      case "titulo":
        return ev(key, d.titleSource === "inferido" ? "inferido" : "texto", titleQuote)
      case "pais":
        // el país casi siempre se deduce de una ciudad o de la zona: queda «inferido» salvo que el texto nombre el país
        return ev(key, countryQuote && has(country!.name)(countryQuote) ? "texto" : "inferido", countryQuote)
      case "requisitos":
        return ev(key, listed(d.offer.requirements.length))
      case "responsabilidades":
        return ev(key, listed(d.offer.responsibilities.length))
      case "deseables":
        return ev(key, listed(d.offer.niceToHave.length))
      case "postulacion":
        return ev(key, applyQuote ? "texto" : "inferido", applyQuote)
      case "region":
        // sin región en el texto, la tarjeta queda abierta a todas: se dice
        return ev(key, "inferido")
      default:
        return ev(key, quote[key] ? "texto" : "inferido", quote[key])
    }
  })
}
