"use client"

import { useState } from "react"
import { FormProvider, get, useForm, useFormContext, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { cvSchema, type CV } from "@/lib/schemas/cv"
import { Section } from "./form-parts"
import { EducationFields, ExperienceFields, HeaderFields, LanguagesFields, ProjectsFields, SkillsFields, SummaryFields } from "./section-fields"
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
        <HeaderFields />
      </Section>

      <Section title="Resumen" {...props("summary")}>
        <SummaryFields />
      </Section>

      <Section title="Experiencia" count={len("experience")} {...props("experience")}>
        <ExperienceFields />
      </Section>

      <Section title="Educación" count={len("education")} {...props("education")}>
        <EducationFields />
      </Section>

      <Section title="Skills" count={len("skills")} {...props("skills")}>
        <SkillsFields />
      </Section>

      <Section title="Idiomas" count={len("languages")} {...props("languages")}>
        <LanguagesFields />
      </Section>

      <Section title="Proyectos" count={len("projects")} {...props("projects")}>
        <ProjectsFields />
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
