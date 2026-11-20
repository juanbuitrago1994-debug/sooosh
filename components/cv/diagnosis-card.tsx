"use client"

import { useState } from "react"
import { ChevronDownIcon, PencilIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import type { CV } from "@/lib/schemas/cv"
import type { Diagnosis } from "@/lib/schemas/diagnosis"

const LANG = { es: "Español", en: "Inglés", otro: "Otro idioma" } as const
const SENIORITY = { practicante: "Practicante", junior: "Junior", "semi-senior": "Semi-senior", senior: "Senior", lead: "Líder", directivo: "Directivo", "no-especificado": "Nivel no determinado" } as const
const PERSON = { primera: "primera persona", impersonal: "estilo impersonal", tercera: "tercera persona", mixta: "persona mixta" } as const
const TENSE = { pasado: "verbos en pasado", presente: "verbos en presente", infinitivo: "verbos en infinitivo", mixto: "tiempos mezclados" } as const
const BULLETS = { viñetas: "con viñetas", párrafos: "en párrafos", mixto: "con viñetas y párrafos", "sin-viñetas": "sin viñetas" } as const
const SECTION = { summary: "Resumen", experience: "Experiencia", education: "Educación", skills: "Habilidades", languages: "Idiomas", projects: "Proyectos", other: "Otros" } as const

/** Frase corta que resume el estilo del CV (lo que importa para reescribirlo sin cambiarle la voz). */
export function styleSentence(d: Diagnosis): string {
  const m = d.style.metrics
  const metrics = m.bulletsTotal > 0 ? `${m.bulletsWithMetrics} de ${m.bulletsTotal} viñetas con cifras` : "sin viñetas de logros"
  return `${PERSON[d.style.person][0].toUpperCase() + PERSON[d.style.person].slice(1)}, ${TENSE[d.style.tenses]}, ${BULLETS[d.style.bullets]}; ${metrics}.`
}

/**
 * Diagnóstico automático del CV, de solo lectura. Una sola acción opcional ("Corregir") y, solo si un dato clave
 * es dudoso, UNA pregunta dirigida.
 */
export function DiagnosisCard({
  cv,
  diagnosis: d,
  onAnswer,
  onCorrect,
}: {
  cv: CV
  diagnosis: Diagnosis
  onAnswer: (id: NonNullable<Diagnosis["question"]>["id"], answer: string) => void
  onCorrect: () => void
}) {
  const [text, setText] = useState("")
  const q = d.question
  const years = d.seniority.years !== null ? ` · ${String(d.seniority.years).replace(".", ",")} años` : ""
  const more = d.strengths.length > 2 || d.problems.length > 3 || d.atsRisks.length > 0 || d.sections.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-lg font-medium">{cv.header.fullName}</p>
        {cv.header.headline && <p className="text-sm text-muted-foreground">{cv.header.headline}</p>}
        <ul className="flex flex-wrap gap-2 pt-1" aria-label="Datos clave del CV">
          <li>
            <Badge variant="secondary">{LANG[d.language]}</Badge>
          </li>
          <li>
            <Badge variant="secondary">
              {SENIORITY[d.seniority.label]}
              {years}
            </Badge>
          </li>
          <li>
            <Badge variant="secondary">
              {cv.experience.length} {cv.experience.length === 1 ? "puesto" : "puestos"}
            </Badge>
          </li>
        </ul>
      </div>

      <p className="text-sm text-muted-foreground">{styleSentence(d)}</p>

      {q && (
        <div className="flex flex-col gap-3" role="group" aria-labelledby="pregunta-cv">
          <p id="pregunta-cv" className="text-sm font-medium">
            {q.text}
          </p>
          {q.kind === "text" ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (text.trim()) onAnswer(q.id, text.trim())
              }}
            >
              <Input aria-labelledby="pregunta-cv" value={text} onChange={(e) => setText(e.target.value)} />
              <Button type="submit" variant="secondary" disabled={!text.trim()}>
                Responder
              </Button>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              {q.options?.map((o) => (
                <Button key={o} variant="secondary" className="flex-1" onClick={() => onAnswer(q.id, o)}>
                  {o}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {d.strengths.length > 0 && (
        <section className="flex flex-col gap-1.5" aria-labelledby="fortalezas">
          <h2 id="fortalezas" className="text-sm font-medium">
            Lo más sólido de tu CV
          </h2>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {d.strengths.slice(0, 2).map((s) => (
              <li key={s.text}>{s.text}</li>
            ))}
          </ul>
        </section>
      )}

      {d.problems.length > 0 && (
        <section className="flex flex-col gap-1.5" aria-labelledby="mejorar">
          <h2 id="mejorar" className="text-sm font-medium">
            Para mejorar
          </h2>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {d.problems.slice(0, 3).map((p, i) => (
              <li key={i}>{p.text}</li>
            ))}
          </ul>
        </section>
      )}

      {more && (
        <Collapsible>
          <CollapsibleTrigger className="group flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Ver el diagnóstico completo
            <ChevronDownIcon className="size-4 transition-transform group-data-panel-open:rotate-180" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-4 pt-2 text-sm">
            {d.strengths.length > 2 && (
              <div className="flex flex-col gap-1.5">
                <h3 className="font-medium">Más fortalezas</h3>
                <ul className="flex flex-col gap-1.5 text-muted-foreground">
                  {d.strengths.slice(2).map((s) => (
                    <li key={s.text}>{s.text}</li>
                  ))}
                </ul>
              </div>
            )}
            {d.problems.length > 3 && (
              <div className="flex flex-col gap-1.5">
                <h3 className="font-medium">Más para mejorar</h3>
                <ul className="flex flex-col gap-1.5 text-muted-foreground">
                  {d.problems.slice(3).map((p, i) => (
                    <li key={i}>{p.text}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <h3 className="font-medium">Riesgos para los filtros ATS</h3>
              {d.atsRisks.length === 0 ? (
                <p className="text-muted-foreground">No encontramos riesgos evidentes.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-muted-foreground">
                  {d.atsRisks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-medium">Secciones detectadas, en orden</h3>
              <ol className="flex flex-wrap gap-2">
                {d.sections.map((s) => (
                  <li key={s.order}>
                    <Badge variant="secondary">{SECTION[s.kind]}</Badge>
                  </li>
                ))}
              </ol>
            </div>
            <p className="text-xs text-muted-foreground">{d.seniority.basis}</p>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Button variant="ghost" className="self-start text-muted-foreground" onClick={onCorrect}>
        <PencilIcon data-icon="inline-start" /> Corregir
      </Button>
    </div>
  )
}
