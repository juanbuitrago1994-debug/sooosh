"use client"

import { useState } from "react"
import Link from "next/link"
import { DownloadIcon, FileStackIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { useHistory } from "@/components/history/use-history"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { removeEntry, type HistoryEntry } from "@/lib/history"
import { downloadPdf } from "@/lib/pdf/download"
import { saveBlob, tailorAtsClient } from "@/lib/ats/client"

const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" })

/** Cuántas entradas caben sin scroll; con más, la lista tiene altura fija y se desplaza dentro del popover. */
const VISIBLE_WITHOUT_SCROLL = 4

/** Marca de «quiero una oferta nueva»: el enlace la deja en sessionStorage y el asistente la recoge (más fiable que leer la dirección durante la navegación). */
export const NEW_OFFER_FLAG = "sooosh:nueva-oferta"

/** Dirección para reabrir una adaptación desde cualquier página: el asistente la lee al cargar (`?reabrir=<id>`). */
export const reopenHref = (id: string) => `/?reabrir=${encodeURIComponent(id)}`

function Row({ entry, onReopen }: { entry: HistoryEntry; onReopen?: (e: HistoryEntry) => void }) {
  const [busy, setBusy] = useState(false)
  const download = async () => {
    setBusy(true)
    try {
      if (entry.ats) {
        // CV ATS de esa oferta: se vuelve a armar el PDF en formato ATS (sin IA ni lecturas lentas) a partir del CV guardado.
        const r = await tailorAtsClient(entry.cv, entry.offer, undefined, null)
        saveBlob(r.pdf.blob, r.pdf.name)
      } else await downloadPdf(entry.cv, entry.offer.company, entry.lang)
      toast.success("PDF descargado")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Item size="xs" data-cv-entry={entry.id}>
      <ItemContent>
        <ItemTitle className="w-full truncate">{entry.offer.title}</ItemTitle>
        <ItemDescription className="line-clamp-1">
          {entry.offer.company ? `${entry.offer.company} · ` : ""}
          <time dateTime={entry.createdAt}>{dateFmt.format(new Date(entry.createdAt))}</time>
        </ItemDescription>
      </ItemContent>
      {entry.ats ? (
        <Badge variant={entry.ats.percent >= 90 ? "default" : "outline"} title={`Formato ATS ${entry.ats.percent} %; cobertura de la oferta ${entry.coverageAfter} %`}>
          ATS {entry.ats.percent} %
        </Badge>
      ) : (
        <Badge variant="secondary" title={`Cobertura de la oferta: de ${entry.coverageBefore} % a ${entry.coverageAfter} %`}>
          {entry.coverageAfter} %
        </Badge>
      )}
      <ItemActions>
        <Button variant="ghost" size="icon-xs" aria-label={`Descargar el PDF para ${entry.offer.title}`} disabled={busy} onClick={download}>
          {busy ? <Spinner aria-label="Cargando" /> : <DownloadIcon aria-hidden />}
        </Button>
        {onReopen ? (
          <Button variant="ghost" size="icon-xs" aria-label={`Reabrir la adaptación para ${entry.offer.title}`} onClick={() => onReopen(entry)}>
            <RotateCcwIcon aria-hidden />
          </Button>
        ) : (
          <Link href={reopenHref(entry.id)} aria-label={`Reabrir la adaptación para ${entry.offer.title}`} className={buttonVariants({ variant: "ghost", size: "icon-xs" })}>
            <RotateCcwIcon aria-hidden />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Eliminar la adaptación para ${entry.offer.title}`}
          onClick={() => (removeEntry(entry.id) ? toast.success("Adaptación eliminada") : toast.error("No se pudo eliminar. Revisa que el navegador permita guardar datos."))}
        >
          <Trash2Icon aria-hidden />
        </Button>
      </ItemActions>
    </Item>
  )
}

/** La lista del repositorio (sin el popover): se puede probar por separado. */
export function CvRepositoryList({ entries, onReopen }: { entries: HistoryEntry[]; onReopen?: (e: HistoryEntry) => void }) {
  if (entries.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileStackIcon />
          </EmptyMedia>
          <EmptyTitle>Aún no hay CV guardados</EmptyTitle>
          <EmptyDescription>Cuando descargues el CV de una oferta, quedará aquí.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  const list = (
    <ItemGroup className="gap-0">
      {entries.map((e, i) => (
        <div key={e.id}>
          {i > 0 && <ItemSeparator className="my-0" />}
          <Row entry={e} onReopen={onReopen} />
        </div>
      ))}
    </ItemGroup>
  )
  return entries.length > VISIBLE_WITHOUT_SCROLL ? <ScrollArea className="h-80">{list}</ScrollArea> : list
}

/**
 * Repositorio de CV por oferta: un popover en la cabecera, con scroll, que lista el CV que se generó para cada oferta (más reciente primero) y deja
 * descargarlo, reabrirlo o quitarlo. Los datos son el historial de adaptaciones: viven SOLO en este navegador (`lib/history.ts`; el CV es un dato
 * personal y no sale del equipo). `onReopen` (el asistente) reabre en el sitio; desde otras páginas se enlaza a `/?reabrir=<id>`.
 */
export function CvRepository({ onReopen, onNewOffer }: { onReopen?: (e: HistoryEntry) => void; /** empezar con otra oferta en el asistente (si no se da, se enlaza a `/?nueva-oferta=1`) */ onNewOffer?: () => void }) {
  const entries = useHistory()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={entries.length ? `Mis CV por oferta (${entries.length})` : "Mis CV por oferta"} />}>
        <FileStackIcon aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] gap-3">
        <PopoverHeader>
          <PopoverTitle>Tus CV por oferta</PopoverTitle>
          <PopoverDescription className="text-xs">Uno por cada oferta. Se guardan solo en este navegador.</PopoverDescription>
        </PopoverHeader>
        {onNewOffer ? (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              setOpen(false)
              onNewOffer()
            }}
          >
            <PlusIcon data-icon="inline-start" /> Nueva oferta
          </Button>
        ) : (
          <Link
            href="/?nueva-oferta=1"
            onClick={() => {
              try {
                sessionStorage.setItem(NEW_OFFER_FLAG, "1")
              } catch {
                /* la dirección ya lleva la marca */
              }
            }}
            className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}>
            <PlusIcon data-icon="inline-start" /> Nueva oferta
          </Link>
        )}
        <CvRepositoryList
          entries={entries}
          onReopen={
            onReopen
              ? (e) => {
                  setOpen(false)
                  onReopen(e)
                }
              : undefined
          }
        />
      </PopoverContent>
    </Popover>
  )
}
