"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ExternalLinkIcon, InfoIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Logo } from "@/components/brand/logo"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { LoadingState } from "@/components/ai/loading-state"
import { BeamBadge } from "@/components/magic/beam-badge"
import { BlurReveal } from "@/components/motion/blur-reveal"
import { ResponsiveSheet } from "@/components/jobs/responsive-sheet"
import { SourcesAdmin } from "@/components/jobs/sources-admin"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { applyLabel, type Apply } from "@/lib/jobs/apply"
import { OfferReview } from "@/components/jobs/offer-review"
import type { FieldEvidence } from "@/lib/jobs/evidence"
import { classifyEntry } from "@/lib/jobs/entry-kind"
import type { FieldKey } from "@/lib/jobs/field-values"
import { COUNTRIES, REGION_OPTIONS } from "@/lib/jobs/geo"
import { CURRENCIES, PERIODS, type Salary } from "@/lib/jobs/salary"
import type { JobDraft } from "@/lib/jobs/draft"
import { SENIORITY } from "@/lib/schemas/offer"

type Row = { id: string; title: string; company: string | null; locationText: string | null; country: string | null; regions: string[]; workMode: string | null; status: string; sourceName: string; sourceUrl: string; createdAt: string }
type Analysis = { draft: JobDraft; evidence?: FieldEvidence[]; existing: { id: string; title: string; status: string } | null; dropped?: unknown[]; cleaning?: { warning?: string } }

const TOKEN_KEY = "sooosh-admin-token"
const MODE = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" } as const
const LEVEL: Record<string, string> = { practicante: "Practicante", junior: "Junior", "semi-senior": "Semi-senior", senior: "Senior", lead: "Líder", directivo: "Directivo" }

/** Qué datos le faltan a una tarjeta guardada (para la lista y el filtro «Incompletas»). */
const missing = (r: Row): string[] => [!r.company && "empresa", !r.locationText && !r.country && "ubicación", r.regions.length === 0 && "región"].filter((x): x is string => !!x)

const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? ""
  } catch {
    return ""
  }
}

/**
 * Panel de administración de ofertas (solo Juan, con la clave ADMIN_TOKEN): pega un enlace o el texto de una oferta, revisa la
 * tarjeta que se extrae (país, regiones, modalidad…), corrígela si hace falta y guárdala en Supabase.
 */
export function JobsAdmin() {
  const [token, setToken] = useState("")
  const [typed, setTyped] = useState("")
  const [authed, setAuthed] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  // Una sola caja: si lo pegado es un enlace se lee la página; si es texto se analiza el texto (con empresa y enlace original opcionales).
  const [entry, setEntry] = useState("")
  const [company, setCompany] = useState("")
  const [link, setLink] = useState("")
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [confirmed, setConfirmed] = useState<ReadonlySet<FieldKey>>(new Set())
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState("")
  const [only, setOnly] = useState<"" | "incompletas" | "ocultas" | "manuales">("")
  const abort = useRef<AbortController | null>(null)

  const api = useCallback(
    async (path: string, tok: string, init: RequestInit = {}) => {
      const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", "x-admin-token": tok, ...init.headers } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw Object.assign(new Error(data.error ?? "No se pudo completar la acción."), { status: res.status })
      return data
    },
    [],
  )

  const sourcesApi = useCallback((path: string, init?: RequestInit) => api(path, token, init), [api, token])

  const load = useCallback(
    async (tok: string, query = "", filter = "") => {
      const data = await api(`/api/jobs?${new URLSearchParams({ q: query, only: filter })}`, tok)
      setRows(data.jobs)
      setTotal(data.total ?? data.jobs.length)
    },
    [api],
  )

  const enter = useCallback(
    async (tok: string) => {
      try {
        await load(tok)
        try {
          sessionStorage.setItem(TOKEN_KEY, tok)
        } catch {
          /* sin almacenamiento: la clave solo vale mientras la pestaña esté abierta */
        }
        setToken(tok)
        setAuthed(true)
        setError("")
      } catch (e) {
        setAuthed(false)
        setError((e as Error).message)
      }
    },
    [load],
  )

  // Si la pestaña ya tenía la clave guardada, entra sola (si ya no vale, muestra el formulario).
  useEffect(() => {
    const saved = readToken()
    if (!saved) return
    let alive = true
    api("/api/jobs", saved)
      .then((data) => {
        if (!alive) return
        setRows(data.jobs)
        setTotal(data.total ?? data.jobs.length)
        setToken(saved)
        setAuthed(true)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [api])

  const analyze = async () => {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setBusy(true)
    setError("")
    setAnalysis(null)
    setConfirmed(new Set())
    try {
      const body = classifyEntry(entry) === "url" ? { url: entry.trim() } : { text: entry, link: link.trim() || undefined, company: company.trim() || undefined }
      const result = await api("/api/jobs/analyze", token, { method: "POST", body: JSON.stringify(body), signal: ctrl.signal })
      if (!ctrl.signal.aborted) setAnalysis(result)
    } catch (e) {
      if (!ctrl.signal.aborted) setError((e as Error).message)
    } finally {
      if (!ctrl.signal.aborted) setBusy(false)
    }
  }

  /** Cierra la hoja: si el análisis seguía en curso, se cancela y su resultado se ignora. */
  const discard = () => {
    abort.current?.abort()
    setBusy(false)
    setAnalysis(null)
  }

  const save = async () => {
    if (!analysis) return
    setSaving(true)
    setError("")
    try {
      const r = await api("/api/jobs", token, { method: "POST", body: JSON.stringify({ ...analysis.draft, salary: analysis.draft.salary?.min || analysis.draft.salary?.max ? analysis.draft.salary : undefined }) })
      toast.success(r.created ? "Tarjeta guardada" : "Tarjeta actualizada")
      if (r.company?.created) toast.success(`Agregué ${r.company.token} (${r.company.ats}) al directorio de fuentes: sus demás ofertas se sincronizan desde «Fuentes».`)
      setAnalysis(null)
      setEntry("")
      setCompany("")
      setLink("")
      await load(token, q, only)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Buscador y filtro de la lista: consulta al servidor tras una breve pausa al escribir.
  useEffect(() => {
    if (!authed) return
    const t = setTimeout(() => void load(token, q, only).catch((e) => toast.error((e as Error).message)), 250)
    return () => clearTimeout(t)
  }, [authed, token, q, only, load])

  const patch = (p: Partial<JobDraft>) => setAnalysis((a) => (a ? { ...a, draft: { ...a.draft, ...p } } : a))
  // El salario se edita completo (moneda y período incluidos); al guardar, si no tiene monto, se omite.
  const patchSalary = (p: Partial<Salary>) =>
    setAnalysis((a) => {
      if (!a) return a
      const next: Salary = { currency: "COP", period: "mes", ...a.draft.salary, ...p }
      return { ...a, draft: { ...a.draft, salary: next } }
    })

  const toggle = async (r: Row, visible: boolean) => {
    const status = visible ? "activa" : "oculta"
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status } : x)))
    try {
      await api(`/api/jobs/${r.id}`, token, { method: "PATCH", body: JSON.stringify({ status }) })
    } catch (e) {
      toast.error((e as Error).message)
      await load(token, q, only)
    }
  }

  const remove = async (r: Row) => {
    try {
      await api(`/api/jobs/${r.id}`, token, { method: "DELETE" })
      setRows((rs) => rs.filter((x) => x.id !== r.id))
      toast.success("Tarjeta eliminada")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // Misma cabecera que inicio y búsqueda: marca a la izquierda, acciones a la derecha, pegadas a los bordes.
  const header = (
    <header className="flex items-center justify-between px-4 py-3 sm:px-6">
      <Link href="/" className="flex items-center gap-2 text-sm font-medium">
        <Logo className="size-5" />
        Sooosh · Ofertas
      </Link>
      <div className="flex items-center">
        <Link href="/ofertas" className={buttonVariants({ variant: "ghost", size: "sm", className: "text-muted-foreground" })}>
          Volver a la app
        </Link>
        <ThemeToggle />
      </div>
    </header>
  )

  if (!authed) {
    return (
      <div className="flex min-h-dvh w-full flex-col">
        {header}
        <form
          className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-16 sm:px-6"
          onSubmit={(e) => {
            e.preventDefault()
            void enter(typed.trim())
          }}
        >
          <Field>
            <FieldLabel htmlFor="admin-token">Clave de administrador</FieldLabel>
            <Input id="admin-token" type="password" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={!typed.trim()}>
            Entrar
          </Button>
        </form>
      </div>
    )
  }

  const d = analysis?.draft
  const kind = classifyEntry(entry)
  const canAnalyze = kind === "url" ? entry.trim().length > 8 : entry.trim().length >= 200
  return (
    <div className="flex min-h-dvh w-full flex-col">
      {header}
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-6 sm:px-6">
        <section className="flex flex-col gap-4" aria-label="Cargar una oferta">
          <Field>
            <FieldLabel htmlFor="job-entry" className="sr-only">
              Enlace o texto de la oferta
            </FieldLabel>
            <Textarea id="job-entry" rows={kind === "url" ? 2 : 10} placeholder="Pega el enlace de la oferta o su texto" value={entry} onChange={(e) => setEntry(e.target.value)} />
          </Field>
          {kind === "text" && entry.trim() && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="job-company" className="sr-only">
                  Empresa (opcional)
                </FieldLabel>
                <Input id="job-company" placeholder="Empresa o perfil que publica (opcional)" value={company} onChange={(e) => setCompany(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="job-link" className="sr-only">
                  Enlace original (opcional)
                </FieldLabel>
                <Input id="job-link" type="url" inputMode="url" placeholder="Enlace original (opcional): será el botón «Postular»" value={link} onChange={(e) => setLink(e.target.value)} />
              </Field>
            </FieldGroup>
          )}
          <Button className="self-start" onClick={() => void analyze()} disabled={!canAnalyze || busy}>
            Analizar oferta
          </Button>
          {error && !analysis && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </section>

      <ResponsiveSheet open={!!analysis} onOpenChange={(o) => !o && !saving && discard()}>
        {({ Header, Title, Description }) =>
          analysis && d ? (
            <>
              <Header className="text-left">
                <Title className="text-lg">Revisa la oferta</Title>
                <Description className="sr-only">Revisa cada dato antes de guardar la tarjeta.</Description>
              </Header>
              <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
          {analysis.existing && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>Ya hay una tarjeta con este enlace («{analysis.existing.title}»). Al guardar se actualiza, no se duplica.</span>
            </p>
          )}
          {analysis.cleaning?.warning && <p className="text-xs text-muted-foreground">{analysis.cleaning.warning}</p>}
          {/* La empresa casi nunca viene en el texto de una publicación: se pide arriba, sin tener que buscar el campo en el formulario (se queda mientras se escribe). */}
          {(analysis.evidence ? !analysis.evidence.find((e) => e.key === "empresa")?.value : !d.company) && (
            <Field>
              <FieldLabel htmlFor="d-company-top">Falta la empresa</FieldLabel>
              <Input id="d-company-top" placeholder="Escríbela o déjala vacía" value={d.company ?? ""} onChange={(e) => patch({ company: e.target.value || undefined })} />
            </Field>
          )}
          {analysis.evidence && (
            <OfferReview
              evidence={analysis.evidence}
              draft={d}
              confirmed={confirmed}
              onConfirm={(key) => {
                setConfirmed((c) => new Set(c).add(key))
                if (key === "titulo") patch({ titleSource: "texto" })
              }}
              onClear={(key, p) => {
                patch(p)
                setConfirmed((c) => new Set(c).add(key))
              }}
            />
          )}
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="d-title">Título</FieldLabel>
                <Input id="d-title" value={d.title} onChange={(e) => patch({ title: e.target.value, titleSource: "texto" })} aria-invalid={d.titleSource === "falta" || d.titleSource === "inferido"} />
                {d.titleSource === "inferido" && (
                  <FieldDescription>
                    El texto no trae el cargo: esta es una sugerencia sacada de la publicación.{" "}
                    <button type="button" className="text-foreground underline underline-offset-4" onClick={() => patch({ titleSource: "texto" })}>
                      Confirmar título
                    </button>
                  </FieldDescription>
                )}
                {d.titleSource === "falta" && <FieldDescription>El texto no trae el cargo: escríbelo para poder guardar.</FieldDescription>}
              </Field>
              <Field>
                <FieldLabel htmlFor="d-company">Empresa</FieldLabel>
                <Input id="d-company" value={d.company ?? ""} onChange={(e) => patch({ company: e.target.value || undefined })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="d-location">Ubicación</FieldLabel>
                <Input id="d-location" value={d.locationText ?? ""} onChange={(e) => patch({ locationText: e.target.value || undefined })} placeholder="Ciudad, país" />
              </Field>
              <Field>
                <FieldLabel htmlFor="d-country">País</FieldLabel>
                <NativeSelect id="d-country" className="w-full" value={d.country ?? ""} onChange={(e) => patch({ country: e.target.value || undefined })}>
                  <NativeSelectOption value="">Sin país</NativeSelectOption>
                  {COUNTRIES.map((c) => (
                    <NativeSelectOption key={c.code} value={c.code}>
                      {c.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="d-mode">Modalidad</FieldLabel>
                <NativeSelect id="d-mode" className="w-full" value={d.workMode ?? ""} onChange={(e) => patch({ workMode: (e.target.value || undefined) as JobDraft["workMode"] })}>
                  <NativeSelectOption value="">No indica</NativeSelectOption>
                  {Object.entries(MODE).map(([k, v]) => (
                    <NativeSelectOption key={k} value={k}>
                      {v}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="d-level">Nivel</FieldLabel>
                <NativeSelect id="d-level" className="w-full" value={d.seniority ?? ""} onChange={(e) => patch({ seniority: e.target.value || undefined })}>
                  <NativeSelectOption value="">No indica</NativeSelectOption>
                  {SENIORITY.filter((s) => s !== "no-especificado").map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {LEVEL[s]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="d-type">Tipo de contrato</FieldLabel>
                <Input id="d-type" value={d.employmentType ?? ""} onChange={(e) => patch({ employmentType: e.target.value || undefined })} />
              </Field>
            </div>
            {d.workMode === "remoto" && (
              <Field>
                <FieldLabel htmlFor="d-scope">Restricción del puesto remoto</FieldLabel>
                <Input id="d-scope" value={d.remoteScope ?? ""} onChange={(e) => patch({ remoteScope: e.target.value || undefined })} placeholder="Solo residentes en Colombia, GMT-5…" />
                </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="d-apply">Cómo se postula</FieldLabel>
                <NativeSelect id="d-apply" className="w-full" value={d.apply.method} onChange={(e) => patch({ apply: { ...d.apply, method: e.target.value as Apply["method"] } })}>
                  {(["plataforma", "formulario", "correo", "sitio", "desconocido"] as const).map((m) => (
                    <NativeSelectOption key={m} value={m}>
                      {applyLabel({ method: m, platform: m === "plataforma" ? (d.apply.platform ?? "un portal") : undefined })}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {d.apply.method === "plataforma" && (
                <Field>
                  <FieldLabel htmlFor="d-platform">Portal</FieldLabel>
                  <Input id="d-platform" value={d.apply.platform ?? ""} onChange={(e) => patch({ apply: { ...d.apply, platform: e.target.value || undefined } })} placeholder="LinkedIn, Computrabajo…" />
                </Field>
              )}
              {d.apply.method === "correo" ? (
                <Field>
                  <FieldLabel htmlFor="d-apply-email">Correo para enviar el CV</FieldLabel>
                  <Input id="d-apply-email" type="email" value={d.apply.email ?? ""} onChange={(e) => patch({ apply: { ...d.apply, email: e.target.value || undefined, url: e.target.value ? `mailto:${e.target.value}` : undefined } })} />
                </Field>
              ) : (
                d.apply.method !== "desconocido" && (
                  <Field>
                    <FieldLabel htmlFor="d-apply-url">Enlace para postular</FieldLabel>
                    <Input id="d-apply-url" type="url" value={d.apply.url ?? ""} onChange={(e) => patch({ apply: { ...d.apply, url: e.target.value || undefined } })} placeholder="https://" />
                  </Field>
                )
              )}
              {(d.apply.alt ?? []).map((c, i) => {
                const isMail = c.method === "correo"
                const setAlt = (next: Apply | null) => patch({ apply: { ...d.apply, alt: (d.apply.alt ?? []).flatMap((x, j) => (j === i ? (next ? [next] : []) : [x])) } })
                return (
                  <div key={i} className="flex items-end gap-2">
                    <Field className="flex-1">
                      <FieldLabel htmlFor={`d-alt-${i}`}>{isMail ? "Otra vía: correo" : "Otra vía: enlace"}</FieldLabel>
                      <Input
                        id={`d-alt-${i}`}
                        type={isMail ? "email" : "url"}
                        value={(isMail ? c.email : c.url) ?? ""}
                        placeholder={isMail ? "" : "https://"}
                        onChange={(e) => setAlt(isMail ? { ...c, email: e.target.value || undefined, url: e.target.value ? `mailto:${e.target.value}` : undefined } : { ...c, url: e.target.value || undefined })}
                      />
                    </Field>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAlt(null)}>
                      Quitar
                    </Button>
                  </div>
                )
              })}
              {(d.apply.alt?.length ?? 0) < 3 && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => patch({ apply: { ...d.apply, alt: [...(d.apply.alt ?? []), { method: "correo" }] } })}>
                    Agregar otro correo
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => patch({ apply: { ...d.apply, alt: [...(d.apply.alt ?? []), { method: "formulario" }] } })}>
                    Agregar otro enlace
                  </Button>
                </div>
              )}
            </div>
            <Field>
              <FieldLabel id="d-salary">Salario (solo si la oferta lo dice)</FieldLabel>
              <div role="group" aria-labelledby="d-salary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Input aria-label="Salario mínimo" type="number" inputMode="numeric" min={0} placeholder="Mínimo" value={d.salary?.min ?? ""} onChange={(e) => patchSalary({ min: e.target.value ? Number(e.target.value) : undefined })} />
                <Input aria-label="Salario máximo" type="number" inputMode="numeric" min={0} placeholder="Máximo" value={d.salary?.max ?? ""} onChange={(e) => patchSalary({ max: e.target.value ? Number(e.target.value) : undefined })} />
                <NativeSelect aria-label="Moneda" className="w-full" value={d.salary?.currency ?? "COP"} onChange={(e) => patchSalary({ currency: e.target.value as Salary["currency"] })}>
                  {CURRENCIES.map((c) => (
                    <NativeSelectOption key={c} value={c}>
                      {c}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <NativeSelect aria-label="Período" className="w-full" value={d.salary?.period ?? "mes"} onChange={(e) => patchSalary({ period: e.target.value as Salary["period"] })}>
                  {PERIODS.map((p) => (
                    <NativeSelectOption key={p} value={p}>
                      {p === "mes" ? "Por mes" : p === "año" ? "Por año" : "Por hora"}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </Field>
            <Field>
              <FieldLabel id="d-regions">Regiones donde se puede postular</FieldLabel>
              <ToggleGroup aria-labelledby="d-regions" multiple variant="outline" spacing={1} className="flex-wrap justify-start" value={d.regions} onValueChange={(v) => patch({ regions: v })}>
                <ToggleGroupItem value="TODAS" aria-label="Todas las regiones">
                  Todas
                </ToggleGroupItem>
                {REGION_OPTIONS.map((r) => (
                  <ToggleGroupItem key={r.code} value={r.code} aria-label={r.name}>
                    {r.code === "LATAM" ? "LATAM" : r.code}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {d.regions.length === 0 && <FieldDescription>Sin región, la tarjeta no aparece al filtrar por región.</FieldDescription>}
            </Field>
          </FieldGroup>
          <div className="flex flex-col gap-2 text-sm">
            {d.skills.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Habilidades detectadas">
                {d.skills.map((s) => (
                  <li key={s}>
                    <Badge variant="secondary">{s}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Fuente: {d.sourceName}
              {d.sourceUrl.startsWith("texto:") ? " (texto pegado, sin enlace)" : ` · ${d.sourceUrl}`}
            </p>
          </div>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void save()} disabled={saving || !d.title.trim() || d.titleSource === "inferido"}>
                  {saving ? <Spinner data-icon="inline-start" /> : null}
                  {analysis.existing ? "Actualizar tarjeta" : "Guardar tarjeta"}
                </Button>
                <Button variant="ghost" onClick={discard} disabled={saving}>
                  Descartar
                </Button>
              </div>
            </>
          ) : null
        }
      </ResponsiveSheet>

      {/* Mientras se analiza: el mismo distintivo de «Ofertas encontradas», sin haz de luz, con el cargador. */}
      <BlurReveal show={busy} className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center px-4">
        <div className="pointer-events-auto">
          <BeamBadge beam={false}>
            <span className="flex items-center gap-2">
              <LoadingState size="sm" messages={["Leyendo la oferta…", "Separando los datos…", "Verificando cada dato…"]} />
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Cancelar el análisis" onClick={discard}>
                <XIcon aria-hidden />
              </Button>
            </span>
          </BeamBadge>
        </div>
      </BlurReveal>

        <section className="flex flex-col gap-3" aria-labelledby="guardadas">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id="guardadas" className="text-lg font-medium">
              Tarjetas
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {rows.length < total ? `${rows.length} de ${total}` : total}
              </span>
            </h2>
            <ToggleGroup value={[only || "todas"]} onValueChange={(v) => v[0] && setOnly(v[0] === "todas" ? "" : (v[0] as "incompletas" | "ocultas" | "manuales"))} variant="outline" size="sm" className="ml-auto">
              <ToggleGroupItem value="todas">Todas</ToggleGroupItem>
              <ToggleGroupItem value="manuales">Manuales</ToggleGroupItem>
              <ToggleGroupItem value="incompletas">Incompletas</ToggleGroupItem>
              <ToggleGroupItem value="ocultas">Ocultas</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" aria-label="Buscar tarjetas por cargo o empresa" placeholder="Buscar por cargo o empresa" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Sin tarjetas.</p> : (
          <ul className="flex flex-col divide-y divide-border/40">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{[r.company, r.locationText ?? r.country].filter(Boolean).join(" · ") || "Sin empresa ni ubicación"}</p>
                  {missing(r).length > 0 && <p className="text-xs text-muted-foreground">Falta: {missing(r).join(", ")}</p>}
                  <ul className="flex flex-wrap gap-1.5" aria-label="Etiquetas">
                    {r.workMode && (
                      <li>
                        <Badge variant="secondary">{MODE[r.workMode as keyof typeof MODE] ?? r.workMode}</Badge>
                      </li>
                    )}
                    {r.regions.map((x) => (
                      <li key={x}>
                        <Badge variant="secondary">{x === "TODAS" ? "Todas" : x}</Badge>
                      </li>
                    ))}
                    <li>
                      <Badge variant="secondary">{r.sourceName}</Badge>
                    </li>
                  </ul>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Switch checked={r.status === "activa"} onCheckedChange={(v) => void toggle(r, v)} aria-label={r.status === "activa" ? `Ocultar «${r.title}»` : `Mostrar «${r.title}»`} />
                  {!r.sourceUrl.startsWith("texto:") && (
                    <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir la oferta original de «${r.title}»`} className={buttonVariants({ variant: "ghost", size: "icon" })}>
                      <ExternalLinkIcon aria-hidden />
                    </a>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Eliminar «${r.title}»`} />}>
                      <Trash2Icon aria-hidden />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta tarjeta?</AlertDialogTitle>
                        <AlertDialogDescription>«{r.title}» se borra de la base de datos. Si solo quieres que no aparezca, apágala con el interruptor.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void remove(r)}>Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
          )}
        </section>

        <SourcesAdmin api={sourcesApi} />
      </main>
    </div>
  )
}
