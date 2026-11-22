"use client"

import { XIcon, SparklesIcon } from "lucide-react"
import { DotLoader } from "@/components/ai/dot-loader"
import { FloatingDrawerContent } from "@/components/jobs/floating-drawer"
import type { useEmailBody } from "@/components/jobs/use-email-body"
import { WebUrlField } from "@/components/jobs/web-url-field"
import { Switch } from "@/components/motion/motion-switch"
import { SettingSelect, type SettingOption } from "@/components/setting-select"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { platformLabel, type ContactData } from "@/lib/apply/email"
import { TONES, toneOf, type BodySettings } from "@/lib/apply/body-settings"

type EmailBody = ReturnType<typeof useEmailBody>

/** Opciones de cada ajuste, de menos a más (el orden en que se listan en el selector). */
const LENGTH_OPTIONS: SettingOption[] = [
  { value: "corto", label: "Corto", hint: "Unas 2 frases: lo esencial." },
  { value: "medio", label: "Medio", hint: "3 o 4 frases: equilibrado." },
  { value: "largo", label: "Largo", hint: "5 o 6 frases, con más detalle." },
]
const LANG_OPTIONS: SettingOption[] = [
  { value: "auto", label: "Automático", hint: "Usa el idioma de la oferta." },
  { value: "es", label: "Español", hint: "El correo sale en español." },
  { value: "en", label: "Inglés", hint: "El correo sale en inglés." },
]
const FOCUS_OPTIONS: SettingOption[] = [
  { value: "variado", label: "Variado", hint: "Cada propuesta destaca algo distinto." },
  { value: "experiencia", label: "Experiencia", hint: "Destaca tu experiencia reciente." },
  { value: "habilidades", label: "Habilidades", hint: "Destaca las herramientas y habilidades que pide la oferta." },
  { value: "motivacion", label: "Motivación", hint: "Destaca tu interés por el cargo y cómo puedes aportar." },
]
const GREETING_OPTIONS: SettingOption[] = [
  { value: "simple", label: "Solo «Hola»", hint: "Un saludo breve, sin nombrar a la empresa." },
  { value: "equipo", label: "Hola, equipo", hint: "«Hola, equipo de la empresa:»." },
  { value: "formal", label: "Estimado", hint: "«Estimado equipo de selección de la empresa:»." },
]
const CTA_OPTIONS: SettingOption[] = [
  { value: "ninguno", label: "Sin cierre", hint: "Solo el agradecimiento final, sin invitar a nada." },
  { value: "agradecer", label: "Agradecer", hint: "Cierras agradeciendo que consideren tu postulación." },
  { value: "conversar", label: "Conversar", hint: "Quedas atento/a para conversar cuando les convenga." },
  { value: "entrevista", label: "Entrevista", hint: "Dices que te encantaría una entrevista." },
]

/** Datos que pueden salir en la firma, en el orden en que se muestran. */
const CONTACT_ROWS: { key: keyof ContactData; label: string; where: "texto" | "firma" }[] = [
  { key: "source", label: "Dónde vi la oferta", where: "texto" },
  { key: "phone", label: "Teléfono", where: "firma" },
  { key: "email", label: "Correo", where: "firma" },
  { key: "city", label: "Ciudad", where: "firma" },
  { key: "linkedin", label: "LinkedIn", where: "firma" },
  { key: "web", label: "Portafolio o web", where: "firma" },
]

/** Filas de ajustes de una misma lista: 8 px entre ellas (24 px separan los bloques). */
function Rows({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>
}

/** Una sección del panel: título, una línea que dice qué agrupa y sus controles (24 px entre ellos). */
function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <FieldGroup className="gap-6">{children}</FieldGroup>
    </section>
  )
}

/**
 * Drawer aparte (se abre encima del panel de correo) con los ajustes de redacción, en un solo panel de tres secciones según lo que hace cada
 * ajuste: «Cómo suena» (tono e idioma), «Qué dice» (longitud, enfoque y cierre) y «A quién y con qué datos» (saludo, nombre y datos).
 */
export function ApplyEmailSettingsDrawer({ open, onOpenChange, email, sourceName }: { open: boolean; onOpenChange: (open: boolean) => void; email: EmailBody; sourceName?: string | null }) {
  const { settings, setSettings: onChange, loading, generate, lang, recipientName, setRecipientName } = email
  const tone = toneOf(settings) ?? TONES[0].value
  const set = <K extends keyof BodySettings>(key: K) => (value: string) => onChange({ ...settings, [key]: value } as BodySettings)
  const langOptions = LANG_OPTIONS.map((o) => (o.value === "auto" ? { ...o, hint: `Usa el idioma de la oferta (ahora: ${lang === "en" ? "inglés" : "español"}).` } : o))
  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
      <FloatingDrawerContent>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
            <DrawerHeader className="flex flex-col gap-1 p-0 pt-4">
              <DrawerTitle>Ajustes de redacción</DrawerTitle>
              <DrawerDescription>El tono, el idioma, la longitud y el enfoque se aplican a las versiones que pidas con el botón de abajo; lo demás cambia al instante.</DrawerDescription>
            </DrawerHeader>
            <Section title="Cómo suena" description="El tono y el idioma de todo el correo.">
              <Rows>
                <SettingSelect label="Tono" options={TONES} value={tone} onValueChange={(v) => onChange({ ...settings, ...TONES.find((t) => t.value === v)?.settings })} />
                <SettingSelect label="Idioma" options={langOptions} value={settings.lang} onValueChange={set("lang")} />
              </Rows>
            </Section>
            <Separator />
            <Section title="Qué dice" description="La extensión, lo que destaca y cómo cierra.">
              <Rows>
                <SettingSelect label="Longitud" options={LENGTH_OPTIONS} value={settings.length} onValueChange={set("length")} />
                <SettingSelect label="Enfoque" options={FOCUS_OPTIONS} value={settings.focus} onValueChange={set("focus")} />
                <SettingSelect label="Cierre" options={CTA_OPTIONS} value={settings.cta} onValueChange={set("cta")} />
              </Rows>
            </Section>
            <Separator />
            <Section title="A quién y con qué datos" description="El saludo y los datos tuyos que salen en el correo. Tu nombre siempre va; solo aparecen los datos que tu CV trae.">
              <SettingSelect label="Saludo" options={GREETING_OPTIONS} value={settings.greeting} onValueChange={set("greeting")} />
              <Field>
                <FieldLabel htmlFor="mail-recipient" className="font-normal">
                  Nombre de quien recibe (opcional)
                </FieldLabel>
                <Input id="mail-recipient" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Ej.: Laura" autoComplete="off" />
                <FieldDescription>Si lo sabes, el saludo será «Hola, Laura:». Solo se usa en este correo.</FieldDescription>
              </Field>
              <DataTab email={email} sourceName={sourceName} />
            </Section>
          </div>
          <DrawerFooter className="flex-row gap-2 border-t border-border/40 p-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            {/* Acción principal: pide otras versiones con los ajustes elegidos y vuelve al paso para verlas llegar. */}
            <Button
              type="button"
              className="flex-1"
              disabled={loading}
              aria-busy={loading}
              onClick={() => {
                onOpenChange(false)
                void generate()
              }}
            >
              {loading ? <DotLoader variant="orbit" rounded /> : <SparklesIcon data-icon="inline-start" />}
              {loading ? "Escribiendo…" : "Pedir otras versiones"}
            </Button>
          </DrawerFooter>
        </div>
      </FloatingDrawerContent>
    </Drawer>
  )
}

/** Datos que salen en el correo: portafolio si falta y un interruptor por dato (solo los que el CV trae), con el valor que saldría. Agrupado en «En el texto» y «En la firma». */
export function DataTab({ email, sourceName }: { email: EmailBody; sourceName?: string | null }) {
  const { contact, setContact, available, extraUrl, removeUrl, addUrl, links, hasWebFromCv, cvValues } = email
  const shown = CONTACT_ROWS.filter((r) => available[r.key])
  const valueOf = (key: keyof ContactData): string => {
    if (key === "web") return links.map((l) => l.url.replace(/^https?:\/\//, "")).join(" · ")
    if (key === "source") return `Vi su publicación en ${platformLabel(sourceName) ?? ""}`.trim()
    return cvValues[key] ?? ""
  }
  const rows = (where: "texto" | "firma") =>
    shown
      .filter((r) => r.where === where)
      .map((r) => (
        <Field key={r.key} orientation="horizontal" className="items-center justify-between pointer-coarse:min-h-11">
          <FieldContent className="min-w-0 flex-1">
            <FieldLabel htmlFor={`contact-${r.key}`} className="font-normal">
              {r.label}
            </FieldLabel>
            <FieldDescription className="text-xs break-all">{valueOf(r.key)}</FieldDescription>
          </FieldContent>
          {r.key === "web" && extraUrl && (
            <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar el enlace agregado" onClick={removeUrl}>
              <XIcon aria-hidden />
            </Button>
          )}
          <Switch id={`contact-${r.key}`} checked={contact[r.key]} onCheckedChange={(on) => setContact({ ...contact, [r.key]: on })} />
        </Field>
      ))
  const inText = rows("texto")
  return (
    <FieldGroup className="gap-6">
      {!hasWebFromCv && !extraUrl && <WebUrlField id="mail-url" onAdd={addUrl} />}
      {shown.length === 0 && <FieldDescription>Tu CV no trae datos de contacto para mostrar aquí.</FieldDescription>}
      {inText.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">En el texto</p>
          {inText}
        </div>
      )}
      {rows("firma").length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">En la firma</p>
          {rows("firma")}
        </div>
      )}
    </FieldGroup>
  )
}
