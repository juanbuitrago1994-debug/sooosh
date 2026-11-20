"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { AlertTriangleIcon, ArrowLeftIcon, CheckIcon, ChevronRightIcon, CircleAlertIcon, CircleCheckIcon, RadioTowerIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Skeleton } from "@/components/ui/skeleton"
import type { SourceState, SourceStatus } from "@/lib/sources/status"

const STATE: Record<SourceState, { label: string; variant: "secondary" | "outline" | "destructive"; icon: typeof CheckIcon }> = {
  ok: { label: "Al día", variant: "secondary", icon: CheckIcon },
  warn: { label: "Con incidencias", variant: "outline", icon: AlertTriangleIcon },
  late: { label: "Atrasada", variant: "destructive", icon: CircleAlertIcon },
  paused: { label: "En pausa", variant: "outline", icon: CircleAlertIcon },
  new: { label: "Sin lecturas", variant: "outline", icon: CircleAlertIcon },
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

// En pantallas anchas el panel entra por la derecha; en el móvil, desde abajo.
const wide = () => (typeof window === "undefined" ? false : window.matchMedia("(min-width: 640px)").matches)
const subscribeWide = (cb: () => void) => {
  const m = window.matchMedia("(min-width: 640px)")
  m.addEventListener("change", cb)
  return () => m.removeEventListener("change", cb)
}

/**
 * «Fuentes»: panel lateral con las fuentes de las que salen las ofertas, su estado, cuántas ofertas activas aportan y, al tocar una,
 * su historial de lecturas de 30 días («Extrajo 16 ofertas · 20 nov, 9:17» / «La fuente bloqueó la lectura»). Los errores técnicos nunca se muestran.
 */
export function SourcesStatus() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<{ sources: SourceStatus[]; at: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const isWide = useSyncExternalStore(subscribeWide, wide, () => false)

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

  const sources = data?.sources ?? []
  const problems = sources.filter((s) => s.state !== "ok").length
  const current = sources.find((s) => s.id === selected) ?? null

  return (
    <>
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        <RadioTowerIcon data-icon="inline-start" aria-hidden />
        Fuentes
      </Button>
      <Drawer open={open} onOpenChange={(o) => (setOpen(o), !o && setSelected(null))} swipeDirection={isWide ? "right" : "down"}>
        <DrawerContent className="border-border/40 bg-background/70 backdrop-blur-xl">
          {current ? (
            <div key={current.id} className="flex min-h-0 flex-1 flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 motion-safe:duration-200">
              <DrawerHeader className="items-start gap-2 text-left">
                <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => setSelected(null)}>
                  <ArrowLeftIcon data-icon="inline-start" aria-hidden />
                  Fuentes
                </Button>
                <DrawerTitle className="text-lg">{current.name}</DrawerTitle>
                <DrawerDescription>
                  {current.kind} · se lee cada {current.everyHours} h
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <StateBadge state={current.state} />
                  <span className="text-sm">
                    {current.activeOffers} {current.activeOffers === 1 ? "oferta activa" : "ofertas activas"}
                  </span>
                  {current.lastOkAt && data && <span className="text-sm text-muted-foreground">Última lectura con éxito {ago(current.lastOkAt, data.at)}</span>}
                </div>

                {current.breakdown && current.breakdown.length > 0 && (
                  <section className="flex flex-col gap-2" aria-label="Por empresa">
                    <h3 className="text-sm font-medium">Por empresa</h3>
                    <ul className="flex flex-col gap-1 text-sm">
                      {current.breakdown.map((b) => (
                        <li key={b.name} className="flex justify-between gap-3">
                          <span className="truncate">{b.name}</span>
                          <span className="text-muted-foreground">{b.offers}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="flex flex-col gap-2" aria-label="Historial">
                  <h3 className="text-sm font-medium">Historial (30 días)</h3>
                  {current.log.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todavía no hay lecturas registradas.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {current.log.map((l) => (
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
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <DrawerHeader className="text-left">
                <DrawerTitle className="text-lg">Fuentes de ofertas</DrawerTitle>
                <DrawerDescription>
                  {data === null ? "Revisando el estado de cada fuente…" : problems === 0 ? "Todas las fuentes están al día." : `${problems} ${problems === 1 ? "fuente necesita" : "fuentes necesitan"} atención. Las ofertas de las demás siguen al día.`}
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
                {failed && <p role="alert" className="text-sm text-destructive">No pudimos leer el estado de las fuentes ahora. Inténtalo de nuevo en un momento.</p>}
                {data === null && !failed && (
                  <div className="flex flex-col gap-4" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                )}
                <ul className="flex flex-col">
                  {sources.map((s) => (
                    <li key={s.id} className="border-b border-border/40 last:border-b-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
                      <button type="button" onClick={() => setSelected(s.id)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50">
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">{s.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {s.kind} · {s.activeOffers} {s.activeOffers === 1 ? "oferta" : "ofertas"}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <StateBadge state={s.state} />
                          <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="pt-4 text-xs text-muted-foreground">Cada oferta enlaza a su fuente original. Si una fuente falla, mantenemos las ofertas que ya trajo hasta que venzan.</p>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}
