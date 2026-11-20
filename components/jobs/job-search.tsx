"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { SearchIcon } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { ConsentBanner } from "@/components/privacy/consent-banner"
import { PrivacyLink } from "@/components/privacy/privacy-dialog"
import { JobCard } from "@/components/jobs/job-card"
import { SearchProfilePanel } from "@/components/jobs/search-profile-panel"
import { markFirstSearch, shouldAsk, track, useConsent } from "@/lib/events/consent"
import { useMarks } from "@/lib/profile/job-marks"
import { useSearchProfile } from "@/lib/profile/search-profile"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { MATCH_MIN } from "@/lib/jobs/match"
import { REGION_OPTIONS } from "@/lib/jobs/geo"
import { ALL_REGIONS, defaultRegion, isRegion } from "@/lib/jobs/region"
import type { RankedJob } from "@/lib/jobs/rank"

const REGION_KEY = "sooosh:region"
const AREA_KEY = "sooosh:area"
type Area = "tecnologia" | "todas"
const MODE: Record<string, string> = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" }
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
  const [q, setQ] = useState("")
  const [typed, setTyped] = useState("")
  const [mode, setMode] = useState("")
  const [area, setArea] = useState<Area>("tecnologia") // el buscador abre en Tecnología
  const [onlyMatches, setOnlyMatches] = useState(false)
  const [onlySaved, setOnlySaved] = useState(false)
  const [trending, setTrending] = useState<{ q: string; users: number }[]>([])
  const consent = useConsent()
  const marks = useMarks()
  const anonId = consent.personal ? consent.anonId : null
  const [meta, setMeta] = useState<{ matches: number | null; scored: number | null }>({ matches: null, scored: null })
  const [sort, setSort] = useState<Sort>("relevancia")
  const cv = useSearchProfile()?.cv ?? null
  const [jobs, setJobs] = useState<RankedJob[] | null>(null)
  const [error, setError] = useState("")

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
    })
    return () => {
      alive = false
    }
  }, [])

  // El texto se envía 350 ms después de la última tecla.
  useEffect(() => {
    const t = setTimeout(() => setQ(typed.trim()), 350)
    return () => clearTimeout(t)
  }, [typed])

  const effectiveSort: Sort = sort === "encaje" && !cv ? "relevancia" : sort

  useEffect(() => {
    if (region === null) return
    const ctrl = new AbortController()
    fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region, q: q || undefined, mode: mode || undefined, area, sort: effectiveSort, onlyMatches: !!cv && onlyMatches, cv: cv ?? undefined, anonId: anonId ?? undefined, savedIds: onlySaved ? marks.saved : undefined }),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? "No se pudo buscar.")
        setJobs(d.jobs)
        if (!onlySaved) {
          // Medición (solo con consentimiento; `track` no hace nada si no lo hay) y primera búsqueda para pedir el permiso.
          markFirstSearch()
          track("search", { region, area, mode: (mode || null) as "remoto" | "hibrido" | "presencial" | null, sort: effectiveSort, onlyMatches: !!cv && onlyMatches, q: q || null, results: d.jobs.length })
          if (d.jobs.length > 0) track("impressions", { jobIds: d.jobs.slice(0, 60).map((j: { id: string }) => j.id) })
        }
        setMeta({ matches: d.matches ?? null, scored: d.scored ?? null })
        setError("")
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message)
      })
    return () => ctrl.abort()
  }, [region, q, mode, area, effectiveSort, onlyMatches, cv, anonId, onlySaved, marks.saved])

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

  const regionName = useMemo(() => (region === ALL_REGIONS ? "todas las regiones" : (REGION_OPTIONS.find((r) => r.code === region)?.name ?? "")), [region])

  return (
    <div className={`mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 ${shouldAsk(consent) ? "pb-72" : ""}`}>
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium">
          <Logo className="size-5" />
          Sooosh
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Buscar ofertas</h1>
        <p className="text-sm text-muted-foreground">
          {region === null ? "Detectando tu región…" : `Mostrando ofertas para ${regionName}. Cámbiala cuando quieras.`}
        </p>
      </div>

      <SearchProfilePanel />

      <Field>
        <FieldLabel htmlFor="buscar">Qué buscas</FieldLabel>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="buscar" type="search" className="pl-9" placeholder="Cargo, empresa o habilidad (p. ej. diseñador UX, SQL)" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
      </Field>

      {trending.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Búsquedas populares">
          <span className="text-xs text-muted-foreground">Populares:</span>
          {trending.map((t) => (
            <Button key={t.q} variant="secondary" size="sm" onClick={() => setTyped(t.q)}>
              {t.q}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field>
          <FieldLabel htmlFor="area">Área</FieldLabel>
          <NativeSelect id="area" className="w-full" value={area} onChange={(e) => changeArea(e.target.value as Area)}>
            <NativeSelectOption value="tecnologia">Tecnología</NativeSelectOption>
            <NativeSelectOption value="todas">Todas las áreas</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="region">Región</FieldLabel>
          <NativeSelect id="region" className="w-full" value={region ?? ALL_REGIONS} onChange={(e) => changeRegion(e.target.value)} disabled={region === null}>
            <NativeSelectOption value={ALL_REGIONS}>Todas las regiones</NativeSelectOption>
            {REGION_OPTIONS.map((r) => (
              <NativeSelectOption key={r.code} value={r.code}>
                {r.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="modalidad">Modalidad</FieldLabel>
          <NativeSelect id="modalidad" className="w-full" value={mode} onChange={(e) => setMode(e.target.value)}>
            <NativeSelectOption value="">Todas</NativeSelectOption>
            {Object.entries(MODE).map(([k, v]) => (
              <NativeSelectOption key={k} value={k}>
                {v}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="orden">Ordenar por</FieldLabel>
          <NativeSelect id="orden" className="w-full" value={effectiveSort} onChange={(e) => setSort(e.target.value as Sort)}>
            <NativeSelectOption value="relevancia">Relevancia</NativeSelectOption>
            <NativeSelectOption value="recientes">Más recientes</NativeSelectOption>
            <NativeSelectOption value="encaje" disabled={!cv}>
              {cv ? "Encaje con mi CV" : "Encaje con mi CV (sube tu CV arriba)"}
            </NativeSelectOption>
          </NativeSelect>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3">
        <label htmlFor="solo-match" className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">Solo los que hacen match</span>
          <span className="text-xs text-muted-foreground">{cv ? `Encaje de ${MATCH_MIN} % o más con tu CV.` : "Sube tu CV arriba para activarlo."}</span>
        </label>
        <Switch id="solo-match" checked={!!cv && onlyMatches} disabled={!cv} onCheckedChange={setOnlyMatches} />
      </div>

      {marks.saved.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="solo-guardadas" className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium">Solo mis guardadas</span>
            <span className="text-xs text-muted-foreground">
              {marks.saved.length} {marks.saved.length === 1 ? "oferta guardada" : "ofertas guardadas"} en este navegador.
            </span>
          </label>
          <Switch id="solo-guardadas" checked={onlySaved} onCheckedChange={setOnlySaved} />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <section aria-label="Resultados" aria-live="polite" className="flex flex-col">
        {jobs === null && !error ? (
          <div className="flex flex-col gap-4" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2 py-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : jobs && jobs.length === 0 ? (
          <div className="flex flex-col gap-1 py-8">
            <p className="text-sm font-medium">No encontramos ofertas con esos filtros.</p>
            <p className="text-sm text-muted-foreground">Prueba con otra región, otra área, sin la modalidad o con otras palabras{cv && onlyMatches ? ", o desactiva «Solo los que hacen match»" : ""}.</p>
          </div>
        ) : (
          <>
            <p className="pb-2 text-xs text-muted-foreground">
              {jobs?.length} {jobs?.length === 1 ? "oferta" : "ofertas"}
              {meta.matches !== null && meta.scored !== null && ` · ${meta.matches} ${meta.matches === 1 ? "hace" : "hacen"} match entre las ${meta.scored} mejores candidatas`}
            </p>
            <ul className="flex flex-col gap-3">
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
            {cv && <p className="pt-3 text-xs text-muted-foreground">El encaje es una estimación con reglas (sin IA) de cuánto de lo que pide la oferta muestra tu CV.</p>}
          </>
        )}
      </section>


      <footer className="flex justify-center pt-2">
        <PrivacyLink />
      </footer>
      <ConsentBanner />
    </div>
  )
}
