"use client"

import { useState } from "react"
import { FormProvider, get, useForm, useFormContext, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { cvSchema, type CV } from "@/lib/schemas/cv"
import { EntryList, Section, StringList, TagsField, TextField } from "./form-parts"
import type { CVInput } from "./types"

export const CV_FORM_ID = "cv-form"

type SectionKey = "header" | "summary" | "experience" | "education" | "skills" | "languages" | "projects"

function countErrors(errors: FieldErrors<CVInput>, key: SectionKey): number {
  const e = get(errors, key)
  if (!e) return 0
  return JSON.stringify(e, (k, v) => (k === "ref" ? undefined : v)).split('"message"').length - 1
}

function Sections({ open, setOpen }: { open: Record<SectionKey, boolean>; setOpen: (k: SectionKey, v: boolean) => void }) {
  const { watch, formState } = useFormContext<CVInput>()
  const errors = formState.errors
  const props = (key: SectionKey) => ({
    open: open[key],
    onOpenChange: (v: boolean) => setOpen(key, v),
    errors: countErrors(errors, key),
  })
  const len = (k: "experience" | "education" | "skills" | "languages" | "projects") => watch(k)?.length ?? 0

  return (
    <div className="flex flex-col gap-3">
      <Section title="Cabecera" {...props("header")}>
        <TextField name="header.fullName" label="Nombre completo" />
        <TextField name="header.headline" label="Titular profesional" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="header.email" label="Email" />
          <TextField name="header.phone" label="Teléfono" />
        </div>
        <TextField name="header.location" label="Ubicación" />
        <h2 className="text-sm font-medium">Enlaces</h2>
        <EntryList name="header.links" itemLabel="Enlace" addLabel="Agregar enlace" emptyEntry={{ label: "", url: "" }}>
          {(i) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name={`header.links.${i}.label`} label="Etiqueta (LinkedIn, GitHub…)" />
              <TextField name={`header.links.${i}.url`} label="URL" />
            </div>
          )}
        </EntryList>
      </Section>

      <Section title="Resumen" {...props("summary")}>
        <TextField name="summary" label="Resumen profesional" multiline />
      </Section>

      <Section title="Experiencia" count={len("experience")} {...props("experience")}>
        <EntryList name="experience" itemLabel="Puesto" addLabel="Agregar experiencia" emptyEntry={{ company: "", role: "", startDate: "", bullets: [] }}>
          {(i) => (
            <>
              <TextField name={`experience.${i}.role`} label="Cargo" />
              <TextField name={`experience.${i}.company`} label="Empresa" />
              <TextField name={`experience.${i}.location`} label="Ubicación" />
              <div className="grid grid-cols-2 gap-4">
                <TextField name={`experience.${i}.startDate`} label="Inicio" />
                <TextField name={`experience.${i}.endDate`} label="Fin" />
              </div>
              <StringList name={`experience.${i}.bullets`} label="Logros y responsabilidades" addLabel="Agregar bullet" />
            </>
          )}
        </EntryList>
      </Section>

      <Section title="Educación" count={len("education")} {...props("education")}>
        <EntryList name="education" itemLabel="Estudio" addLabel="Agregar estudio" emptyEntry={{ institution: "", details: [] }}>
          {(i) => (
            <>
              <TextField name={`education.${i}.institution`} label="Institución" />
              <TextField name={`education.${i}.degree`} label="Título" />
              <TextField name={`education.${i}.field`} label="Área" />
              <div className="grid grid-cols-2 gap-4">
                <TextField name={`education.${i}.startDate`} label="Inicio" />
                <TextField name={`education.${i}.endDate`} label="Fin" />
              </div>
              <StringList name={`education.${i}.details`} label="Detalles" addLabel="Agregar detalle" />
            </>
          )}
        </EntryList>
      </Section>

      <Section title="Skills" count={len("skills")} {...props("skills")}>
        <EntryList name="skills" itemLabel="Grupo" addLabel="Agregar grupo" emptyEntry={{ category: "", items: [] }}>
          {(i) => (
            <>
              <TextField name={`skills.${i}.category`} label="Categoría (opcional)" />
              <TagsField name={`skills.${i}.items`} label="Skills" placeholder="TypeScript, PostgreSQL…" />
            </>
          )}
        </EntryList>
      </Section>

      <Section title="Idiomas" count={len("languages")} {...props("languages")}>
        <EntryList name="languages" itemLabel="Idioma" addLabel="Agregar idioma" emptyEntry={{ name: "", level: "" }}>
          {(i) => (
            <div className="grid grid-cols-2 gap-4">
              <TextField name={`languages.${i}.name`} label="Idioma" />
              <TextField name={`languages.${i}.level`} label="Nivel" />
            </div>
          )}
        </EntryList>
      </Section>

      <Section title="Proyectos" count={len("projects")} {...props("projects")}>
        <EntryList name="projects" itemLabel="Proyecto" addLabel="Agregar proyecto" emptyEntry={{ name: "", technologies: [], bullets: [] }}>
          {(i) => (
            <>
              <TextField name={`projects.${i}.name`} label="Nombre" />
              <TextField name={`projects.${i}.url`} label="URL" />
              <TextField name={`projects.${i}.description`} label="Descripción" multiline />
              <TagsField name={`projects.${i}.technologies`} label="Tecnologías" />
              <StringList name={`projects.${i}.bullets`} label="Logros" addLabel="Agregar bullet" />
            </>
          )}
        </EntryList>
      </Section>
    </div>
  )
}

export function CvForm({ initial, onSubmit }: { initial: CV; onSubmit: (cv: CV) => void | Promise<void> }) {
  const form = useForm<CVInput, unknown, CV>({ resolver: zodResolver(cvSchema), defaultValues: initial, mode: "onTouched" })
  const [open, setOpenState] = useState<Record<SectionKey, boolean>>({
    header: true,
    summary: false,
    experience: true,
    education: false,
    skills: false,
    languages: false,
    projects: false,
  })
  const setOpen = (k: SectionKey, v: boolean) => setOpenState((s) => (s[k] === v ? s : { ...s, [k]: v }))

  return (
    <FormProvider {...form}>
      <form
        id={CV_FORM_ID}
        noValidate
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          // Abre las secciones con errores para que se vean.
          setOpenState((s) => {
            const next = { ...s }
            for (const k of Object.keys(errors)) if (k in next) next[k as SectionKey] = true
            return next
          })
          toast.error("Revisa los campos marcados en rojo.")
        })}
      >
        <Sections open={open} setOpen={setOpen} />
      </form>
    </FormProvider>
  )
}
