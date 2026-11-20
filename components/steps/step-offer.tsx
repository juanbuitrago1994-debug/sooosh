"use client"

import { useRef, useState } from "react"
import { AlertCircleIcon, ChevronDownIcon, LinkIcon } from "lucide-react"
import { useAiWork } from "@/components/ai/ai-work"
import { StepHeader } from "@/components/wizard/step-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { OFFER_MAX_CHARS, OFFER_MIN_CHARS, type Offer } from "@/lib/schemas/offer"

export type OfferState = {
  text: string
  /** Oferta estructurada; solo vale si `analyzedText` coincide con `text`. */
  offer: Offer | null
  analyzedText: string
  /** El texto ya pasó por la limpieza (vino de una URL y no se editó): no hace falta limpiarlo otra vez. */
  cleaned?: boolean
  /** Aviso de lo que hizo el pipeline (líneas quitadas, frases descartadas). */
  note?: string
}

export const emptyOffer: OfferState = { text: "", offer: null, analyzedText: "" }

/** La oferta está lista para continuar: texto suficiente y analizado tal como está. */
export function offerReady(s: OfferState) {
  return s.text.trim().length >= OFFER_MIN_CHARS && !!s.offer && s.analyzedText === s.text
}

const LANG: Record<Offer["language"], string> = { es: "Español", en: "Inglés", otro: "Otro idioma" }

async function post<T>(body: unknown, signal: AbortSignal): Promise<T> {
  const res = await fetch("/api/offer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? "No se pudo procesar la oferta.")
  return json as T
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  )
}

export function StepOffer({ value, onChange }: { value: OfferState; onChange: (v: OfferState) => void }) {
  const [tab, setTab] = useState<"text" | "url">("text")
  const [url, setUrl] = useState("")
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState("")
  const abortRef = useRef<AbortController | null>(null)
  const ai = useAiWork()

  const len = value.text.trim().length
  const short = len < OFFER_MIN_CHARS
  const analyzed = offerReady(value)

  const fetchUrl = async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setFetching(true)
    setError("")
    try {
      const r = await post<{ text: string; removed: number; warning?: string }>({ url }, ctrl.signal)
      onChange({ ...emptyOffer, text: r.text, cleaned: true, note: [r.removed > 0 ? `Se quitaron ${r.removed} líneas que no eran de la oferta (comentarios, menús, avisos).` : "", r.warning ?? ""].filter(Boolean).join(" ") })
      setTab("text")
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message)
    } finally {
      setFetching(false)
    }
  }

  const analyze = async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setError("")
    ai.start(["Leyendo la oferta con el modelo local"], () => ctrl.abort())
    try {
      const r = await post<{ offer: Offer; text: string; dropped: string[]; cleaning: { removed: number; warning?: string } }>({ text: value.text.trim(), cleaned: value.cleaned }, ctrl.signal)
      const note = [
        r.cleaning.removed > 0 ? `Se quitaron ${r.cleaning.removed} líneas que no eran de la oferta (comentarios, menús, avisos).` : "",
        r.cleaning.warning ?? "",
        r.dropped.length > 0 ? `Se descartaron ${r.dropped.length} datos que el modelo propuso y no estaban escritos en la oferta.` : "",
      ]
        .filter(Boolean)
        .join(" ")
      // El texto limpio reemplaza al pegado: es el que se analiza y el que verá el resto del flujo.
      onChange({ text: r.text, offer: r.offer, analyzedText: r.text, cleaned: true, note })
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message)
    } finally {
      ai.stop()
    }
  }

  const o = analyzed ? value.offer : null

  return (
    <div className="flex flex-col gap-5">
      <StepHeader title="Pega la oferta" description="Pega el texto o trae el enlace. Todo se lee en tu equipo." />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "text" | "url")}>
        <TabsList className="w-full">
          <TabsTrigger value="text">Pegar texto</TabsTrigger>
          <TabsTrigger value="url">Desde URL</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>No pudimos continuar</AlertTitle>
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
      )}
      {error && tab === "url" && (
        <Button variant="outline" className="h-11" onClick={() => setTab("text")}>
          Pegar texto
        </Button>
      )}

      {tab === "text" ? (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="offer-text">Texto de la oferta</FieldLabel>
            <Textarea
              id="offer-text"
              rows={analyzed ? 5 : 10}
              maxLength={OFFER_MAX_CHARS}
              value={value.text}
              placeholder="Pega aquí la oferta completa: requisitos, funciones y lo que se valora."
              onChange={(e) => onChange({ ...value, text: e.target.value, cleaned: false, note: undefined })}
            />
            <FieldDescription>
              {len} caracteres{short ? ` · mínimo ${OFFER_MIN_CHARS} para continuar` : ""}
              {value.note ? ` · ${value.note}` : ""}
            </FieldDescription>
          </Field>
          {!analyzed && (
            <Button size="lg" className="h-11" disabled={short} onClick={analyze}>
              Analizar oferta
            </Button>
          )}
        </FieldGroup>
      ) : (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="offer-url">Enlace de la oferta</FieldLabel>
            <Input id="offer-url" type="url" inputMode="url" className="h-11" placeholder="https://empresa.com/empleos/123" value={url} onChange={(e) => setUrl(e.target.value)} />
            <FieldDescription>Algunos sitios (LinkedIn, por ejemplo) exigen iniciar sesión; en ese caso pega el texto.</FieldDescription>
          </Field>
          <Button variant="outline" size="lg" className="h-11" disabled={!url.trim() || fetching} onClick={fetchUrl}>
            {fetching ? <Spinner aria-label="Cargando" data-icon="inline-start" /> : <LinkIcon data-icon="inline-start" />}
            {fetching ? "Trayendo la oferta…" : "Traer oferta"}
          </Button>
        </FieldGroup>
      )}

      {o && (
        <Collapsible className="rounded-2xl bg-muted p-4">
          <div className="flex flex-col gap-1">
            <p className="font-medium">{o.title}</p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {o.company && <span>{o.company}</span>}
              <Badge variant="secondary">{LANG[o.language]}</Badge>
              <span>
                {o.requirements.length} requisitos · {o.niceToHave.length} deseables
              </span>
            </p>
          </div>
          <CollapsibleTrigger className="group mt-3 flex min-h-11 items-center gap-1 text-sm font-medium text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Ver lo que entendí
            <ChevronDownIcon className="size-4 transition-transform group-data-panel-open:rotate-180" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-4 pt-2">
            <ListBlock title="Requisitos" items={o.requirements} />
            <ListBlock title="Se valora" items={o.niceToHave} />
            <ListBlock title="Responsabilidades" items={o.responsibilities} />
            <p className="text-xs text-muted-foreground">Si algo está mal, edita el texto y vuelve a analizar.</p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
