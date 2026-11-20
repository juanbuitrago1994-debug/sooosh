"use client"

import { useCallback, useEffect, useState } from "react"
import { Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { ATS_LIST, ATS_NAME, type Ats } from "@/lib/sources/companies"
import type { SyncReport } from "@/lib/sources/types"

type Health = { id: string; label: string; everyHours: number; lastOkAt: string | null; agoHours: number | null; lastError: string | null; failing: boolean; stale: boolean }
type Company = { id: string; ats: Ats; token: string; name: string | null; active: boolean; lastSyncedAt: string | null; lastStatus: string | null; lastCount: number | null }
type Api = (path: string, init?: RequestInit) => Promise<Record<string, unknown>>
type Enrich = { pendiente: number; hecho: number; omitido: number; fallido: number }
type EnrichReport = { processed: number; improved: number; omitted: number; failed: number; stoppedBy?: string; ms: number; avgMs: number | null }

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es", { dateStyle: "short", timeStyle: "short" }) : "nunca")

/** Fuentes de ofertas: Get on Board y el directorio de empresas con tablero en Greenhouse, Lever o Ashby. */
export function SourcesAdmin({ api }: { api: Api }) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [reports, setReports] = useState<SyncReport[]>([])
  const [ats, setAts] = useState<Ats>("greenhouse")
  const [token, setToken] = useState("")
  const [name, setName] = useState("")
  const [enrich, setEnrich] = useState<Enrich | null>(null)
  const [enrichReport, setEnrichReport] = useState<EnrichReport | null>(null)
  const [health, setHealth] = useState<Health[]>([])

  const load = useCallback(async () => {
    const d = await api("/api/sources")
    setCompanies(d.companies as Company[])
  }, [api])

  useEffect(() => {
    let alive = true
    api("/api/sources")
      .then((d) => alive && setCompanies(d.companies as Company[]))
      .catch(() => {})
    api("/api/enrich")
      .then((d) => alive && setEnrich(d as unknown as Enrich))
      .catch(() => {})
    api("/api/sources/health")
      .then((d) => alive && setHealth(d.sources as Health[]))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [api])

  const sync = async (target: string, label: string) => {
    setBusy(label)
    try {
      const d = await api("/api/sources/sync", { method: "POST", body: JSON.stringify({ target }) })
      setReports(d.reports as SyncReport[])
      await load()
      toast.success("Sincronización terminada")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const runEnrich = async () => {
    setBusy("enriquecer")
    try {
      const d = await api("/api/enrich", { method: "POST", body: JSON.stringify({ limit: 10 }) })
      setEnrichReport(d.report as EnrichReport)
      setEnrich(d.stats as Enrich)
      toast.success("Enriquecimiento terminado")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const add = async () => {
    try {
      await api("/api/sources", { method: "POST", body: JSON.stringify({ ats, token: token.trim(), name: name.trim() || undefined }) })
      setToken("")
      setName("")
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const toggle = async (c: Company, active: boolean) => {
    setCompanies((cs) => cs.map((x) => (x.id === c.id ? { ...x, active } : x)))
    try {
      await api(`/api/sources/${c.id}`, { method: "PATCH", body: JSON.stringify({ active }) })
    } catch (e) {
      toast.error((e as Error).message)
      await load()
    }
  }

  const remove = async (c: Company) => {
    try {
      await api(`/api/sources/${c.id}`, { method: "DELETE" })
      setCompanies((cs) => cs.filter((x) => x.id !== c.id))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const running = busy !== null
  return (
    <section className="flex flex-col gap-5" aria-labelledby="fuentes">
      <div className="flex flex-col gap-1">
        <h2 id="fuentes" className="text-lg font-medium">
          Fuentes de ofertas
        </h2>
        <p className="text-sm text-muted-foreground">Ofertas que llegan solas desde APIs públicas. Solo entran las de Latinoamérica (y las remotas abiertas a la región); lo que desaparece de la fuente se marca como cerrado.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">Get on Board</p>
          <p className="text-xs text-muted-foreground">Bolsa tech de Latinoamérica · API pública sin clave · tarda unos 30 s</p>
        </div>
        <Button variant="secondary" disabled={running} onClick={() => void sync("getonboard", "Get on Board")}>
          {busy === "Get on Board" && <Spinner data-icon="inline-start" />} Sincronizar
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">Portales sin API (Chile)</p>
          <p className="text-xs text-muted-foreground">Leen solo lo que el sitio publica para buscadores, respetan su robots.txt, van de a una página con pausa y se detienen ante un bloqueo. Solo ofertas nuevas de tecnología, hasta 100 por vez (≈ 2–3 min).</p>
        </div>
        {[{ id: "portal:chiletrabajos", name: "Chiletrabajos" }, { id: "portal:trabajando", name: "Trabajando.cl" }].map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3">
            <p className="text-sm">{p.name}</p>
            <Button variant="secondary" disabled={running} onClick={() => void sync(p.id, p.id)}>
              {busy === p.id && <Spinner data-icon="inline-start" />} Sincronizar
            </Button>
          </div>
        ))}
      </div>

      {health.length > 0 && (
        <div className="flex flex-col gap-2" aria-label="Sincronización automática">
          <p className="text-sm font-medium">Sincronización automática</p>
          <p className="text-xs text-muted-foreground">
            {health.some((h) => h.stale) ? `${health.filter((h) => h.stale).length} fuente(s) atrasada(s).` : "Todas las fuentes al día."} Última lectura con éxito de cada una:
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {health.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className={h.stale ? "text-destructive" : undefined}>{h.label}</span>
                <span className="text-xs text-muted-foreground">
                  {h.agoHours !== null ? `hace ${h.agoHours} h` : "nunca"} · cada {h.everyHours} h{h.failing ? " · en pausa por fallos" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">Ofertas remotas (API gratuita)</p>
          <p className="text-xs text-muted-foreground">Solo las abiertas a Latinoamérica. Cada oferta cita su fuente y el botón de postular lleva a ella (lo piden sus términos). Sincroniza pocas veces al día.</p>
        </div>
        {[{ id: "remote:remotive", name: "Remotive" }, { id: "remote:jobicy", name: "Jobicy" }, { id: "remote:himalayas", name: "Himalayas" }].map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3">
            <p className="text-sm">{p.name}</p>
            <Button variant="secondary" disabled={running} onClick={() => void sync(p.id, p.id)}>
              {busy === p.id && <Spinner data-icon="inline-start" />} Sincronizar
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">Empresas ({companies.length})</p>
          <Button variant="secondary" disabled={running || companies.length === 0} onClick={() => void sync("companies", "todas")}>
            {busy === "todas" && <Spinner data-icon="inline-start" />} Sincronizar todas
          </Button>
        </div>
        {companies.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay empresas. Agrega una abajo, o carga una oferta con enlace de Greenhouse, Lever o Ashby y la empresa se agrega sola.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {companies.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="truncate text-sm font-medium">
                    {c.name ?? c.token} <span className="font-normal text-muted-foreground">· {ATS_NAME[c.ats]}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.lastStatus ?? "Sin sincronizar"} · {when(c.lastSyncedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Switch checked={c.active} onCheckedChange={(v) => void toggle(c, v)} aria-label={c.active ? `Pausar ${c.name ?? c.token}` : `Activar ${c.name ?? c.token}`} />
                  <Button variant="ghost" size="sm" disabled={running} onClick={() => void sync(c.id, c.id)}>
                    {busy === c.id && <Spinner data-icon="inline-start" />} Sincronizar
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Quitar ${c.name ?? c.token} del directorio`} onClick={() => void remove(c)}>
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <Field>
            <FieldLabel htmlFor="s-ats">Sistema</FieldLabel>
            <NativeSelect id="s-ats" value={ats} onChange={(e) => setAts(e.target.value as Ats)}>
              {ATS_LIST.map((a) => (
                <NativeSelectOption key={a} value={a}>
                  {ATS_NAME[a]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="s-token">Nombre del tablero</FieldLabel>
            <Input id="s-token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="cabify" autoCapitalize="none" autoCorrect="off" />
          </Field>
          <Field>
            <FieldLabel htmlFor="s-name">Empresa (opcional)</FieldLabel>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cabify" />
          </Field>
          <Button type="submit" variant="secondary" disabled={token.trim().length < 2}>
            Agregar
          </Button>
          <FieldDescription className="sm:col-span-4">El nombre sale de la dirección del tablero: boards.greenhouse.io/<strong>cabify</strong>, jobs.lever.co/<strong>despegar</strong>, jobs.ashbyhq.com/<strong>addi</strong>.</FieldDescription>
        </form>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">Enriquecer ofertas con IA</p>
            <p className="text-xs text-muted-foreground">
              {enrich ? `${enrich.pendiente} pendientes · ${enrich.hecho} mejoradas · ${enrich.omitido} sin cambios · ${enrich.fallido} fallidas` : "Cola de ofertas sin requisitos ni tareas"} · el modelo local estructura 10 por vez (≈ 10–20 s cada una)
            </p>
          </div>
          <Button variant="secondary" disabled={running || (enrich?.pendiente ?? 0) === 0} onClick={() => void runEnrich()}>
            {busy === "enriquecer" && <Spinner data-icon="inline-start" />} Enriquecer 10
          </Button>
        </div>
        {enrichReport && (
          <p className="text-sm text-muted-foreground">
            Procesadas {enrichReport.processed} · mejoradas {enrichReport.improved} · sin cambios {enrichReport.omitted} · fallidas {enrichReport.failed}
            {enrichReport.avgMs ? ` · ${(enrichReport.avgMs / 1000).toFixed(1)} s por oferta` : ""}
            {enrichReport.stoppedBy ? ` · se detuvo: ${enrichReport.stoppedBy}` : ""}
          </p>
        )}
      </div>

      {reports.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Resultado de la sincronización">
          {reports.map((r, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium">{r.source}: </span>
              {r.error ? (
                <span className="text-destructive">{r.error}</span>
              ) : (
                <span className="text-muted-foreground">
                  leídas {r.fetched} · fuera de la región {r.outOfRegion} · repetidas {r.duplicates} · nuevas {r.created} · actualizadas {r.updated} · cerradas {r.closed}{r.queued ? ` · en cola para IA ${r.queued}` : ""} ({(r.ms / 1000).toFixed(1)} s)
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
