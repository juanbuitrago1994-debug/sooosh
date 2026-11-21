"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { buildBody, webLinks, type EmailJob } from "@/lib/apply/email"
import { DEFAULT_SETTINGS, cvFacts, FOCUSES, LENGTHS, TONES, type BodySettings } from "@/lib/apply/body-settings"
import type { CV } from "@/lib/schemas/cv"

/** Ajustes de redacción: una comodidad de cada persona, se recuerdan en este navegador. */
const SETTINGS_KEY = "sooosh:correo-ajustes:v1"

function readSettings(): BodySettings {
  try {
    const d = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<BodySettings> | null
    if (d && LENGTHS.includes(d.length as never) && TONES.includes(d.tone as never) && FOCUSES.includes(d.focus as never)) return d as BodySettings
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
export type Proposal = { id: number; middle: string | null; source: "base" | "ia" | "plantilla"; override?: string }

type Params = { cv: CV | null; job: EmailJob; requirements: string[]; covered: string[] }

/**
 * Estado del paso «Cuerpo»: propuestas (la plantilla base y las que pide la persona a la IA local), cuál se ve, ajustes de redacción y el
 * portafolio o web. Vive aquí (y no en el paso) para que no se pierda al ir de un paso a otro.
 */
export function useEmailBody({ cv, job, requirements, covered }: Params) {
  const [proposals, setProposals] = useState<Proposal[]>([{ id: 0, middle: null, source: "base" }])
  const [index, setIndex] = useState(0)
  const [settings, setSettingsState] = useState<BodySettings>(DEFAULT_SETTINGS)
  const [includeWeb, setIncludeWeb] = useState(false)
  const [extraUrl, setExtraUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const nextId = useRef(1)
  const abort = useRef<AbortController | null>(null)
  const requested = useRef(false)
  const settingsLoaded = useRef(false)

  // Los ajustes guardados se leen al montar (no en el render: en el servidor no hay almacenamiento).
  useEffect(() => {
    if (settingsLoaded.current) return
    settingsLoaded.current = true
    setSettingsState(readSettings())
  }, [])
  useEffect(() => () => abort.current?.abort(), [])

  const setSettings = (next: BodySettings) => {
    setSettingsState(next)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    } catch {
      /* no se pudo recordar */
    }
  }

  const cvLinks = cv ? webLinks(cv) : []
  const links = cvLinks.length ? cvLinks : extraUrl ? [{ label: "Portafolio", url: extraUrl }] : []
  const hasWebFromCv = cvLinks.length > 0

  const textOf = (p: Proposal) => (cv ? (p.override ?? buildBody({ cv, job, covered, includeWeb, middle: p.middle ?? undefined, links })) : "")
  const current = proposals[Math.min(index, proposals.length - 1)]
  const body = textOf(current)

  const edit = (text: string) => setProposals((all) => all.map((p) => (p.id === current.id ? { ...p, override: text } : p)))
  const go = (delta: number) => setIndex((i) => Math.max(0, Math.min(proposals.length - 1, i + delta)))

  const addUrl = (raw: string): boolean => {
    const url = normalizeUrl(raw)
    if (!url) return false
    setExtraUrl(url)
    setIncludeWeb(true)
    return true
  }
  const removeUrl = () => {
    setExtraUrl(null)
    setIncludeWeb(false)
  }

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
            setProposals((all) => [...all, { id: nextId.current++, middle: p.middle, source: p.source }])
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

  return { proposals, index, current, body, loading, settings, setSettings, includeWeb, setIncludeWeb, links, hasWebFromCv, extraUrl, addUrl, removeUrl, edit, go, generate, ensureGenerated }
}
