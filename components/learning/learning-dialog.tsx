"use client"

import { useCallback, useEffect, useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

type Rule = { id: number; text: string; source: "aprendida" | "manual"; enabled: boolean }
type Data = { rules: Rule[]; stats: { total: number; accepted: number; rejected: number; edited: number; sinceSummary: number }; every: number }

async function call(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? "No se pudo completar la acción.")
  return json
}

function RuleRow({ rule, onChange }: { rule: Rule; onChange: () => void }) {
  const [text, setText] = useState(rule.text)
  const run = (p: Promise<unknown>) => p.then(onChange).catch((e: Error) => toast.error(e.message))
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center gap-2">
        <Input className="h-11" aria-label="Texto de la regla" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text.trim() !== rule.text && text.trim().length >= 5 && run(call("PATCH", "/api/learning/rules", { id: rule.id, text }))} />
        <Button variant="ghost" size="icon" className="size-11" aria-label="Borrar la regla" onClick={() => run(call("DELETE", "/api/learning/rules", { id: rule.id }))}>
          <Trash2Icon aria-hidden />
        </Button>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Badge variant="outline">{rule.source === "aprendida" ? "Aprendida" : "Tuya"}</Badge>
        <label className="flex min-h-11 items-center gap-2">
          <Switch checked={rule.enabled} onCheckedChange={(v) => run(call("PATCH", "/api/learning/rules", { id: rule.id, enabled: v }))} aria-label="Usar esta regla" />
          Usar en las reescrituras
        </label>
      </div>
    </li>
  )
}

/** Panel mínimo "Lo que he aprendido": reglas visibles, editables y reiniciables. Es memoria de preferencias, no entrenamiento. */
export function LearningDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState("")
  const [draft, setDraft] = useState("")

  const load = useCallback(() => {
    call("GET", "/api/learning").then((d) => { setData(d); setError("") }).catch((e: Error) => setError(e.message))
  }, [])
  useEffect(() => {
    if (open) load()
  }, [open, load])

  const add = () => {
    if (draft.trim().length < 5) return
    call("POST", "/api/learning/rules", { text: draft }).then(() => { setDraft(""); load() }).catch((e: Error) => toast.error(e.message))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lo que he aprendido</DialogTitle>
          <DialogDescription>
            Es <strong>memoria de preferencias, no entrenamiento del modelo</strong>: el modelo no cambia. Guardamos tus decisiones y unas reglas, y las incluimos en las instrucciones de cada reescritura. Todo se queda en este equipo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {data && (
            <>
              <p className="text-sm text-muted-foreground">
                {data.stats.total} decisiones ({data.stats.accepted} aceptadas, {data.stats.edited} editadas, {data.stats.rejected} rechazadas). Las reglas se actualizan cada {data.every} decisiones nuevas
                {data.stats.total > 0 ? `; faltan ${Math.max(0, data.every - data.stats.sinceSummary)}` : ""}.
              </p>
              {data.rules.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>Aún no hay reglas</EmptyTitle>
                    <EmptyDescription>Aparecerán cuando hayas decidido suficientes cambios, o escribe tú una abajo.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ul className="flex flex-col divide-y">
                  {data.rules.map((r) => (
                    <RuleRow key={`${r.id}-${r.text}`} rule={r} onChange={load} />
                  ))}
                </ul>
              )}
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add() }}>
                <Input className="h-11" aria-label="Nueva regla" placeholder="Escribe una preferencia (p. ej. «Viñetas de máximo dos líneas»)" value={draft} onChange={(e) => setDraft(e.target.value)} />
                <Button type="submit" variant="secondary" className="h-11" disabled={draft.trim().length < 5}>
                  <PlusIcon data-icon="inline-start" /> Añadir
                </Button>
              </form>
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="ghost" className="h-11 self-start" disabled={data.stats.total === 0 && data.rules.length === 0} />}>Reiniciar lo aprendido</AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Reiniciar lo aprendido?</AlertDialogTitle>
                    <AlertDialogDescription>Se borrarán tus decisiones y todas las reglas (también las tuyas). No se puede deshacer.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => call("DELETE", "/api/learning").then(() => { toast.success("Memoria reiniciada"); load() }).catch((e: Error) => toast.error(e.message))}>Reiniciar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
