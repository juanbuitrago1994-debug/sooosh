"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, BookmarkIcon, CheckIcon, LinkIcon } from "lucide-react"
import { toast } from "sonner"
import { ApplyIcon } from "@/components/jobs/apply-icon"
import { NewBadge } from "@/components/jobs/new-badge"
import { Logo } from "@/components/brand/logo"
import { PrivacyLink } from "@/components/privacy/privacy-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { applyCta, applyHint, applyLabel } from "@/lib/jobs/apply"
import { buildFacts } from "@/lib/jobs/facts"
import { savePrefill } from "@/lib/jobs/prefill"
import { track } from "@/lib/events/consent"
import { dismissJob, toggleSaved, useMarks } from "@/lib/profile/job-marks"
import type { JobCard } from "@/lib/jobs/search"
import { useSearchProfile } from "@/lib/profile/search-profile"

type Fit = { score: number; covered: string[]; related: string[]; missing: string[] }

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Detalle de una oferta DENTRO de Sooosh: un resumen concreto con los datos que tenemos (nada de «No indica»), cómo se postula, cuánto
 * encaja el CV y, siempre a la vista, el botón de postular y el de adaptar el CV.
 */
export function JobDetail({ job }: { job: JobCard }) {
  const router = useRouter()
  const marks = useMarks()
  const isSaved = marks.saved.includes(job.id)
  const [fit, setFit] = useState<Fit | null>(null)
  const facts = buildFacts(job)
  const o = job.offer
  const subtitle = [job.company, job.locationText].filter(Boolean).join(" · ")

  // Con el perfil de búsqueda de la persona se calcula el encaje de esta oferta (reglas, sin IA).
  const profileCv = useSearchProfile()?.cv ?? null
  useEffect(() => {
    if (!profileCv) return
    let alive = true
    fetch(`/api/jobs/${job.id}/fit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cv: profileCv }) })
      .then(async (r) => {
        if (!r.ok || !alive) return
        const f = await r.json()
        if (typeof f.score === "number") setFit(f)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [job.id, profileCv])

  const covered = new Set([...(fit?.covered ?? []), ...(fit?.related ?? [])].map((x) => x.toLowerCase()))
  const apply = job.apply
  const isMail = apply?.method === "correo"
  const external = apply?.url ?? (job.sourceUrl.startsWith("http") ? job.sourceUrl : undefined)

  const save = () => {
    const now = toggleSaved(job.id)
    track("save", { jobId: job.id, saved: now })
    toast.success(now ? "Guardada: la verás con «Solo mis guardadas»" : "Quitada de tus guardadas")
  }

  const notInterested = () => {
    dismissJob(job.id)
    track("dismiss", { jobId: job.id })
    toast.success("Listo: no te la mostraremos más")
    router.push("/ofertas")
  }

  const adapt = () => {
    track("adapt_cv", { jobId: job.id })
    if (!savePrefill(job.offer, { location: job.locationText, remoteScope: job.remoteScope })) {
      toast.error("Tu navegador no permite guardar la oferta para continuar. Cópiala a mano en el paso «Oferta».")
      return
    }
    router.push("/")
  }

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: job.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success("Enlace copiado")
      }
    } catch {
      /* la persona canceló */
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-6 sm:px-6">
      <header className="flex items-center justify-between gap-2">
        <Link href="/ofertas" className={buttonVariants({ variant: "ghost", size: "sm", className: "text-muted-foreground" })}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden /> Resultados
        </Link>
        <div className="flex items-center">
          <Link href="/" aria-label="Ir a Sooosh" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <Logo className="size-5" />
          </Link>
          <Button variant="ghost" size="icon" aria-label="Compartir esta oferta" onClick={() => void share()}>
            <LinkIcon aria-hidden />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-col items-start gap-1">
        {job.isNew && <NewBadge />}
        <h1 className="text-lg font-medium">{job.title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        {job.remoteScope && <p className="text-sm text-muted-foreground">{job.remoteScope}</p>}
      </div>

      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-y border-border/40 py-4 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.key} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="text-sm">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <section className="flex items-start gap-3" aria-label="Cómo se postula">
        <ApplyIcon method={apply?.method} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">{applyLabel(apply)}</p>
          <p className="text-sm text-muted-foreground">{applyHint(apply)}</p>
        </div>
      </section>

      {fit && profileCv && (
        <section className="flex flex-col gap-2" aria-label="Encaje con tu CV">
          <h2 className="text-sm font-medium">Encaje con tu CV: {fit.score} %</h2>
          {fit.missing.length > 0 ? (
            <p className="text-sm text-muted-foreground">Tu CV no muestra: {fit.missing.join(", ")}. Si lo tienes, agrégalo al adaptar el CV.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Tu CV cubre lo que pide esta oferta.</p>
          )}
          <p className="text-xs text-muted-foreground">Estimación con reglas (sin IA): solo cuenta lo que tu CV dice.</p>
        </section>
      )}

      {job.skills.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Habilidades">
          <h2 className="text-sm font-medium">Habilidades</h2>
          <ul className="flex flex-wrap gap-2">
            {job.skills.map((s) => {
              const has = !!profileCv && covered.has(s.toLowerCase())
              return (
                <li key={s}>
                  <Badge variant={has ? "default" : "secondary"}>
                    {has && <CheckIcon data-icon="inline-start" aria-hidden />}
                    {s}
                    {has && <span className="sr-only"> (tu CV lo muestra)</span>}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <List title="Qué harás" items={o.responsibilities} />
      <List title="Qué piden" items={o.requirements} />
      <List title="Se valora" items={o.niceToHave} />

      <p className="text-xs text-muted-foreground">
        Fuente: {job.sourceName === "manual" ? "cargada por el equipo de Sooosh" : job.sourceName}
        {job.sourceUrl.startsWith("http") && (
          <>
            {" · "}
            <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              ver la publicación original
            </a>
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" onClick={save} aria-pressed={isSaved}>
          <BookmarkIcon data-icon="inline-start" aria-hidden /> {isSaved ? "Guardada" : "Guardar"}
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={notInterested}>
          No me interesa
        </Button>
        <PrivacyLink className="ml-auto text-muted-foreground" />
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-border/40 bg-background px-4 py-3 sm:mx-0 sm:flex-row-reverse sm:px-0">
        {external && (
          <a href={external} onClick={() => track("apply_click", { jobId: job.id, method: apply?.method ?? "desconocido" })} {...(isMail ? {} : { target: "_blank", rel: "noopener noreferrer" })} className={buttonVariants({ className: "sm:flex-1" })}>
            {applyCta(apply)}
          </a>
        )}
        <Button variant="outline" className="sm:flex-1" onClick={adapt}>
          Adaptar mi CV a esta oferta
        </Button>
      </div>
    </div>
  )
}
