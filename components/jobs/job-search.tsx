"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { FileUpIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react"
import { useAutoAnimate } from "@formkit/auto-animate/react"
import { Logo } from "@/components/brand/logo"
import { BeamBadge } from "@/components/magic/beam-badge"
import { DrumNumber } from "@/components/magic/digit-drum"
import { LoadingState } from "@/components/ai/loading-state"
import { BlurReveal } from "@/components/motion/blur-reveal"
import { Rise } from "@/components/motion/rise"
import { token } from "@/lib/design-tokens"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConsentBanner } from "@/components/privacy/consent-banner"
import { PrivacyLink } from "@/components/privacy/privacy-dialog"
import { JobCard } from "@/components/jobs/job-card"
import { ResponsiveSheet } from "@/components/jobs/responsive-sheet"
import { AREA_LABEL, MODE_LABEL, SearchFiltersSheet } from "@/components/jobs/search-filters-sheet"
import { SearchProfilePanel } from "@/components/jobs/search-profile-panel"
import { SourcesStatus } from "@/components/jobs/sources-status"
import { markFirstSearch, shouldAsk, track, useConsent } from "@/lib/events/consent"
import { useMarks } from "@/lib/profile/job-marks"
import { getFilters, type SavedFilters } from "@/lib/profile/saved-filters"
import { useSearchProfile } from "@/lib/profile/search-profile"
import { REGION_OPTIONS } from "@/lib/jobs/geo"
import { ALL_REGIONS, defaultRegion, isRegion } from "@/lib/jobs/region"
import type { RankedJob } from "@/lib/jobs/rank"

// Frases del cargador de resultados: cuentan, sin tecnicismos, lo que hace la plataforma mientras llegan las ofertas.
const SEARCH_MESSAGES = ["Buscando entre las ofertas…", "Revisando las fuentes más recientes…", "Ordenando los resultados…", "Preparando las tarjetas…"]

const REGION_KEY = "sooosh:region"
const AREA_KEY = "sooosh:area"
type Area = "tecnologia" | "todas"
type Sort = "relevancia" | "recientes" | "encaje"

/** Región inicial: la que la persona eligió antes o, si no, la deducida de su zona horaria e idioma (sin pedir permiso de ubicación). */
function initialRegion(): string {
  try {
    const saved = localStorage.getItem(REGION_KEY)
    if (saved && isRegion(saved)) return saved
  } catch {
    /* sin almacenamiento */
  }
  return defaultRegion(navigator.language, Intl.DateTimeFormat().resolvedOptions().timeZone)
}

/**
 * Buscador público de ofertas: región (detectada, editable), texto libre (sin tildes y por significado), modalidad y orden.
 * Si hay un CV en este equipo, cada oferta muestra cuánto encaja (reglas, sin IA).
 */
export function JobSearch() {
  const [region, setRegion] = useState<string | null>(null)
  // Búsqueda en vivo en dos tiempos: `fast` (solo texto, ~200 ms tras la última tecla) y completa (suma el significado, tras una pausa o con Enter).
  const [search, setSearch] = useState<{ q: string; fast: boolean }>({ q: "", fast: false })
  const { q, fast } = search
  const [typed, setTyped] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Total de ofertas que cumplen los filtros y el texto (el número del distintivo inferior).
  const [total, setTotal] = useState<number | null>(null)
  // Antes de que la persona busque o cambie un filtro, el distintivo muestra el total de TODA la plataforma.
  const [platformTotal, setPlatformTotal] = useState<number | null | "error">(null)
  const [filtersTouched, setFiltersTouched] = useState(false)
  const [cvOpen, setCvOpen] = useState(false)
  const [settled, setSettled] = useState("") // clave de la última petición terminada: mientras no coincida con la actual, se está buscando
  const [mode, setMode] = useState("")
  const [area, setArea] = useState<Area>("tecnologia") // el buscador abre en Tecnología
  const [onlyMatches, setOnlyMatches] = useState(false)
  const [onlySaved, setOnlySaved] = useState(false)
  const [trending, setTrending] = useState<{ q: string; users: number }[]>([])
  const consent = useConsent()
  const marks = useMarks()
  const anonId = consent.personal ? consent.anonId : null
  const [sort, setSort] = useState<Sort>("relevancia")
  const cv = useSearchProfile()?.cv ?? null
  const [jobs, setJobs] = useState<RankedJob[] | null>(null)
  const [error, setError] = useState("")
  // Altas, bajas y cambios de orden de la lista (búsqueda en vivo, descartar una oferta) se animan solos; respeta «reducir movimiento».
  const [listRef] = useAutoAnimate({ duration: 180, easing: "ease-out" })

  // La región depende del navegador: se lee después de montar (en el servidor no existe).
  useEffect(() => {
    let alive = true
    Promise.resolve().then(() => {
      if (!alive) return
      setRegion(initialRegion())
      try {
        const a = localStorage.getItem(AREA_KEY)
        if (a === "todas" || a === "tecnologia") setArea(a)
      } catch {
        /* sin almacenamiento */
      }
      // «Aplicar mis filtros al abrir»: lo guardado manda sobre la región y el área recordadas por separado.
      const mine = getFilters()
      if (mine?.auto) {
        setRegion(mine.region)
        setArea(mine.area)
        setMode(mine.mode)
        setSort(mine.sort)
        setOnlyMatches(mine.onlyMatches)
      }
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const text = typed.trim()
    if (text === "") {
      const t = setTimeout(() => setSearch({ q: "", fast: false }), 0)
      return () => clearTimeout(t)
    }
    // Con 2+ letras aparecen resultados de texto casi al instante; la búsqueda por significado llega tras una pausa.
    const quick = text.length >= 2 ? setTimeout(() => setSearch((s) => (s.q === text && !s.fast ? s : { q: text, fast: true })), 200) : null
    const full = setTimeout(() => setSearch({ q: text, fast: false }), 700)
    return () => {
      if (quick) clearTimeout(quick)
      clearTimeout(full)
    }
  }, [typed])

  useEffect(() => {
    let alive = true
    fetch("/api/jobs/count")
      .then((r) => r.json())
      .then((d: { total?: number }) => alive && setPlatformTotal(typeof d.total === "number" ? d.total : "error"))
      .catch(() => alive && setPlatformTotal("error"))
    return () => {
      alive = false
    }
  }, [])

  // Enter confirma ya la búsqueda completa (sin esperar la pausa).
  const commit = () => setSearch({ q: typed.trim(), fast: false })

  const effectiveSort: Sort = sort === "encaje" && !cv ? "relevancia" : sort
  const requestKey = [region, q, fast, mode, area, effectiveSort, onlyMatches, !!cv, onlySaved, marks.saved.join(",")].join("|")
  const loading = region !== null && settled !== requestKey

  useEffect(() => {
    if (region === null) return
    const ctrl = new AbortController()
    fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region, q: q || undefined, fast: fast || undefined, mode: mode || undefined, area, sort: effectiveSort, onlyMatches: !!cv && onlyMatches, cv: cv ?? undefined, anonId: anonId ?? undefined, savedIds: onlySaved ? marks.saved : undefined }),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? "No se pudo buscar.")
        setJobs(d.jobs)
        setSettled(requestKey)
        setTotal(typeof d.total === "number" ? d.total : d.jobs.length)
        if (!onlySaved && !fast) {
          // Solo la búsqueda completa cuenta como búsqueda (no cada tecla). Medición (solo con consentimiento; `track` no hace nada si no lo hay) y primera búsqueda para pedir el permiso.
          markFirstSearch()
          track("search", { region, area, mode: (mode || null) as "remoto" | "hibrido" | "presencial" | null, sort: effectiveSort, onlyMatches: !!cv && onlyMatches, q: q || null, results: d.jobs.length })
          if (d.jobs.length > 0) track("impressions", { jobIds: d.jobs.slice(0, 60).map((j: { id: string }) => j.id) })
        }
        setError("")
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") {
          setError(e.message)
          setSettled(requestKey)
        }
      })
    return () => ctrl.abort()
  }, [region, q, fast, mode, area, effectiveSort, onlyMatches, cv, anonId, onlySaved, marks.saved, requestKey])

  // Búsquedas populares de la región (solo las que hicieron 5 o más personas distintas que aceptaron «Para todos»; casi siempre vacío al inicio).
  useEffect(() => {
    if (!region || region === ALL_REGIONS) return
    let alive = true
    fetch(`/api/trending?region=${encodeURIComponent(region)}`)
      .then((r) => r.json())
      .then((d: { searches?: { q: string; users: number }[] }) => alive && setTrending(d.searches ?? []))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [region])

  const changeArea = (v: Area) => {
    setArea(v)
    try {
      localStorage.setItem(AREA_KEY, v)
    } catch {
      /* sin almacenamiento */
    }
  }

  const changeRegion = (v: string) => {
    setRegion(v)
    try {
      localStorage.setItem(REGION_KEY, v)
    } catch {
      /* sin almacenamiento */
    }
  }

  const applyFilters = (f: Omit<SavedFilters, "auto">) => {
    changeRegion(f.region)
    changeArea(f.area)
    setMode(f.mode)
    setSort(f.sort)
    setOnlyMatches(f.onlyMatches)
  }

  // Sin texto ni filtros tocados: total de la plataforma (si no se pudo contar, el de la lista). Después: el de lo que se ve.
  const untouched = typed.trim() === "" && !filtersTouched
  const shown = untouched ? (typeof platformTotal === "number" ? platformTotal : platformTotal === "error" ? total : null) : total

  const regionName = useMemo(() => (region === ALL_REGIONS ? "Todas las regiones" : (REGION_OPTIONS.find((r) => r.code === region)?.name ?? "")), [region])
  // Resumen de lo que está activo (la pantalla no muestra los filtros, solo esta línea) y cuántos difieren del arranque.
  const summary = [AREA_LABEL[area], regionName, mode ? MODE_LABEL[mode] : null, onlySaved ? "Guardadas" : null, cv && onlyMatches ? "Solo match" : null].filter(Boolean).join(" · ")
  const activeFilters = (mode ? 1 : 0) + (onlySaved ? 1 : 0) + (cv && onlyMatches ? 1 : 0) + (area !== "tecnologia" ? 1 : 0) + (sort !== "relevancia" ? 1 : 0)

  return (
    <div className="relative flex min-h-dvh w-full flex-col">
      {/* Cabecera igual a la de inicio, pegada arriba y por encima del contenido (el título queda centrado en la pantalla). */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium">
          <Logo className="size-5" />
          Sooosh
        </Link>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" aria-label={cv ? "Mi CV (cargado)" : "Subir mi CV"} className="relative" onClick={() => setCvOpen(true)}>
            <FileUpIcon aria-hidden />
            {cv && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-primary" aria-hidden />}
          </Button>
          <SourcesStatus />
          <ThemeToggle />
        </div>
      </header>

      <main id="contenido" className="flex flex-1 flex-col">
        {/* Portada: título, subtítulo y buscador, bajados hacia el centro de la pantalla; las ofertas empiezan justo debajo y se ven desde el inicio. */}
        <section className="flex flex-col items-center gap-8 px-4 pt-28 pb-6 text-center sm:px-6 sm:pt-40">
          <Rise className={token("hero-stack")}>
            <h1 className={token("hero-title")}>Tu próximo trabajo, más cerca</h1>
            <p className={`max-w-xl ${token("hero-subtitle")}`}>Juntamos ofertas de muchas empresas y portales en un solo lugar, las actualizamos varias veces al día y te mostramos cómo postular a cada una.</p>
          </Rise>

          <Rise step={1} className="flex w-full max-w-2xl flex-col items-center gap-2">
            <div className="relative w-full">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="buscar"
                type="search"
                aria-label="Buscar ofertas"
                className="h-13 pr-16 pl-12 text-base"
                placeholder="Cargo, empresa o habilidad"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commit()}
                enterKeyHint="search"
              />
              <Button variant="ghost" size="icon" aria-label={activeFilters > 0 ? `Filtros (${activeFilters} activos)` : "Filtros"} className="absolute top-1/2 right-2.5 -translate-y-1/2" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontalIcon aria-hidden />
                {activeFilters > 0 && (
                  <Badge className="absolute -top-1 -right-1 size-4 justify-center px-0 text-xs" aria-hidden>
                    {activeFilters}
                  </Badge>
                )}
              </Button>
            </div>
            <button type="button" onClick={() => setFiltersOpen(true)} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              {region === null ? "…" : summary}
            </button>
            {trending.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2" aria-label="Búsquedas populares">
                {trending.map((t) => (
                  <Button key={t.q} variant="secondary" size="sm" onClick={() => setTyped(t.q)}>
                    {t.q}
                  </Button>
                ))}
              </div>
            )}
          </Rise>
        </section>

        <div className={`mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-28 sm:px-6 ${shouldAsk(consent) ? "pb-72" : ""}`}>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <section aria-label="Resultados" aria-live="polite" aria-busy={loading} className={`flex flex-col transition-opacity duration-150 ${loading && jobs ? "opacity-60" : "opacity-100"}`}>
          {jobs === null && !error ? (
            <div className="mx-auto w-full max-w-2xl">
              <LoadingState className="justify-start py-2" messages={SEARCH_MESSAGES} />
            </div>
          ) : jobs && jobs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin resultados. Prueba otras palabras o ajusta los filtros.</p>
          ) : (
            <Rise step={1}>
              <ul ref={listRef} className="flex flex-col gap-3">
                {jobs
                  ?.filter((j) => onlySaved || !marks.dismissed.includes(j.id))
                  .map((j, i) => (
                    <JobCard
                      key={j.id}
                      job={j}
                      saved={marks.saved.includes(j.id)}
                      onOpen={() => track("open", { jobId: j.id, position: i, score: j.fit?.score ?? null, match: j.fit ? j.fit.match : null })}
                    />
                  ))}
              </ul>
              {cv && <p className="pt-3 text-xs text-muted-foreground">Encaje estimado con reglas, sin IA.</p>}
            </Rise>
          )}
        </section>

        {/* «Privacidad» y el distintivo aparecen solo cuando ya hay resultados a la vista. */}
        <BlurReveal show={jobs !== null} className="flex justify-center pt-2">
          <PrivacyLink />
        </BlurReveal>
        </div>
      </main>

      {/* Distintivo inferior: cuántas ofertas cumplen lo que se ve ahora (cambia con cada búsqueda o filtro). */}
      <BlurReveal show={shown !== null && jobs !== null} className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center px-4">
        <div role="status" aria-live="polite">
          <BeamBadge>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <DrumNumber value={shown ?? 0} className="font-medium" />
              <span className="text-muted-foreground">{shown === 1 ? "Oferta encontrada" : "Ofertas encontradas"}</span>
            </span>
          </BeamBadge>
        </div>
      </BlurReveal>

      {region !== null && (
        <SearchFiltersSheet
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          values={{ region, area, mode: mode as SavedFilters["mode"], sort, onlyMatches, onlySaved }}
          hasCv={!!cv}
          savedCount={marks.saved.length}
          onChange={(patch) => {
            setFiltersTouched(true)
            if (patch.region !== undefined) changeRegion(patch.region)
            if (patch.area !== undefined) changeArea(patch.area)
            if (patch.mode !== undefined) setMode(patch.mode)
            if (patch.sort !== undefined) setSort(patch.sort)
            if (patch.onlyMatches !== undefined) setOnlyMatches(patch.onlyMatches)
            if (patch.onlySaved !== undefined) setOnlySaved(patch.onlySaved)
          }}
          onApplySaved={(f) => {
            setFiltersTouched(true)
            applyFilters(f)
          }}
        />
      )}

      <ResponsiveSheet open={cvOpen} onOpenChange={setCvOpen}>
        {({ Header, Title }) => (
          <>
            <Header className="text-left">
              <Title className="text-lg">Mi CV</Title>
            </Header>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <SearchProfilePanel />
            </div>
          </>
        )}
      </ResponsiveSheet>
      <ConsentBanner />
    </div>
  )
}
