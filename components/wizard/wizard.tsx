"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { ArrowLeftIcon } from "lucide-react"
import { toast } from "sonner"
import { AiStage } from "@/components/ai/ai-stage"
import { AiWorkProvider, useAiWork } from "@/components/ai/ai-work"
import { StepTransition } from "@/components/ai/step-transition"
import { Button } from "@/components/ui/button"
import { clearPrefill, readPrefill } from "@/lib/jobs/prefill"
import { AppHeader, SkipLink } from "./app-header"
import { LearningDialog } from "@/components/learning/learning-dialog"
import { styleSentence } from "@/components/cv/diagnosis-card"
import { StepDots } from "./step-dots"
import { StepProfile, type ProfileData, type ProfilePhase } from "@/components/steps/step-profile"
import { StepExport } from "@/components/steps/step-export"
import { pendingCount, reviewKey, reviewReady, StepReview, type ReviewState } from "@/components/steps/step-review"
import { matchReady, StepAnalysis, type MatchState } from "@/components/steps/step-analysis"
import { emptyOffer, offerReady, StepOffer, type OfferState } from "@/components/steps/step-offer"
import { freezeSource, guardCorpus } from "@/lib/cv/source"
import { addEntry, parseHistory, readRaw, type HistoryEntry } from "@/lib/history"
import type { TailoredAts } from "@/lib/ats/client"
import { saveAtsEntry } from "@/lib/ats/save-entry"
import { NEW_OFFER_FLAG } from "@/components/history/cv-repository"
import { lexicalCoverage } from "@/lib/match/engine"
import { rebuildCv } from "@/lib/rebuild/build"
import { STEPS } from "@/lib/steps"
import { useSearchProfile, type SearchProfile } from "@/lib/profile/search-profile"

export function Wizard() {
  return (
    <AiWorkProvider>
      <Shell />
    </AiWorkProvider>
  )
}

/** Stage centrada con una sola tarjeta (docs/DESIGN-PATTERNS.md): un paso, una decisión, una acción primaria. */
/** El CV guardado (perfil de búsqueda) como datos del asistente: la fuente de verdad pasa a ser el CV ya corregido por la persona. */
function fromSearchProfile(p: SearchProfile): ProfileData {
  const text = p.sourceText ?? ""
  return { file: { id: p.fileId ?? "perfil", name: p.file?.name ?? p.label, type: p.file?.type ?? "", size: p.file?.size ?? 0 }, cv: p.cv, sourceText: text, source: freezeSource(text, p.cv) }
}
const noop = () => () => {}

function Shell() {
  const [step, setStep] = useState(0)
  const [learningOpen, setLearningOpen] = useState(false)
  const [profileState, setProfile] = useState<ProfileData | null>(null)
  // Solo hay UN CV: si ya hay uno guardado (se recargó la página o se volvió), el asistente parte de él en vez de pedir otro.
  const stored = useSearchProfile()
  const hydrated = useSyncExternalStore(noop, () => true, () => false)
  const fromStored = useMemo(() => (stored ? fromSearchProfile(stored) : null), [stored])
  const profile = profileState ?? fromStored
  // Si la persona llega desde el buscador con «Adaptar mi CV a esta oferta», la oferta ya viene cargada (se borra en el efecto de abajo).
  const [offer, setOffer] = useState<OfferState>(() => {
    const p = readPrefill()
    return p ? { text: p.text, offer: p.offer, analyzedText: p.text, cleaned: true, note: "Oferta cargada desde el buscador." } : emptyOffer
  })
  const [match, setMatch] = useState<MatchState | null>(null)
  const [review, setReview] = useState<ReviewState | null>(null)
  const [phaseState, setPhase] = useState<ProfilePhase>("upload")
  const phase: ProfilePhase = profile && phaseState === "upload" ? "review" : phaseState
  // Se validaron todos los datos del CV leído (paso 1): hasta entonces «Continuar» está bloqueado.
  const [validatedState, setValidated] = useState(false)
  const validated = validatedState || !!stored?.validatedAt
  const { work } = useAiWork()
  const mainRef = useRef<HTMLDivElement>(null)

  const prefilled = useRef(!!offer.note)
  useEffect(() => {
    if (!prefilled.current) return
    prefilled.current = false
    clearPrefill()
    toast.success("Oferta cargada desde el buscador. Sube tu CV para continuar.")
  }, [])

  // Precarga el modelo al abrir la app (evita pagar la carga en la primera lectura).
  useEffect(() => {
    fetch("/api/warmup", { method: "POST" }).catch(() => {})
  }, [])

  // Al cambiar de paso el foco pasa al contenido. Se compara con el valor anterior para no robar el foco al cargar
  // (StrictMode ejecuta los efectos dos veces).
  const prev = useRef(step)
  useEffect(() => {
    if (prev.current !== step) mainRef.current?.focus()
    prev.current = step
  }, [step])

  const isLast = step === STEPS.length - 1
  const isProfile = step === 0

  const goTo = (i: number) => {
    setStep(i)
    window.scrollTo({ top: 0 })
  }

  const offerValue = offerReady(offer) ? offer.offer : null
  const reviewOk = reviewReady(review, profile?.cv ?? null, offerValue)
  // CV final + informe (K6): aplica solo lo aceptado, verifica que no haya nada inventado y compara el encaje antes y después.
  const rebuilt = useMemo(
    () => (reviewOk && profile && review && offerValue ? rebuildCv({ cv: profile.cv, offer: offerValue, items: review.items, decisions: review.decisions, source: guardCorpus(profile.source, profile.cv) }) : null),
    [reviewOk, profile, review, offerValue],
  )
  const finalCv = rebuilt?.cv ?? null
  // Verificación anti-invención: contra el texto/CV ORIGINALES (inmutables) + lo que el propio usuario corrigió.
  const guard = useMemo(() => (profile ? guardCorpus(profile.source, profile.cv) : null), [profile])
  const acceptedCount = reviewOk && review ? review.items.filter((i) => i.status === "changed" && review.decisions[i.id]?.status === "accepted").length : 0

  /** ¿El paso está completo? Entonces "Continuar" es la acción primaria; si no, lo es la acción del propio paso. */
  const ready = isProfile ? phase === "review" && !!profile && validated : step === 1 ? offerReady(offer) : step === 3 ? reviewOk : step === 2 ? matchReady(match, profile?.cv ?? null, offerValue) : false
  // En la revisión, la acción primaria es decidir cada cambio; "Continuar" lo es cuando ya no quedan pendientes.
  const primaryFooter = ready && !isLast && (step !== 3 || pendingCount(review) === 0)

  /** Tras descargar el PDF: guarda la adaptación en el historial local. */
  const onExported = (lang: "es" | "en"): boolean => {
    if (!profile || !offerValue || !review || !finalCv) return false
    return !!addEntry({
      offerText: offer.text,
      offer: offerValue,
      originalCv: profile.cv,
      cv: finalCv,
      review: { items: review.items, decisions: review.decisions },
      lang,
      coverageBefore: lexicalCoverage(profile.cv, offerValue),
      coverageAfter: lexicalCoverage(finalCv, offerValue),
      acceptedChanges: acceptedCount,
    })
  }

  /** Tras generar el CV ATS de esta oferta: queda en el repositorio (uno por oferta; generarlo de nuevo reemplaza el anterior). */
  const onAtsGenerated = (r: TailoredAts) => {
    if (!profile || !offerValue || !review) return
    saveAtsEntry({ offer: offerValue, offerText: offer.text, originalCv: profile.cv, tailored: r, review: { items: review.items, decisions: review.decisions }, acceptedChanges: acceptedCount })
  }

  /** Reabre una adaptación guardada en el paso de revisión, con sus decisiones. */
  const reopen = (e: HistoryEntry) => {
    setProfile({ file: { id: "historial", name: "CV guardado en el historial", type: "", size: 0 }, cv: e.originalCv, sourceText: "", source: freezeSource("", e.originalCv) })
    setOffer({ text: e.offerText, offer: e.offer, analyzedText: e.offerText })
    setReview({ inputKey: reviewKey(e.originalCv, e.offer), items: e.review.items, decisions: e.review.decisions })
    setPhase("review")
    setValidated(true) // una adaptación guardada ya pasó por la validación
    goTo(3)
    toast.success("Adaptación reabierta. Puedes ajustar las decisiones y volver a exportar.")
  }

  // Reabrir desde otra página (el repositorio de CV por oferta enlaza a `/?reabrir=<id>`): se lee una sola vez al cargar y se limpia la dirección.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("reabrir")
    if (!id) return
    const found = parseHistory(readRaw()).find((e) => e.id === id)
    window.history.replaceState(null, "", window.location.pathname)
    if (found) window.setTimeout(() => reopen(found), 0)
    else toast.error("No encontramos esa adaptación en este navegador.")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cargar
  }, [])

  /** Otra oferta con el MISMO CV validado: se vacían la oferta, el análisis y la revisión y se vuelve al paso de la oferta. */
  const newOffer = () => {
    setOffer(emptyOffer)
    setMatch(null)
    setReview(null)
    goTo(1)
  }

  // Desde otras páginas («Nueva oferta» del repositorio enlaza a `/?nueva-oferta=1`): en cuanto el CV guardado está listo, se parte de la oferta.
  useEffect(() => {
    if (!hydrated || !profile) return
    let flag = false
    try {
      flag = sessionStorage.getItem(NEW_OFFER_FLAG) === "1"
      sessionStorage.removeItem(NEW_OFFER_FLAG)
    } catch {
      /* sin almacenamiento de sesión */
    }
    if (!flag && !new URLSearchParams(window.location.search).has("nueva-oferta")) return
    window.history.replaceState(null, "", window.location.pathname)
    window.setTimeout(newOffer, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una sola vez por CV cargado
  }, [hydrated, !!profile])

  const next = () => {
    if (isLast) toast.success("¡Listo! Si ya descargaste tu PDF, revísalo antes de enviarlo.")
    else goTo(step + 1)
  }

  // Entrada (UI v2): sin tarjeta; la pantalla completa es el degradado y la zona de soltar.
  const headerActions = { onLearning: () => setLearningOpen(true), onReopen: reopen, onNewOffer: newOffer }
  const entry = isProfile && phase !== "review"
  const dialogs = (
    <>
      <LearningDialog open={learningOpen} onOpenChange={setLearningOpen} />
    </>
  )
  // Hasta leer el CV guardado del navegador no se pinta nada (evita mostrar un instante la pantalla de subir).
  if (!hydrated) return <div className="min-h-dvh" />
  if (entry) {
    return (
      <>
        <StepProfile initial={profile} onPhase={setPhase} onChange={setProfile} entry={headerActions} validated={validated} onValidated={setValidated} />
        {dialogs}
      </>
    )
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <SkipLink />
      <AppHeader actions={headerActions} />

      <main id="contenido" ref={mainRef} tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <div className={`mx-auto w-full px-6 ${isProfile ? "flex flex-1 flex-col py-4" : "max-w-xl pt-4 pb-32"}`}>
          {!isProfile && <p className="pb-6 text-xs text-muted-foreground" aria-label={`Paso ${step + 1} de ${STEPS.length}: ${STEPS[step].label}`}>
            {step + 1} de {STEPS.length} · {STEPS[step].label}
          </p>}
          <AiStage className={isProfile ? "flex flex-1 flex-col" : undefined} innerClassName={isProfile ? "flex flex-1 flex-col" : undefined} working={!!work} messages={work?.messages ?? []} step={work?.step ?? 0} onCancel={work?.onCancel}>
            <StepTransition id={step} className={isProfile ? "flex flex-1 flex-col" : undefined}>
              {step === 0 && <StepProfile initial={profile} onPhase={setPhase} onChange={setProfile} validated={validated} onValidated={setValidated} onContinue={next} />}
              {step === 1 && <StepOffer value={offer} onChange={setOffer} />}
              {step === 2 && <StepAnalysis cv={profile?.cv ?? null} offer={offerValue} cvLanguage={profile?.diagnosis?.language} value={match} onChange={setMatch} />}
              {step === 3 && <StepReview cv={profile?.cv ?? null} guard={guard} offer={offerValue} match={matchReady(match, profile?.cv ?? null, offerValue) ? match!.result : null} style={profile?.diagnosis ? styleSentence(profile.diagnosis) : undefined} value={review} onChange={setReview} />}
              {step === 4 && <StepExport cv={finalCv} offer={offerValue} accepted={acceptedCount} report={rebuilt?.report} onExported={onExported} ats={{ sourceText: profile?.sourceText, extras: stored?.extras ?? null, onGenerated: onAtsGenerated }} />}
            </StepTransition>
          </AiStage>
        </div>
      </main>

      {!isProfile && <footer className="fixed inset-x-0 bottom-0 z-10 bg-background/60 backdrop-blur-xl">
        <div className={`mx-auto flex w-full gap-2 px-6 py-4 ${isProfile ? "max-w-4xl" : "max-w-xl"}`}>
          {step > 0 && (
            <Button variant="ghost" size="icon" onClick={() => goTo(step - 1)} aria-label="Paso anterior">
              <ArrowLeftIcon aria-hidden />
            </Button>
          )}
          {isLast && (
            <Button className="flex-1" onClick={newOffer}>
              Nueva oferta
            </Button>
          )}
          <Button className="flex-1" variant={isLast ? "outline" : primaryFooter ? "default" : "outline"} onClick={next} disabled={!ready && !isLast}>
            {isLast ? "Finalizar" : `Continuar a ${STEPS[step + 1].label}`}
          </Button>
        </div>
      </footer>}

      {dialogs}
    </div>
  )
}
