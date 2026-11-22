"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { DEFAULT_CONTACT, buildBody, linkedinLink, platformLabel, webLinks, type AskValues, type ContactData, type EmailJob } from "@/lib/apply/email"
import type { AskKey } from "@/lib/jobs/asks"
import { CTAS, DEFAULT_SETTINGS, FOCUSES, GREETINGS, LANGS, LENGTHS, REGISTERS, STYLES, WARMTHS, cvFacts, resolveLang, type BodySettings, type Lang } from "@/lib/apply/body-settings"
import type { CV } from "@/lib/schemas/cv"

/** Ajustes de redacción: una comodidad de cada persona, se recuerdan en este navegador. */
const SETTINGS_KEY = "sooosh:correo-ajustes:v1"
/** Qué datos salen en la firma: también una comodidad de cada persona (se recuerda en este navegador). */
const CONTACT_KEY = "sooosh:correo-datos:v1"

function readContact(): ContactData | null {
  try {
    const d = JSON.parse(localStorage.getItem(CONTACT_KEY) ?? "null") as Partial<ContactData> | null
    if (d && typeof d === "object") return { ...DEFAULT_CONTACT, ...Object.fromEntries(Object.entries(d).filter(([k, v]) => k in DEFAULT_CONTACT && typeof v === "boolean")) }
  } catch {
    /* sin almacenamiento o datos viejos */
  }
  return null
}

const OPTIONS: { [K in keyof BodySettings]: readonly string[] } = { length: LENGTHS, register: REGISTERS, warmth: WARMTHS, style: STYLES, lang: LANGS, focus: FOCUSES, greeting: GREETINGS, cta: CTAS }

/** Lo guardado se mezcla con los valores por defecto: una clave que ya no existe o con un valor viejo se ignora. */
function readSettings(): BodySettings {
  try {
    const d = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Record<string, unknown> | null
    if (d && typeof d === "object") {
      const out = { ...DEFAULT_SETTINGS } as Record<string, string>
      for (const k of Object.keys(OPTIONS) as (keyof BodySettings)[]) if (typeof d[k] === "string" && OPTIONS[k].includes(d[k] as string)) out[k] = d[k] as string
      return out as unknown as BodySettings
    }
  } catch {
    /* sin almacenamiento o datos viejos */
  }
  return DEFAULT_SETTINGS
}

/** `https://` si falta; solo http(s) y con un dominio con punto. Devuelve `null` si no es una dirección web válida. */
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t || /[\s@]/.test(t)) return null
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".") ? u.toString().replace(/\/$/, "") : null
  } catch {
    return null
  }
}

/** Una propuesta del cuerpo: `middle` es el párrafo central (la plantilla base si es `null`); `override` es lo que la persona editó a mano. */
export type Proposal = { id: number; middle: string | null; source: "base" | "ia" | "plantilla"; override?: string; /** idioma en que se redactó (la IA y la plantilla no cambian de idioma después) */ lang?: Lang }

type Params = { cv: CV | null; job: EmailJob; requirements: string[]; covered: string[]; /** lo que la oferta pide en el correo */ asks: AskKey[]; /** idioma de la oferta (`es`, `en`…): con el idioma «automático» el correo sale en el mismo */ offerLanguage?: string | null }

/**
 * Estado del paso «Cuerpo»: propuestas (la plantilla base y las que pide la persona a la IA local), cuál se ve, ajustes de redacción y el
 * portafolio o web. Vive aquí (y no en el paso) para que no se pierda al ir de un paso a otro.
 */
export function useEmailBody({ cv, job, requirements, covered, asks, offerLanguage }: Params) {
  const [proposals, setProposals] = useState<Proposal[]>([{ id: 0, middle: null, source: "base" }])
  const [index, setIndex] = useState(0)
  // El panel solo se monta cuando la persona lo abre (en el navegador), así que se puede leer lo guardado al crear el estado.
  const [settings, setSettingsState] = useState<BodySettings>(readSettings)
  // Lo que la oferta pide manda sobre lo guardado: si pide LinkedIn o portafolio, salen.
  const [contact, setContactState] = useState<ContactData>(() => {
    const saved = readContact() ?? DEFAULT_CONTACT
    return { ...saved, linkedin: saved.linkedin || asks.includes("linkedin"), web: saved.web || asks.includes("portafolio") }
  })
  const [askValues, setAskValues] = useState<AskValues>({})
  /** nombre de quien recibe el correo, si la persona lo sabe (solo para este correo) */
  const [recipientName, setRecipientName] = useState("")
  const [extraUrl, setExtraUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const nextId = useRef(1)
  const abort = useRef<AbortController | null>(null)
  const requested = useRef(false)

  useEffect(() => () => abort.current?.abort(), [])

  const setSettings = (next: BodySettings) => {
    setSettingsState(next)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    } catch {
      /* no se pudo recordar */
    }
  }

  const setContact = (next: ContactData) => {
    setContactState(next)
    try {
      localStorage.setItem(CONTACT_KEY, JSON.stringify(next))
    } catch {
      /* no se pudo recordar */
    }
  }
  const setAskValue = (key: keyof AskValues, value: string) => setAskValues((v) => ({ ...v, [key]: value }))

  const cvLinks = cv ? webLinks(cv) : []
  const links = cvLinks.length ? cvLinks : extraUrl ? [{ label: "Portafolio", url: extraUrl }] : []
  const hasWebFromCv = cvLinks.length > 0

  const lang = resolveLang(settings.lang, offerLanguage)
  const textOf = (p: Proposal) =>
    cv ? (p.override ?? buildBody({ cv, job, covered, contact, asks: askValues, middle: p.middle ?? undefined, links, style: { lang: p.lang ?? lang, greeting: settings.greeting, cta: settings.cta, recipientName } })) : ""
  const current = proposals[Math.min(index, proposals.length - 1)]
  const body = textOf(current)

  const edit = (text: string) => setProposals((all) => all.map((p) => (p.id === current.id ? { ...p, override: text } : p)))
  /** Quita lo que la persona editó a mano en esta propuesta: vuelve a armarse con los datos y ajustes de ahora. */
  const resetEdit = () => setProposals((all) => all.map((p) => (p.id === current.id ? { ...p, override: undefined } : p)))
  const go = (delta: number) => setIndex((i) => Math.max(0, Math.min(proposals.length - 1, i + delta)))

  const addUrl = (raw: string): boolean => {
    const url = normalizeUrl(raw)
    if (!url) return false
    setExtraUrl(url)
    setContact({ ...contact, web: true })
    return true
  }
  const removeUrl = () => {
    setExtraUrl(null)
    setContact({ ...contact, web: false })
  }

  /** Qué datos tiene el CV (solo esos se ofrecen en la firma). */
  const available = {
    phone: !!cv?.header.phone?.trim(),
    email: !!cv?.header.email?.trim(),
    city: !!cv?.header.location?.trim(),
    linkedin: !!(cv && linkedinLink(cv)),
    web: links.length > 0,
    source: !!platformLabel(job.sourceName),
  }
  /** Valor que saldría de cada dato de contacto (para mostrarlo junto a su interruptor). */
  const cvValues: Partial<Record<keyof ContactData, string>> = {
    phone: cv?.header.phone?.trim(),
    email: cv?.header.email?.trim(),
    city: cv?.header.location?.trim(),
    linkedin: cv ? linkedinLink(cv)?.url.replace(/^https?:\/\//, "") : undefined,
  }
  /** Lo que la oferta pide en el correo y todavía no está en él. */
  const missingAsks: AskKey[] = asks.filter((k) => {
    if (k === "salario" || k === "disponibilidad" || k === "referencias") return !askValues[k]?.trim()
    if (k === "linkedin") return !contact.linkedin || !(available.linkedin || askValues.linkedin?.trim())
    return !contact.web || !available.web
  })

  /**
   * Pide 3 propuestas nuevas a la IA local (con plantilla de respaldo), una petición por ángulo: el modelo local las atiende de a una, así
   * cada propuesta aparece apenas está lista (y se muestra la primera que llega). Se suman a las que ya hay.
   */
  const generate = async () => {
    if (!cv) return
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    requested.current = true
    setLoading(true)
    const startIndex = proposals.length
    const known = new Set(proposals.flatMap((p) => (p.middle ? [p.middle] : [])))
    const base = {
      title: job.title,
      company: job.company ?? undefined,
      requirements: requirements.slice(0, 6),
      covered: covered.slice(0, 12),
      facts: cvFacts(cv),
      settings,
      lang,
    }
    let arrived = 0
    await Promise.all(
      [0, 1, 2].map(async (angle) => {
        try {
          const res = await fetch("/api/email/body", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal, body: JSON.stringify({ ...base, angle, avoid: [...known].slice(-12) }) })
          if (!res.ok) return
          const { proposals: fresh } = (await res.json()) as { proposals?: { middle: string; source: "ia" | "plantilla" }[] }
          for (const p of fresh ?? []) {
            if (ctrl.signal.aborted || known.has(p.middle)) continue
            known.add(p.middle)
            setProposals((all) => [...all, { id: nextId.current++, middle: p.middle, source: p.source, lang }])
            if (arrived++ === 0) setIndex(startIndex)
          }
        } catch {
          /* cancelada o sin respuesta: las demás peticiones siguen */
        }
      }),
    )
    if (abort.current === ctrl) {
      setLoading(false)
      if (arrived === 0 && !ctrl.signal.aborted) toast.info("No hay más versiones por ahora. Cambia los ajustes e inténtalo de nuevo.")
    }
  }

  /** La primera vez que se llega al paso se piden las propuestas solas. */
  const ensureGenerated = () => {
    if (!requested.current) void generate()
  }

  return { proposals, index, current, body, loading, settings, setSettings, contact, setContact, available, cvValues, asks, askValues, setAskValue, recipientName, setRecipientName, lang, missingAsks, links, hasWebFromCv, extraUrl, addUrl, removeUrl, edit, resetEdit, go, generate, ensureGenerated }
}
