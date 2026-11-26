"use client"

import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Lista de fichas quitables (cada una con su ✕). Si se da `name`, cada ficha viaja en el formulario como un campo oculto. */
export function Chips({ items, onRemove, name, label }: { items: { value: string; label: string }[]; onRemove: (value: string) => void; name?: string; label: string }) {
  if (items.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2" aria-label={label}>
      {items.map((it) => (
        <li key={it.value}>
          <Badge variant="secondary" className="gap-1 pr-1">
            {it.label}
            <button type="button" className="rounded-full p-0.5 hover:bg-muted" onClick={() => onRemove(it.value)} aria-label={`Quitar ${it.label}`}>
              <XIcon className="size-3" />
            </button>
            {name && <input type="hidden" name={name} value={it.value} />}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

/** Campo para escribir textos cortos y añadirlos como fichas (Enter o el botón «+»). Sin repetidos (sin distinguir mayúsculas). */
export function ChipsInput({ id, value, onChange, max, placeholder, addLabel = "Añadir", listLabel, name, maxLength = 60 }: { id: string; value: string[]; onChange: (v: string[]) => void; max: number; placeholder?: string; addLabel?: string; listLabel: string; name?: string; maxLength?: number }) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const clean = draft.trim().replace(/\s+/g, " ")
    setDraft("")
    if (!clean || value.some((v) => v.toLowerCase() === clean.toLowerCase())) return
    onChange([...value, clean].slice(0, max))
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={value.length >= max}
        />
        <Button type="button" variant="outline" size="icon" onClick={add} disabled={!draft.trim() || value.length >= max} aria-label={addLabel}>
          <PlusIcon />
        </Button>
      </div>
      <Chips items={value.map((v) => ({ value: v, label: v }))} onRemove={(v) => onChange(value.filter((x) => x !== v))} name={name} label={listLabel} />
    </div>
  )
}
