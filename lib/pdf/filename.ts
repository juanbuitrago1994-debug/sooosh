const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

/** `CV-<nombre>-<empresa>.<ext>` (sin tildes ni espacios; sin empresa: `CV-<nombre>.<ext>`). */
export function cvFileName(fullName: string, company: string | undefined, ext: string): string {
  return `${["CV", slug(fullName), company ? slug(company) : ""].filter(Boolean).join("-")}.${ext}`
}

export const pdfFileName = (fullName: string, company?: string): string => cvFileName(fullName, company, "pdf")
