import Link from "next/link"
import { ArrowRightIcon, BookmarkIcon, CheckIcon } from "lucide-react"
import { NewBadge } from "@/components/jobs/new-badge"
import { ApplyIcon } from "@/components/jobs/apply-icon"
import { GlassPanel } from "@/components/glass-panel"
import { Badge } from "@/components/ui/badge"
import { applyLabel } from "@/lib/jobs/apply"
import { ago, buildFacts } from "@/lib/jobs/facts"
import type { RankedJob } from "@/lib/jobs/rank"

/**
 * Tarjeta de una oferta en el buscador. Se adapta a lo que hay: título y empresa siempre; hasta 3 datos clave (experiencia, salario,
 * modalidad…) SOLO si existen; y abajo, cómo se postula («Se aplica en LinkedIn»). Toda la tarjeta es un enlace al detalle.
 */
export function JobCard({ job, saved, onOpen }: { job: RankedJob; saved?: boolean; onOpen?: () => void }) {
  const facts = buildFacts(job).filter((f) => f.key !== "publicada").slice(0, 3)
  const when = ago(job.postedAt)
  const subtitle = [job.company, job.locationText, when].filter(Boolean).join(" · ")
  return (
    <li>
      <Link href={`/ofertas/${job.id}`} onClick={onOpen} className="group block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <GlassPanel className="flex flex-col gap-4 p-4 transition-all duration-150 group-hover:bg-muted/40 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-active:translate-y-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="line-clamp-2 text-lg font-medium">
                {job.title}
                {saved && (
                  <>
                    {" "}
                    <BookmarkIcon className="inline size-4 align-text-bottom fill-current text-muted-foreground motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-200" aria-hidden />
                    <span className="sr-only"> (guardada)</span>
                  </>
                )}
              </h2>
              {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {(job.fit || job.isNew) && (
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {job.isNew && <NewBadge />}
                {job.fit && (
                  <Badge variant={job.fit.match ? "default" : "secondary"}>
                    {job.fit.match && <CheckIcon data-icon="inline-start" aria-hidden />}
                    {job.fit.match ? `Match ${job.fit.score} %` : `${job.fit.score} % encaje`}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {facts.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {facts.map((f) => (
                <div key={f.key} className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="truncate text-sm">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {job.skills.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Habilidades">
              {job.skills.slice(0, 4).map((s) => (
                <li key={s}>
                  <Badge variant="secondary">{s}</Badge>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <ApplyIcon method={job.apply?.method} className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{applyLabel(job.apply)}</span>
            </span>
            <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </div>
        </GlassPanel>
      </Link>
    </li>
  )
}
