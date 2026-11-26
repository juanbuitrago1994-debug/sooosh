"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, BookmarkIcon, CheckIcon, LinkIcon } from "lucide-react"
import { toast } from "sonner"
import { ApplyIcon } from "@/components/jobs/apply-icon"
import { CuratedBadge } from "@/components/magic/curated-badge"
import { NewBadge } from "@/components/jobs/new-badge"
import { Rise } from "@/components/motion/rise"
import { AccountMenu } from "@/components/auth/account-menu"
import { Logo } from "@/components/brand/logo"
import { PrivacyLink } from "@/components/privacy/privacy-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { CvRepository } from "@/components/history/cv-repository"
import { ApplyEmailPanel } from "@/components/jobs/apply-email-panel"
import { applyChannels, applyCta, applyHint, applyLabel, channelHref, emailsOf } from "@/lib/jobs/apply"
import { buildFacts, companyLine, curatedDates } from "@/lib/jobs/facts"
import { offerToText, savePrefill } from "@/lib/jobs/prefill"
import { TailoredAts } from "@/components/steps/tailored-ats"
import { saveAtsEntry } from "@/lib/ats/save-entry"
import { track } from "@/lib/events/consent"
import { saveJobOffer, unsaveJobOffer } from "@/app/mis-ofertas/actions"
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
  const [mailOpen, setMailOpen] = useState(false)
  const facts = buildFacts(job)
  const o = job.offer
  const subtitle = [companyLine(job), job.locationText].filter(Boolean).join(" · ")

  // Con el perfil de búsqueda de la persona se calcula el encaje de esta oferta (reglas, sin IA).
  const profile = useSearchProfile()
  const profileCv = profile?.cv ?? null
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
  const others = applyChannels(apply).slice(1)
  const mailTo = emailsOf(apply)
  const openMail = () => {
    track("apply_click", { jobId: job.id, method: "correo" })
    setMailOpen(true)
  }

  const save = () => {
    const now = toggleSaved(job.id)
    track("save", { jobId: job.id, saved: now })
    toast.success(now ? "Guardada en «Mis ofertas»: vigilamos si sigue abierta" : "Quitada de tus guardadas")
    // También en la cuenta: copia completa de la oferta, con seguimiento. Si falla, la marca local queda y se reintenta al volver a entrar.
    void (now ? saveJobOffer(job.id) : unsaveJobOffer(job.id)).then((r) => {
      if (typeof r === "object" && !r.ok && r.reason === "limit") toast.error("Llegaste al máximo de ofertas guardadas. Quita alguna en «Mis ofertas».")
    })
  }

  const notInterested = () => {
    dismissJob(job.id)
    void unsaveJobOffer(job.id)
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
    <div className="flex min-h-dvh w-full flex-col">
      {/* Cabecera igual a la de inicio y búsqueda: atrás y marca a la izquierda, acciones a la derecha, pegadas arriba. */}
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1">
          <Link href="/ofertas" aria-label="Volver a los resultados" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ArrowLeftIcon aria-hidden />
          </Link>
          <Link href="/" className="flex items-center gap-2 px-1 text-sm font-medium">
            <Logo className="size-5" />
            Sooosh
          </Link>
        </div>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" aria-label={isSaved ? "Quitar de guardadas" : "Guardar oferta"} aria-pressed={isSaved} onClick={save}>
            <BookmarkIcon key={String(isSaved)} className={isSaved ? "fill-current motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-200" : undefined} aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Compartir esta oferta" onClick={() => void share()}>
            <LinkIcon aria-hidden />
          </Button>
          <CvRepository />
          <AccountMenu />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-4 sm:px-6">
        <Rise className="flex flex-col items-start gap-1">
          {(job.isNew || job.origin === "manual") && (
            <div className="flex flex-wrap items-center gap-2">
              {job.origin === "manual" && <CuratedBadge />}
              {job.isNew && <NewBadge />}
            </div>
          )}
          <h1 className="text-lg font-medium">{job.title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {job.remoteScope && <p className="text-sm text-muted-foreground">{job.remoteScope}</p>}
          {job.origin === "manual" && (
            <p className="text-xs text-muted-foreground">{curatedDates(job)}</p>
          )}
        </Rise>

        <Rise step={1} className="flex flex-col gap-6">
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
              {others.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">También puedes postular así:</p>
                  <ul className="flex flex-wrap gap-2">
                    {others.map((c) => (
                      <li key={`${c.method}-${c.email ?? c.url}`}>
                        {c.method === "correo" ? (
                          <Button variant="outline" size="sm" onClick={openMail}>
                            Por correo a {c.email}
                          </Button>
                        ) : (
                          <a
                            href={channelHref(c)}
                            onClick={() => track("apply_click", { jobId: job.id, method: c.method })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            {applyCta(c)}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </Rise>

        <Rise step={2} className="flex flex-col gap-6">
          {fit && profileCv && (
            <section className="flex flex-col gap-1.5" aria-label="Encaje con tu CV">
              <h2 className="text-sm font-medium">Encaje con tu CV: {fit.score} %</h2>
              <p className="text-sm text-muted-foreground">{fit.missing.length > 0 ? `Tu CV no muestra: ${fit.missing.join(", ")}.` : "Tu CV cubre lo que pide."}</p>
              <p className="text-xs text-muted-foreground">Estimado con reglas, sin IA.</p>
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
            Fuente: {job.sourceName === "manual" ? "Sooosh" : job.sourceName}
            {job.sourceUrl.startsWith("http") && (
              <>
                {" · "}
                <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  ver publicación original
                </a>
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-1">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={notInterested}>
              No me interesa
            </Button>
            <PrivacyLink className="ml-auto text-muted-foreground" />
          </div>
        </Rise>

        {/* CV en formato ATS para ESTA oferta, a partir del CV validado; queda guardado en «Tus CV por oferta». */}
        {profile ? (
          <>
            <TailoredAts
              cv={profile.cv}
              offer={job.offer}
              sourceText={profile.sourceText}
              extras={profile.extras ?? null}
              onGenerated={(r) => saveAtsEntry({ offer: job.offer, offerText: offerToText(job.offer, { location: job.locationText, remoteScope: job.remoteScope }), originalCv: profile.cv, tailored: r })}
            />
            {!profile.validatedAt && <p className="text-xs text-muted-foreground">Tu CV aún no está validado: valídalo desde el inicio para que este CV use los datos que confirmaste.</p>}
          </>
        ) : null}

        <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2 border-t border-border/40 bg-background px-4 py-3 sm:mx-0 sm:flex-row-reverse sm:px-0">
          {isMail && mailTo.length > 0 ? (
            <Button className="sm:flex-1" onClick={openMail}>
              {applyCta(apply)}
            </Button>
          ) : external && (
            <a href={external} onClick={() => track("apply_click", { jobId: job.id, method: apply?.method ?? "desconocido" })} {...(isMail ? {} : { target: "_blank", rel: "noopener noreferrer" })} className={buttonVariants({ className: "sm:flex-1" })}>
              {applyCta(apply)}
            </a>
          )}
          <Button variant="outline" className="sm:flex-1" onClick={adapt}>
            Adaptar mi CV
          </Button>
        </div>
      </main>
      {mailTo.length > 0 && <ApplyEmailPanel open={mailOpen} onOpenChange={setMailOpen} job={{ title: job.title, company: job.company, sourceName: job.sourceName }} emails={mailTo} subject={apply?.subject} covered={fit?.covered ?? []} requirements={o.requirements} asks={apply?.asks} offerLanguage={o.language} />}
    </div>
  )
}
