import { applyChannels, applyLabel } from "./apply"
import type { JobDraft } from "./draft"
import { yearsLabel } from "./facts"
import { COUNTRY_NAME, REGION_OPTIONS } from "./geo"
import { formatSalary } from "./salary"

/** Datos de la tarjeta que se revisan uno por uno (lista de verificación del editor). */
export const FIELD_KEYS = ["titulo", "empresa", "ubicacion", "pais", "modalidad", "contrato", "nivel", "experiencia", "salario", "idiomas", "requisitos", "responsabilidades", "deseables", "postulacion", "region"] as const
export type FieldKey = (typeof FIELD_KEYS)[number]

export const FIELD_LABELS: Record<FieldKey, string> = {
  titulo: "Cargo",
  empresa: "Empresa",
  ubicacion: "Ubicación",
  pais: "País",
  modalidad: "Modalidad",
  contrato: "Contrato",
  nivel: "Nivel",
  experiencia: "Experiencia",
  salario: "Salario",
  idiomas: "Idiomas",
  requisitos: "Requisitos",
  responsabilidades: "Funciones",
  deseables: "Se valora",
  postulacion: "Cómo postular",
  region: "Región",
}

const MODE = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" } as const
const LEVEL: Record<string, string> = { practicante: "Practicante", junior: "Junior", "semi-senior": "Semi-senior", senior: "Senior", lead: "Líder", directivo: "Directivo" }
const count = (n: number | undefined, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : undefined)

/** Lo que dice la tarjeta hoy en cada dato (texto corto) o `undefined` si no hay dato. Sirve para mostrarlo y para detectar si la persona lo editó. */
export function fieldValues(d: JobDraft): Record<FieldKey, string | undefined> {
  const o = d.offer
  const channels = applyChannels(d.apply).map((c) => (c.method === "correo" ? `correo ${c.email}` : applyLabel(c).toLowerCase()))
  return {
    titulo: d.title.trim() || undefined,
    empresa: d.company,
    ubicacion: d.locationText,
    pais: d.country ? (COUNTRY_NAME.get(d.country) ?? d.country) : undefined,
    modalidad: d.workMode ? MODE[d.workMode] : undefined,
    contrato: d.employmentType,
    nivel: d.seniority ? (LEVEL[d.seniority] ?? d.seniority) : undefined,
    experiencia: yearsLabel(o.yearsExperience) ?? undefined,
    salario: d.salary?.min || d.salary?.max ? formatSalary(d.salary) : undefined,
    idiomas: o.languagesRequired?.length ? o.languagesRequired.map((l) => (l.level ? `${l.language} ${l.level}` : l.language)).join(", ") : undefined,
    requisitos: count(o.requirements.length, "requisito", "requisitos"),
    responsabilidades: count(o.responsibilities.length, "función", "funciones"),
    deseables: count(o.niceToHave.length, "punto", "puntos"),
    postulacion: channels.length ? channels.join(" · ") : undefined,
    region: d.regions.length ? d.regions.map((c) => (c === "TODAS" ? "Todas" : (REGION_OPTIONS.find((r) => r.code === c)?.name ?? c))).join(", ") : undefined,
  }
}

/** Cambio que deja un dato como «No indicado»; `null` si ese dato no se puede quitar desde la lista (cargo, listas, postulación, región). */
export function clearPatch(key: FieldKey, d: JobDraft): Partial<JobDraft> | null {
  switch (key) {
    case "empresa":
      return { company: undefined }
    case "ubicacion":
      return { locationText: undefined }
    case "pais":
      return { country: undefined }
    case "modalidad":
      return { workMode: undefined, remoteScope: undefined }
    case "contrato":
      return { employmentType: undefined }
    case "nivel":
      return { seniority: undefined, offer: { ...d.offer, seniority: "no-especificado" } }
    case "experiencia":
      return { offer: { ...d.offer, yearsExperience: undefined } }
    case "salario":
      return { salary: undefined }
    case "idiomas":
      return { offer: { ...d.offer, languagesRequired: [] } }
    default:
      return null
  }
}
