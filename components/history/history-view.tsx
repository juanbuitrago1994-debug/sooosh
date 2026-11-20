"use client"

import { useState } from "react"
import { DownloadIcon, HistoryIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { clearHistory, removeEntry, type HistoryEntry } from "@/lib/history"
import { downloadPdf } from "@/lib/pdf/download"

const dateFmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" })

function EntryRow({ entry, onReopen }: { entry: HistoryEntry; onReopen: (e: HistoryEntry) => void }) {
  const [busy, setBusy] = useState(false)
  const delta = entry.coverageAfter - entry.coverageBefore

  const download = async () => {
    setBusy(true)
    try {
      await downloadPdf(entry.cv, entry.offer.company, entry.lang)
      toast.success("PDF descargado")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">{entry.offer.title}</h3>
        <p className="text-sm text-muted-foreground">
          {entry.offer.company ? `${entry.offer.company} · ` : ""}
          <time dateTime={entry.createdAt}>{dateFmt.format(new Date(entry.createdAt))}</time>
        </p>
        <ul className="flex flex-wrap gap-2 pt-1" aria-label="Resumen de la adaptación">
          <li>
            <Badge variant="secondary">
              Cobertura {entry.coverageBefore}% → {entry.coverageAfter}%{delta !== 0 && ` (${delta > 0 ? "+" : ""}${delta})`}
            </Badge>
          </li>
          <li>
            <Badge variant="outline">
              {entry.acceptedChanges} {entry.acceptedChanges === 1 ? "cambio aceptado" : "cambios aceptados"}
            </Badge>
          </li>
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="h-11 flex-1" variant="secondary" onClick={() => onReopen(entry)}>
          <RotateCcwIcon data-icon="inline-start" /> Reabrir
        </Button>
        <Button className="h-11 flex-1" variant="outline" disabled={busy} onClick={download}>
          {busy ? <Spinner aria-label="Cargando" data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}
          Descargar PDF
        </Button>
        <AlertDialog>
          <AlertDialogTrigger render={<Button className="h-11" variant="ghost" aria-label={`Eliminar la adaptación para ${entry.offer.title}`} />}>
            <Trash2Icon data-icon="inline-start" /> Eliminar
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar esta adaptación?</AlertDialogTitle>
              <AlertDialogDescription>Se quitará de este navegador. No afecta a los PDF que ya descargaste.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (removeEntry(entry.id)) toast.success("Adaptación eliminada")
                  else toast.error("No se pudo eliminar. Revisa que el navegador permita guardar datos.")
                }}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  )
}

export function HistoryView({ entries, onReopen }: { entries: HistoryEntry[]; onReopen: (e: HistoryEntry) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Tus adaptaciones anteriores. Se guardan solo en este navegador: nada se envía a ningún servidor.</p>

      {entries.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon />
            </EmptyMedia>
            <EmptyTitle>Aún no hay adaptaciones guardadas</EmptyTitle>
            <EmptyDescription>Cuando descargues un PDF en el último paso, la adaptación quedará aquí para reabrirla o volver a descargarla.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ul className="flex flex-col divide-y">
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} onReopen={onReopen} />
            ))}
          </ul>
          <AlertDialog>
            <AlertDialogTrigger render={<Button className="h-11 w-full" variant="ghost" />}>
              <Trash2Icon data-icon="inline-start" /> Borrar todo el historial
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Borrar todo el historial?</AlertDialogTitle>
                <AlertDialogDescription>Se eliminarán las {entries.length} adaptaciones guardadas en este navegador. No se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (clearHistory()) toast.success("Historial borrado")
                    else toast.error("No se pudo borrar el historial.")
                  }}
                >
                  Borrar todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}
