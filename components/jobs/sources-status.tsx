"use client"

import { useEffect, useState } from "react"
import { AlertTriangleIcon, ArrowLeftIcon, CheckIcon, CircleAlertIcon, CircleCheckIcon, ExternalLinkIcon, FlameIcon, RadioTowerIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { ResponsiveSheet, type SheetShell } from "@/components/jobs/responsive-sheet"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Area, AreaChart } from "recharts"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { SourceState, SourceStatus } from "@/lib/sources/status"

const STATE: Record<SourceState, { label: string; variant: "secondary" | "outline" | "destructive"; icon: typeof CheckIcon }> = {
  ok: { label: "Al día", variant: "secondary", icon: CheckIcon },
  warn: { label: "Con incidencias", variant: "outline", icon: AlertTriangleIcon },
  late: { label: "Atrasada", variant: "destructive", icon: CircleAlertIcon },
  paused: { label: "En pausa", variant: "outline", icon: CircleAlertIcon },
  new: { label: "Sin lecturas", variant: "outline", icon: CircleAlertIcon },
  off: { label: "Pausada", variant: "outline", icon: CircleAlertIcon },
}

const when = (iso: string) => new Date(iso).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const ago = (iso: string, at: number) => {
  const h = Math.round((at - new Date(iso).getTime()) / 3_600_000)
  return h < 1 ? "hace menos de 1 h" : h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`
}

function StateBadge({ state }: { state: SourceState }) {
  const s = STATE[state]
  return (
    <Badge variant={s.variant} className="shrink-0">
      <s.icon data-icon="inline-start" aria-hidden />
      {s.label}
    </Badge>
  )
}

type Shell = SheetShell

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

const TREND_CONFIG = { n: { label: "Ofertas activas", color: "var(--chart-1)" } } satisfies ChartConfig

/** Evolución de las ofertas activas de la fuente (foto diaria). Con menos de 3 días de datos no se muestra: no diría nada. */
function Trend({ trend }: { trend: SourceStatus["trend"] }) {
  if (trend.length < 3) return null
  const first = trend[0]
  const last = trend[trend.length - 1]
  const delta = last.n - first.n
  return (
    <section className="flex flex-col gap-2" aria-label="Tendencia">
      <h3 className="text-sm font-medium">Ofertas activas ({trend.length} días)</h3>
      <ChartContainer config={TREND_CONFIG} className="h-16 w-full">
        <AreaChart data={trend} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <Area dataKey="n" type="monotone" stroke="var(--color-n)" fill="var(--color-n)" fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} />
        </AreaChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground">
        De {first.n} a {last.n} ({delta >= 0 ? "+" : ""}
        {delta}) desde el {new Date(first.day + "T00:00:00").toLocaleDateString("es", { day: "numeric", month: "short" })}.
      </p>
    </section>
  )
}

function Detail({ s, at, onBack, shell }: { s: SourceStatus; at: number; onBack: () => void; shell: Shell }) {
  const { Header, Title, Description } = shell
  const st = s.stats
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 motion-safe:duration-200">
      <Header className="items-start gap-2 text-left">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden />
          Fuentes
        </Button>
        <Title className="text-lg">{s.name}</Title>
        <Description>
          {s.kind} · se lee cada {s.everyHours} h
        </Description>
      </Header>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StateBadge state={s.state} />
          {s.lastOkAt && <span className="text-sm text-muted-foreground">Última lectura con éxito {ago(s.lastOkAt, at)}</span>}
        </div>
        {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
        {s.home && (
          <a href={s.home} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}>
            <ExternalLinkIcon data-icon="inline-start" aria-hidden />
            Visitar la fuente
          </a>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <Stat label="Ofertas activas" value={String(s.activeOffers)} />
          <Stat label="Nuevas (48 h)" value={String(st.new48)} />
          <Stat label="Oferta más reciente" value={st.latestAt ? ago(st.latestAt, at) : "—"} />
          <Stat label="De tecnología" value={`${st.techPct} %`} />
          <Stat label="Con salario publicado" value={`${st.salaryPct} %`} />
          <Stat label="Remotas" value={`${st.remotePct} %`} />
        </dl>

        <Trend trend={s.trend} />

        {st.countries.length > 0 && (
          <section className="flex flex-col gap-2" aria-label="Países principales">
            <h3 className="text-sm font-medium">Países principales</h3>
            <ul className="flex flex-wrap gap-1.5">
              {st.countries.map((c) => (
                <li key={c.name}>
                  <Badge variant="secondary">
                    {c.name} · {c.n}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        )}
        {st.families.length > 0 && (
          <section className="flex flex-col gap-2" aria-label="Cargos principales">
            <h3 className="text-sm font-medium">Cargos principales</h3>
            <ul className="flex flex-wrap gap-1.5">
              {st.families.map((f) => (
                <li key={f.name}>
                  <Badge variant="secondary">
                    {f.name} · {f.n}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        {s.breakdown && s.breakdown.length > 0 && (
          <section className="flex flex-col gap-2" aria-label="Por empresa">
            <h3 className="text-sm font-medium">Por empresa</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {s.breakdown.map((b) => (
                <li key={b.name} className="flex justify-between gap-3">
                  <span className="truncate">{b.name}</span>
                  <span className="text-muted-foreground">{b.offers}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {s.attribution && <p className="text-xs text-muted-foreground">{s.attribution}</p>}

        <section className="flex flex-col gap-2" aria-label="Historial">
          <h3 className="text-sm font-medium">Historial (30 días)</h3>
          {s.log.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay lecturas registradas.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {s.log.map((l) => (
                <li key={l.at} className="flex items-start gap-2 text-sm">
                  {l.ok ? <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> : <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />}
                  <span className="flex min-w-0 flex-col">
                    <span>
                      <span className="sr-only">{l.ok ? "Correcta: " : "Con problema: "}</span>
                      {l.message}
                    </span>
                    <span className="text-xs text-muted-foreground">{when(l.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function Grid({ data, failed, problems, onSelect, shell }: { data: { sources: SourceStatus[] } | null; failed: boolean; problems: number; onSelect: (id: string) => void; shell: Shell }) {
  const { Header, Title, Description } = shell
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Header className="text-left">
        <Title className="text-lg">Fuentes</Title>
        <Description>{data === null ? "Revisando…" : problems === 0 ? "Todas al día." : `${problems} ${problems === 1 ? "necesita" : "necesitan"} atención.`}</Description>
      </Header>
      {/* Con muchas fuentes, la cuadrícula se desplaza dentro del panel. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            No se pudo cargar el estado. Inténtalo de nuevo.
          </p>
        )}
        {data === null && !failed && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="aspect-4/3 min-h-32 rounded-lg" />
            ))}
          </div>
        )}
        {data && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.sources.map((s) => (
              <li key={s.id} className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150">
                <Item
                  variant="outline"
                  render={<button type="button" onClick={() => onSelect(s.id)} />}
                  className="aspect-4/3 min-h-32 flex-col flex-nowrap items-stretch justify-between gap-2 text-left hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <ItemDescription className="line-clamp-1">{s.kind}</ItemDescription>
                    <StateBadge state={s.state} />
                  </div>
                  <ItemContent>
                    <ItemTitle className="line-clamp-2 text-sm">{s.name}</ItemTitle>
                  </ItemContent>
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-lg font-medium">
                      {s.activeOffers}
                      <span className="pl-1 text-xs font-normal text-muted-foreground">{s.activeOffers === 1 ? "oferta" : "ofertas"}</span>
                    </span>
                    {s.stats.new48 > 0 && (
                      <Badge variant="outline" className="text-primary">
                        <FlameIcon data-icon="inline-start" aria-hidden />
                        {s.stats.new48}
                      </Badge>
                    )}
                  </div>
                </Item>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * «Fuentes»: de dónde salen las ofertas. Una cuadrícula de tarjetas (una por fuente) con su estado, ofertas activas y cuántas son nuevas;
 * al tocar una, su ficha: qué es, qué trae (tecnología, salario, remotas, países, cargos), historial de 30 días y enlace a la fuente.
 * Ventana en escritorio, panel desde abajo en el móvil. Los errores técnicos nunca se muestran.
 */
export function SourcesStatus() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<{ sources: SourceStatus[]; at: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    fetch("/api/sources/status")
      .then(async (r) => {
        if (!r.ok) throw new Error()
        const d = (await r.json()) as { sources: SourceStatus[] }
        if (alive) {
          setData({ sources: d.sources, at: Date.now() })
          setFailed(false)
        }
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [open])

  const problems = (data?.sources ?? []).filter((s) => s.state === "late" || s.state === "paused" || s.state === "warn").length
  const current = data?.sources.find((s) => s.id === selected) ?? null
  const onOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o) setSelected(null)
  }

  const content = (shell: Shell) =>
    current && data ? <Detail key={current.id} s={current} at={data.at} onBack={() => setSelected(null)} shell={shell} /> : <Grid data={data} failed={failed} problems={problems} onSelect={setSelected} shell={shell} />

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Fuentes de ofertas" onClick={() => setOpen(true)}>
        <RadioTowerIcon aria-hidden />
      </Button>
      <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
        {content}
      </ResponsiveSheet>
    </>
  )
}
