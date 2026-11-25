"use client"

import { useMemo, useState } from "react"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { StepHeader } from "@/components/wizard/step-header"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FORMATS, FORMAT_HINT, FORMAT_LABEL, toMarkdown, toText, type ExportFormat } from "@/lib/export/formats"
import { cvFileName } from "@/lib/pdf/filename"
import { downloadCv } from "@/lib/pdf/download"
import { renderCvHtml, type PdfLang } from "@/lib/pdf/template"
import type { RebuildReport } from "@/lib/rebuild/build"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"
import { TailoredAts } from "@/components/steps/tailored-ats"
import type { AtsExtras } from "@/lib/ats/enrich"
import type { TailoredAts as TailoredResult } from "@/lib/ats/client"

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Resumen en una o dos frases de lo que cambió y cómo quedó el encaje (la ficha antes y después). */
function summaryLines(report: RebuildReport | null | undefined, accepted: number): string[] {
  if (!report) return [accepted === 0 ? "Tu CV tal como lo revisaste, sin cambios." : `Tu CV con ${plural(accepted, "cambio aceptado", "cambios aceptados")}.`]
  const c = report.counts
  const applied = c.aceptado + c.editado
  const lines = [applied === 0 ? "Tu CV tal como lo revisaste, sin cambios." : `Tu CV con ${plural(applied, "cambio aplicado", "cambios aplicados")}${c.rechazado ? ` y ${plural(c.rechazado, "rechazado", "rechazados")}` : ""}.`]
  const d = report.fitAfter.overall - report.fitBefore.overall
  lines.push(`Encaje con la oferta: ${report.fitBefore.overall} → ${report.fitAfter.overall}${d ? ` (${d > 0 ? "+" : ""}${d})` : ""}.`)
  if (c.bloqueado) lines.push(`${plural(c.bloqueado, "cambio se dejó fuera", "cambios se dejaron fuera")} porque incluía datos que no están en tu CV.`)
  if (report.writtenByUser.length) lines.push(`${plural(report.writtenByUser.length, "texto escrito por ti", "textos escritos por ti")}: revísalos antes de enviar.`)
  return lines
}

/** Vista previa del CV final (con todos los ajustes) y descarga en el formato que elija la persona. */
export function StepExport({ cv, offer, accepted, report, onExported, ats }: { cv: CV | null; offer: Offer | null; accepted: number; report?: RebuildReport | null; onExported: (lang: PdfLang) => boolean; /** CV ATS para esta oferta: texto original y lectura profunda del CV, y qué hacer al generarlo (guardarlo en el repositorio) */ ats?: { sourceText?: string; extras?: AtsExtras | null; onGenerated: (r: TailoredResult) => void } }) {
  const [lang, setLang] = useState<PdfLang>(offer?.language === "en" ? "en" : "es")
  const [format, setFormat] = useState<ExportFormat>("pdf")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [pages, setPages] = useState<number | null>(null)

  const preview = useMemo(() => (cv ? (format === "txt" ? toText(cv, lang) : format === "md" ? toMarkdown(cv, lang) : renderCvHtml(cv, lang)) : ""), [cv, format, lang])

  if (!cv || !offer) {
    return (
      <div className="flex flex-col gap-2">
        <StepHeader title="Tu CV adaptado" description="Todavía no hay nada que exportar. Completa los pasos anteriores para generar tu CV adaptado." />
      </div>
    )
  }

  const fileName = cvFileName(cv.header.fullName, offer.company, format)

  const download = async () => {
    setBusy(true)
    setError("")
    try {
      const r = await downloadCv(cv, offer.company, lang, format)
      setPages(r.pages)
      const saved = onExported(lang)
      toast.success(saved ? `${FORMAT_LABEL[format]} descargado y guardado en tu historial` : `${FORMAT_LABEL[format]} descargado`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <StepHeader title="Tu CV adaptado" description={summaryLines(report, accepted).join(" ")} />

      {ats && <TailoredAts cv={cv} offer={offer} sourceText={ats.sourceText} extras={ats.extras} onGenerated={ats.onGenerated} />}

      <div className="flex flex-col gap-2">
        <Tabs value={format} onValueChange={(v) => { setFormat(v as ExportFormat); setPages(null) }}>
          <TabsList className="w-full" aria-label="Formato de descarga">
            {FORMATS.map((f) => (
              <TabsTrigger key={f} value={f}>
                {FORMAT_LABEL[f]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">{FORMAT_HINT[format]}</p>
      </div>

      {format === "txt" || format === "md" ? (
        <pre aria-label="Vista previa del CV" className="h-96 overflow-auto rounded-xl border border-border/40 bg-background/60 p-4 text-xs whitespace-pre-wrap lg:h-128">{preview}</pre>
      ) : (
        <iframe title="Vista previa del CV" srcDoc={preview} sandbox="" className="h-96 w-full rounded-xl border border-border/40 bg-background lg:h-128" />
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Idioma de los títulos de sección</span>
        <Tabs value={lang} onValueChange={(v) => setLang(v as PdfLang)}>
          <TabsList className="w-full">
            <TabsTrigger value="es">Español</TabsTrigger>
            <TabsTrigger value="en">English</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {error && (
        <p role="alert" className="text-sm whitespace-pre-line text-destructive">
          {error}
        </p>
      )}
      {pages !== null && (
        <p className="text-xs text-muted-foreground">
          {pages > 2 ? `Tu CV ocupa ${pages} páginas; lo recomendable son 1 o 2. Rechaza cambios largos o acorta viñetas.` : `PDF de ${plural(pages, "página", "páginas")}. Revísalo antes de enviarlo: comprueba que todo lo que dice es cierto.`}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button className="self-start" disabled={busy} onClick={download}>
          {busy ? <Spinner aria-label="Cargando" data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}
          {busy ? "Creando el archivo…" : `Descargar ${FORMAT_LABEL[format]}`}
        </Button>
        <p className="text-xs break-all text-muted-foreground">Se guardará como {fileName}</p>
      </div>
    </div>
  )
}
