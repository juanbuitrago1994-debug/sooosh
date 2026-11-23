import { slug } from "@/lib/pdf/filename"
import type { AtsDoc } from "./model"

/** `Nombre-Apellido-Cargo.pdf` (regla ATS-F7): sin tildes, espacios ni símbolos. Sin cargo, solo el nombre. */
export function atsFileName(doc: Pick<AtsDoc, "name" | "fileRole">, ext: "pdf" | "docx"): string {
  const role = slug(doc.fileRole).slice(0, 40).replace(/-+$/g, "")
  return `${[slug(doc.name), role].filter(Boolean).join("-") || "CV"}.${ext}`
}
