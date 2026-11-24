"use client"

import { useState } from "react"
import { PencilIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { buildOverview } from "@/lib/cv/overview"
import { setSearchProfile, useSearchProfile } from "@/lib/profile/search-profile"
import type { CV } from "@/lib/schemas/cv"
import type { Diagnosis } from "@/lib/schemas/diagnosis"

const LANG = { es: "Español", en: "Inglés", otro: "Otro idioma" } as const

function List({ id, title, items }: { id: string; title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-1.5" aria-labelledby={id}>
      <h2 id={id} className="text-sm font-medium">
        {title}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((x) => (
          <li key={x}>
            <Badge variant="secondary">{x}</Badge>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Pantalla «Perfil»: un resumen corto de lo que se leyó (quién eres, dónde has trabajado, cuántos años, habilidades principales
 * y qué secciones tiene el CV). Sin diagnóstico ni consejos: eso viene después de elegir la oferta.
 * Solo pregunta si un dato clave es realmente dudoso, y entonces como confirmación.
 */
export function ProfileSummary({
  cv,
  fileId,
  diagnosis: d,
  sourceText,
  onAnswer,
  onCorrect,
}: {
  cv: CV
  /** id del archivo del que salió este CV (para saber si ya es el perfil de búsqueda) */
  fileId?: string
  diagnosis: Diagnosis
  sourceText: string
  onAnswer: (id: NonNullable<Diagnosis["question"]>["id"], answer: string) => void
  onCorrect: () => void
}) {
  const [text, setText] = useState("")
  const searchProfile = useSearchProfile()
  const isSearchProfile = !!fileId && searchProfile?.fileId === fileId
  const o = buildOverview(cv, d, sourceText)
  const q = d.question
  const contact = [o.email, o.phone, ...o.links.map((l) => l.label)].filter(Boolean)
  const years = o.years !== null ? `${String(Math.round(o.years)).replace(".", ",")} años de experiencia` : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-lg font-medium">{o.name ?? "Sin nombre"}</p>
        {(o.headline || o.location) && <p className="text-sm text-muted-foreground">{[o.headline, o.location].filter(Boolean).join(" · ")}</p>}
        {contact.length > 0 && <p className="text-xs text-muted-foreground">{contact.join(" · ")}</p>}
        <ul className="flex flex-wrap gap-2 pt-1" aria-label="Datos clave del CV">
          <li>
            <Badge variant="secondary">{LANG[d.language]}</Badge>
          </li>
          {years && (
            <li>
              <Badge variant="secondary">{years}</Badge>
            </li>
          )}
          <li>
            <Badge variant="secondary">
              {o.jobCount} {o.jobCount === 1 ? "puesto" : "puestos"}
            </Badge>
          </li>
        </ul>
      </div>

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
              {q.options?.map((opt) => (
                <Button key={opt} variant="secondary" className="flex-1" onClick={() => onAnswer(q.id, opt)}>
                  {opt}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {o.profile && (
        <section className="flex flex-col gap-1.5" aria-labelledby="perfil-cv">
          <h2 id="perfil-cv" className="text-sm font-medium">
            Tu perfil
          </h2>
          <p className="text-sm text-muted-foreground">{o.profile}</p>
        </section>
      )}

      <List id="empresas-cv" title="Empresas donde trabajaste" items={o.companies} />
      <List id="habilidades-cv" title="Habilidades principales" items={o.skills} />
      <List id="secciones-cv" title="Secciones de tu CV" items={o.sectionTitles} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {isSearchProfile ? (
          <p className="text-sm text-muted-foreground">Este es el CV con el que comparamos las ofertas del buscador.</p>
        ) : (
          <Button variant="secondary" onClick={() => setSearchProfile(cv, fileId, sourceText)}>
            Usar este CV para buscar ofertas
          </Button>
        )}
      </div>

      <Button variant="ghost" className="self-start text-muted-foreground" onClick={onCorrect}>
        <PencilIcon data-icon="inline-start" /> Corregir
      </Button>
    </div>
  )
}
