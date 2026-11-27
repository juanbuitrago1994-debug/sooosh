"use client"

import { EntryList, StringList, TagsField, TextField } from "./form-parts"

/**
 * Campos de cada sección del CV, sin contenedor: los usan el formulario de corrección (`CvForm`, secciones plegables) y la vista «Your resume»
 * (título a la izquierda, campos a la derecha). Una sola definición, así un campo nuevo aparece en los dos sitios.
 */
export function HeaderFields() {
  return (
    <>
      <TextField name="header.fullName" label="Nombre completo" />
      <TextField name="header.headline" label="Titular profesional" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="header.email" label="Email" />
        <TextField name="header.phone" label="Teléfono" />
      </div>
      <TextField name="header.location" label="Ubicación" />
      <h3 className="text-sm font-medium">Enlaces</h3>
      <EntryList name="header.links" itemLabel="Enlace" addLabel="Agregar enlace" emptyEntry={{ label: "", url: "" }}>
        {(i) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name={`header.links.${i}.label`} label="Etiqueta (LinkedIn, GitHub, Behance…)" />
            <TextField name={`header.links.${i}.url`} label="URL" />
          </div>
        )}
      </EntryList>
    </>
  )
}

export function SummaryFields() {
  return <TextField name="summary" label="Resumen profesional" multiline />
}

export function ExperienceFields() {
  return (
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
  )
}

export function EducationFields() {
  return (
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
  )
}

export function SkillsFields() {
  return (
    <EntryList name="skills" itemLabel="Grupo" addLabel="Agregar grupo" emptyEntry={{ category: "", items: [] }}>
      {(i) => (
        <>
          <TextField name={`skills.${i}.category`} label="Categoría (opcional)" />
          <TagsField name={`skills.${i}.items`} label="Skills" placeholder="Figma, SQL, Google Analytics…" />
        </>
      )}
    </EntryList>
  )
}

export function LanguagesFields() {
  return (
    <EntryList name="languages" itemLabel="Idioma" addLabel="Agregar idioma" emptyEntry={{ name: "", level: "" }}>
      {(i) => (
        <div className="grid grid-cols-2 gap-4">
          <TextField name={`languages.${i}.name`} label="Idioma" />
          <TextField name={`languages.${i}.level`} label="Nivel" />
        </div>
      )}
    </EntryList>
  )
}

export function ProjectsFields() {
  return (
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
  )
}

export function CertificationsFields() {
  return (
    <EntryList name="certifications" itemLabel="Certificación" addLabel="Agregar certificación" emptyEntry={{ name: "" }}>
      {(i) => (
        <>
          <TextField name={`certifications.${i}.name`} label="Nombre" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name={`certifications.${i}.issuer`} label="Entidad" />
            <TextField name={`certifications.${i}.date`} label="Fecha" />
          </div>
          <TextField name={`certifications.${i}.url`} label="Enlace de la credencial" />
        </>
      )}
    </EntryList>
  )
}

export function VolunteeringFields() {
  return (
    <EntryList name="volunteering" itemLabel="Voluntariado" addLabel="Agregar voluntariado" emptyEntry={{ organization: "", bullets: [] }}>
      {(i) => (
        <>
          <TextField name={`volunteering.${i}.organization`} label="Organización" />
          <TextField name={`volunteering.${i}.role`} label="Rol" />
          <div className="grid grid-cols-2 gap-4">
            <TextField name={`volunteering.${i}.startDate`} label="Inicio" />
            <TextField name={`volunteering.${i}.endDate`} label="Fin" />
          </div>
          <StringList name={`volunteering.${i}.bullets`} label="Qué hiciste" addLabel="Agregar bullet" />
        </>
      )}
    </EntryList>
  )
}

export function AwardsFields() {
  return (
    <EntryList name="awards" itemLabel="Premio" addLabel="Agregar premio" emptyEntry={{ name: "" }}>
      {(i) => (
        <>
          <TextField name={`awards.${i}.name`} label="Nombre" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name={`awards.${i}.issuer`} label="Entidad" />
            <TextField name={`awards.${i}.date`} label="Fecha" />
          </div>
          <TextField name={`awards.${i}.description`} label="Descripción" multiline />
        </>
      )}
    </EntryList>
  )
}

export function PublicationsFields() {
  return (
    <EntryList name="publications" itemLabel="Publicación" addLabel="Agregar publicación" emptyEntry={{ title: "" }}>
      {(i) => (
        <>
          <TextField name={`publications.${i}.title`} label="Título" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name={`publications.${i}.publisher`} label="Medio o evento" />
            <TextField name={`publications.${i}.date`} label="Fecha" />
          </div>
          <TextField name={`publications.${i}.url`} label="Enlace" />
        </>
      )}
    </EntryList>
  )
}
