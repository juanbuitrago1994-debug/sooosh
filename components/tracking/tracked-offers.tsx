"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookmarkIcon, ExternalLinkIcon, FolderIcon, MoreHorizontalIcon, PencilLineIcon, PlusIcon, StickyNoteIcon } from "lucide-react"
import { toast } from "sonner"
import { addCollection, editCollection, moveOfferTo, removeCollection, removeOffer, saveNote, type CollectionActionResult } from "@/app/mis-ofertas/actions"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { savePrefill } from "@/lib/jobs/prefill"
import { ago } from "@/lib/tracking/relative"
import { MAX_NAME, MAX_NOTE, type Collection } from "@/lib/tracking/collections-shared"
import type { TrackedOffer } from "@/lib/tracking/store"

const STATUS = {
  vigente: { label: "Sigue abierta", variant: "secondary" as const },
  finalizada: { label: "Oferta finalizada", variant: "destructive" as const },
  sin_verificar: { label: "Sin verificar", variant: "outline" as const },
}

const REASONS: Record<string, string> = {
  limit: "Llegaste al máximo de categorías (20).",
  duplicate: "Ya tienes una categoría con ese nombre.",
  invalid: "Escribe un nombre.",
  session: "Tu sesión terminó. Vuelve a entrar.",
  error: "No pudimos guardar. Inténtalo de nuevo.",
}

/** Crear o renombrar una categoría: un campo y listo. */
function CollectionDialog({ open, onOpenChange, initial, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: string; onSubmit: (name: string) => Promise<CollectionActionResult> }) {
  const [name, setName] = useState(initial ?? "")
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const submit = () =>
    start(async () => {
      const r = await onSubmit(name)
      if (r.ok) return void (setError(""), onOpenChange(false))
      setError(REASONS[r.reason] ?? REASONS.error)
    })
  return (
    <Dialog open={open} onOpenChange={(o) => (setError(""), setName(initial ?? ""), onOpenChange(o))}>
      <DialogContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{initial ? "Renombrar categoría" : "Nueva categoría"}</DialogTitle>
            <DialogDescription>Agrupa tus ofertas como quieras: «Para postular esta semana», «Startups», «Plan B»…</DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="collection-name">Nombre</FieldLabel>
            <Input id="collection-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} autoComplete="off" aria-invalid={!!error} autoFocus />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending && <Spinner />}
              {initial ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Nota de la oferta: un texto libre que solo ve la persona. */
function NoteButton({ offer }: { offer: TrackedOffer }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(offer.note ?? "")
  const [pending, start] = useTransition()
  const save = () =>
    start(async () => {
      if (await saveNote(offer.id, text)) setOpen(false)
      else toast.error("No pudimos guardar la nota. Inténtalo de nuevo.")
    })
  return (
    <Popover open={open} onOpenChange={(o) => (setText(offer.note ?? ""), setOpen(o))}>
      <PopoverTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
        <StickyNoteIcon aria-hidden />
        {offer.note ? "Editar nota" : "Añadir nota"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Nota</PopoverTitle>
          <PopoverDescription>Solo la ves tú.</PopoverDescription>
        </PopoverHeader>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_NOTE} rows={5} placeholder="Contacto, fecha límite, por qué te interesa…" aria-label="Nota de la oferta" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={pending} onClick={save}>
            {pending && <Spinner />}
            Guardar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function MoveMenu({ offer, collections }: { offer: TrackedOffer; collections: Collection[] }) {
  const [pending, start] = useTransition()
  const move = (value: string) =>
    start(async () => {
      if (!(await moveOfferTo(offer.id, value || null))) toast.error("No pudimos mover la oferta. Inténtalo de nuevo.")
    })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" disabled={pending} />}>
        <FolderIcon aria-hidden />
        Mover
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Mover a</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={offer.collectionId ?? ""} onValueChange={move}>
          <DropdownMenuRadioItem value="">Sin categoría</DropdownMenuRadioItem>
          {collections.length > 0 && <DropdownMenuSeparator />}
          {collections.map((c) => (
            <DropdownMenuRadioItem key={c.id} value={c.id}>
              {c.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Row({ o, collections }: { o: TrackedOffer; collections: Collection[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [now] = useState(() => new Date())
  const s = STATUS[o.status]
  const adapt = () => {
    if (savePrefill(o.offer)) router.push("/")
    else toast.error("No pudimos abrir la oferta para adaptar tu CV.")
  }
  const remove = () =>
    start(async () => {
      if (!(await removeOffer(o.id))) toast.error("No pudimos quitar la oferta. Inténtalo de nuevo.")
    })
  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-medium">{o.title}</h3>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            {o.company ? `${o.company} · ` : ""}
            {o.postedAt ? `Publicada ${ago(o.postedAt, now)}` : "Fecha de publicación no indicada"} · Guardada en Sooosh {ago(o.savedAt, now)}
          </p>
        </div>
        <Badge variant={s.variant} className="shrink-0">
          {s.label}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground" suppressHydrationWarning>
        {o.status === "finalizada"
          ? `Detectamos que cerró ${ago(o.closedDetectedAt, now)}. ${o.checkNote ?? ""}`
          : o.lastCheckedAt
            ? `Revisada ${ago(o.lastCheckedAt, now)}. ${o.status === "sin_verificar" ? (o.checkNote ?? "") : ""}`
            : "Aún no la hemos revisado; lo haremos en breve."}
      </p>
      {o.note && <p className="border-l pl-3 text-sm whitespace-pre-line text-muted-foreground">{o.note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Ver oferta
          <ExternalLinkIcon aria-hidden />
        </a>
        {o.status !== "finalizada" && (
          <Button variant="outline" size="sm" onClick={adapt}>
            Adaptar mi CV
          </Button>
        )}
        <MoveMenu offer={o} collections={collections} />
        <NoteButton offer={o} />
        <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={pending} onClick={remove}>
          Quitar
        </Button>
      </div>
    </li>
  )
}

function SectionHeader({ collection, count }: { collection: Collection | null; count: number }) {
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pending, start] = useTransition()
  const title = collection?.name ?? "Sin categoría"
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-medium">
        {title} <span className="font-normal text-muted-foreground">· {count === 1 ? "1 oferta" : `${count} ofertas`}</span>
      </h2>
      {collection && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Opciones de ${title}`} className="text-muted-foreground" />}>
              <MoreHorizontalIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenaming(true)}>
                <PencilLineIcon aria-hidden />
                Renombrar
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                Eliminar categoría
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <CollectionDialog open={renaming} onOpenChange={setRenaming} initial={collection.name} onSubmit={(n) => editCollection(collection.id, n)} />
          <AlertDialog open={deleting} onOpenChange={setDeleting}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar «{title}»?</AlertDialogTitle>
                <AlertDialogDescription>Tus ofertas no se borran: pasan a «Sin categoría».</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      if (!(await removeCollection(collection.id))) toast.error("No pudimos eliminar la categoría. Inténtalo de nuevo.")
                    })
                  }
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}

/** «Mis ofertas»: las ofertas guardadas, agrupadas en las categorías que crea la persona, con notas y estado de vigencia (lo revisa una tarea automática). */
export function TrackedOffers({ offers, collections }: { offers: TrackedOffer[]; collections: Collection[] }) {
  const [creating, setCreating] = useState(false)
  if (offers.length === 0 && collections.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookmarkIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Aún no tienes ofertas guardadas</EmptyTitle>
          <EmptyDescription>Guarda ofertas desde el buscador o pega el enlace de una en «Nueva oferta»: las guardamos completas aquí y vigilamos si siguen abiertas.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href="/ofertas" className={buttonVariants()}>
            Buscar ofertas
          </Link>
        </EmptyContent>
      </Empty>
    )
  }
  const known = new Set(collections.map((c) => c.id))
  const loose = offers.filter((o) => !o.collectionId || !known.has(o.collectionId))
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Crea categorías y organiza tus ofertas como quieras.</p>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setCreating(true)}>
          <PlusIcon aria-hidden />
          Nueva categoría
        </Button>
      </div>
      <CollectionDialog open={creating} onOpenChange={setCreating} onSubmit={addCollection} />
      {collections.map((c) => {
        const items = offers.filter((o) => o.collectionId === c.id)
        return (
          <section key={c.id} aria-label={c.name} className="flex flex-col">
            <SectionHeader collection={c} count={items.length} />
            {items.length === 0 ? (
              <FieldDescription className="py-4">Aún no hay ofertas aquí. Muévelas desde el botón «Mover» de cada oferta.</FieldDescription>
            ) : (
              <ul className="flex flex-col divide-y">
                {items.map((o) => (
                  <Row key={o.id} o={o} collections={collections} />
                ))}
              </ul>
            )}
          </section>
        )
      })}
      {(loose.length > 0 || collections.length === 0) && (
        <section aria-label="Sin categoría" className="flex flex-col">
          <SectionHeader collection={null} count={loose.length} />
          <ul className="flex flex-col divide-y">
            {loose.map((o) => (
              <Row key={o.id} o={o} collections={collections} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
