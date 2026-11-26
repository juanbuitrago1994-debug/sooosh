/** «Nubank», «NUBANK » y «Nübank» son la misma empresa: clave sin tildes, mayúsculas ni signos. */
export function companyKey(company?: string | null): string {
  return (company ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}
