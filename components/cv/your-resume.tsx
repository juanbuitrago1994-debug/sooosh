"use client"

import { useRef, useState, useSyncExternalStore, type ComponentType } from "react"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { ListSkeleton } from "@/components/common/list-skeleton"
import { SettingsSection, SettingsSections } from "@/components/settings/settings-section"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { normalizeHeadline } from "@/lib/cv/headline"
import { describeFill, emptyCv, mergeCv } from "@/lib/cv/merge"
import { friendlyReadError, pickCvFile } from "@/lib/profile/cv-drop"
import { parseStoredCv, uploadAndParseCv } from "@/lib/profile/parse-client"
import { getSearchProfile, saveProfileCv } from "@/lib/profile/search-profile"
import { cvSchema, type CV } from "@/lib/schemas/cv"
import { STORED_ID_RE } from "@/lib/uploads"
import { AwardsFields, CertificationsFields, EducationFields, ExperienceFields, HeaderFields, LanguagesFields, ProjectsFields, PublicationsFields, SkillsFields, SummaryFields, VolunteeringFields } from "./section-fields"
import { FillConfirmDialog } from "./fill-confirm-dialog"
import { ResumeProgress } from "./resume-progress"
import type { CVInput } from "./types"

const FORM_ID = "resume-form"
const ACCEPT_ATTR = `.${["pdf", "docx", "doc", "odt", "rtf", "txt", "md", "jpg", "jpeg", "png", "heic"].join(",.")}`
const noop = () => () => {}

type OptionalKey = "certifications" | "volunteering" | "awards" | "publications"
/** Secciones que no todos los perfiles necesitan: aparecen solo si traen datos o si la persona las agrega. */
const OPTIONAL: { key: OptionalKey; title: string; description: string; Fields: ComponentType }[] = [
  { key: "certifications", title: "Certificaciones y cursos", description: "Credenciales y cursos que respaldan tu perfil, con la entidad y la fecha.", Fields: CertificationsFields },
  { key: "volunteering", title: "Voluntariado", description: "Trabajo voluntario o comunitario que quieras mostrar.", Fields: VolunteeringFields },
  { key: "awards", title: "Premios y reconocimientos", description: "Distinciones recibidas por tu trabajo.", Fields: AwardsFields },
  { key: "publications", title: "Publicaciones y charlas", description: "Artículos, charlas o ponencias, con su enlace.", Fields: PublicationsFields },
]

/**
 * «Your resume»: el perfil profesional editable. Mismo patrón que Ajustes (título y descripción a la izquierda, campos a la derecha, un divisor por sección).
 * Se llena a mano o con «Llenar con tu CV» (completa solo lo vacío; nunca pisa lo escrito). Guardar deja el perfil como CV validado (`CvSync` lo sube a la cuenta).
 */
export function YourResume() {
  // El perfil vive en este navegador: hasta hidratar no se sabe si hay uno, y el formulario toma su valor inicial una sola vez.
  const hydrated = useSyncExternalStore(noop, () => true, () => false)
  if (!hydrated) return <ListSkeleton rows={5} label="Cargando tu perfil" />
  return <ResumeForm />
}

export function ResumeForm() {
  const [initial] = useState<CV>(() => {
    const p = getSearchProfile()
    return p?.validatedAt ? normalizeHeadline(p.cv) : emptyCv()
  })
  const form = useForm<CVInput, unknown, CV>({ resolver: zodResolver(cvSchema), defaultValues: initial, mode: "onTouched" })
  const [reading, setReading] = useState<string | null>(null)
  const [added, setAdded] = useState<OptionalKey[]>([])
  const [pending, setPending] = useState<{ merged: CV; fills: string[]; keeps: string[] } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const { isSubmitting } = form.formState

  const lists = useWatch({ control: form.control, name: ["certifications", "volunteering", "awards", "publications"] })
  const visible = OPTIONAL.filter((o, i) => (lists[i]?.length ?? 0) > 0 || added.includes(o.key))
  const hidden = OPTIONAL.filter((o) => !visible.includes(o))

  /** Calcula qué cambiaría y se lo muestra a la persona ANTES de tocar nada; solo al confirmar se completa el perfil. */
  function apply(raw: unknown) {
    // Lo leído puede venir sin las listas nuevas (otra lectura, un resultado anterior): se normaliza con el esquema antes de combinar.
    const source = cvSchema.safeParse(raw)
    if (!source.success) return void toast.error("No pudimos entender los datos leídos de tu CV. Prueba con otro archivo.")
    const base = form.getValues() as unknown as CV
    const merged = normalizeHeadline(mergeCv(base, source.data))
    const { fills, keeps } = describeFill(base, normalizeHeadline(source.data))
    if (fills.length === 0) {
      toast.info(keeps.length ? "Ese CV trae datos distintos, pero tu perfil ya tiene esos campos: no cambiamos nada." : "Tu perfil ya tiene lo que trae ese CV: no hay nada para completar.")
      return
    }
    setPending({ merged, fills, keeps })
  }

  function confirmFill() {
    if (!pending) return
    form.reset(pending.merged, { keepDefaultValues: true })
    toast.success(`Completamos ${pending.fills.length} ${pending.fills.length === 1 ? "dato" : "datos"} con tu CV. Revisa y guarda.`)
    setPending(null)
  }

  async function onFile(files: FileList | null) {
    const picked = pickCvFile(files)
    if (!picked.file) return void toast.error(picked.error)
    setReading("Leyendo tu CV…")
    try {
      const r = await uploadAndParseCv(picked.file, setReading)
      apply(r.cv)
    } catch (e) {
      toast.error(friendlyReadError((e as Error).message))
    } finally {
      setReading(null)
    }
  }

  async function fill() {
    const stored = getSearchProfile()
    // 1) El archivo que la persona ya subió sigue en el servidor: se vuelve a leer con la lógica ACTUAL (una lectura guardada de antes puede no traer lo que hoy sí se detecta, p. ej. el titular).
    if (stored?.fileId && STORED_ID_RE.test(stored.fileId)) {
      setReading("Leyendo tu CV…")
      try {
        const r = await parseStoredCv(stored.fileId, setReading)
        return apply(r.cv)
      } catch {
        /* el archivo ya no está en el servidor: se sigue con lo que haya */
      } finally {
        setReading(null)
      }
    }
    // 2) Un CV leído y sin validar que está en este navegador.
    if (stored && !stored.validatedAt) return apply(stored.cv)
    // 3) Nada que reutilizar: se pide el archivo.
    input.current?.click()
  }

  function removeSection(key: OptionalKey) {
    form.setValue(key, [], { shouldDirty: true })
    setAdded((a) => a.filter((k) => k !== key))
  }

  return (
    <FormProvider {...form}>
      <form
        id={FORM_ID}
        noValidate
        className="pb-28"
        onSubmit={form.handleSubmit(
          (cv) => {
            if (!saveProfileCv(cv)) return void toast.error("No pudimos guardar tu perfil en este navegador.")
            form.reset(cv)
            toast.success("Guardamos tu perfil.")
          },
          () => toast.error("Revisa los campos marcados en rojo."),
        )}
      >
        <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-hidden accept={ACCEPT_ATTR} onChange={(e) => (void onFile(e.target.files), (e.target.value = ""))} />
        <div className="flex flex-col gap-4 border-b border-foreground/10 pt-2 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-base font-medium">Your resume</h1>
            <p className="text-xs text-muted-foreground">Tu perfil profesional. Con él armamos tu CV para cada oferta.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={!!reading} onClick={() => void fill()}>
              {reading ? <Spinner /> : <SparklesIcon data-icon="inline-start" aria-hidden />}
              {reading ?? "Llenar con tu CV"}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              Guardar cambios
            </Button>
          </div>
        </div>

        <SettingsSections>
          <SettingsSection id="datos" title="Datos personales" description="Cómo te contactan las empresas. El nombre es lo único obligatorio.">
            <HeaderFields />
          </SettingsSection>
          <SettingsSection id="resumen" title="Resumen profesional" description="Dos o tres líneas con quién eres y qué haces mejor.">
            <SummaryFields />
          </SettingsSection>
          <SettingsSection id="experiencia" title="Experiencia laboral" description="Tus puestos, del más reciente al más antiguo, con logros medibles.">
            <ExperienceFields />
          </SettingsSection>
          <SettingsSection id="educacion" title="Educación" description="Estudios formales y su fecha.">
            <EducationFields />
          </SettingsSection>
          <SettingsSection id="habilidades" title="Habilidades" description="Herramientas y conocimientos, agrupados por categoría.">
            <SkillsFields />
          </SettingsSection>
          <SettingsSection id="idiomas" title="Idiomas" description="Los que hablas y tu nivel.">
            <LanguagesFields />
          </SettingsSection>
          <SettingsSection id="proyectos" title="Proyectos" description="Trabajos destacados o casos de estudio, con enlace si lo tienen.">
            <ProjectsFields />
          </SettingsSection>
          {visible.map(({ key, title, description, Fields }) => (
            <SettingsSection key={key} id={key} title={title} description={description}>
              <Fields />
              <Button type="button" variant="ghost" className="self-start text-muted-foreground" onClick={() => removeSection(key)}>
                <Trash2Icon data-icon="inline-start" aria-hidden /> Quitar sección
              </Button>
            </SettingsSection>
          ))}
        </SettingsSections>

        {hidden.length > 0 && (
          <div className="flex flex-col items-start gap-2 border-t border-foreground/10 py-8">
            <p className="text-xs text-muted-foreground">No todos los perfiles las necesitan: agrega solo las que apliquen.</p>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
                <PlusIcon data-icon="inline-start" aria-hidden /> Agregar sección
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {hidden.map((o) => (
                  <DropdownMenuItem key={o.key} onClick={() => setAdded((a) => [...a, o.key])}>
                    {o.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </form>
      <ResumeProgress />
      <FillConfirmDialog plan={pending} onConfirm={confirmFill} onCancel={() => setPending(null)} />
    </FormProvider>
  )
}
