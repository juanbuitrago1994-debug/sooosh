/**
 * Dirección canónica de una oferta: sirve de clave única (la misma oferta no se carga dos veces aunque el enlace traiga rastreadores).
 * También nombra la fuente (linkedin, indeed…).
 */
const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|refid$|trk|trackingid$|originalsubdomain$|from$|source$|campaign$|vjs$|advn$|adid$|sjdu$|tk$)/i

const SOURCES: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)indeed\./, "indeed"],
  [/computrabajo\./, "computrabajo"],
  [/(^|\.)getonbrd\.com$/, "getonboard"],
  [/(^|\.)elempleo\.com$/, "elempleo"],
  [/(^|\.)magneto365\.com$/, "magneto"],
  [/greenhouse\.io$/, "greenhouse"],
  [/(^|\.)lever\.co$/, "lever"],
  [/(^|\.)workable\.com$/, "workable"],
  [/(^|\.)ashbyhq\.com$/, "ashby"],
  [/(^|\.)torre\.(co|ai)$/, "torre"],
]

export function sourceNameFor(host: string): string {
  const h = host.replace(/^www\./, "").toLowerCase()
  return SOURCES.find(([re]) => re.test(h))?.[1] ?? h.split(".").slice(-2, -1)[0] ?? "web"
}

export function normalizeSourceUrl(raw: string): { url: string; source: string } {
  const u = new URL(raw.trim())
  u.hash = ""
  u.protocol = "https:"
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "")
  const source = sourceNameFor(u.hostname)
  // LinkedIn: lo único que identifica la oferta es el id numérico (/jobs/view/<titulo>-<id>, ?currentJobId=<id>).
  if (source === "linkedin") {
    const id = u.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})/)?.[1] ?? u.searchParams.get("currentJobId")
    if (id) return { url: `https://www.linkedin.com/jobs/view/${id}/`, source }
  }
  // Indeed: la clave es `jk` (o `vjk`).
  if (source === "indeed") {
    const jk = u.searchParams.get("jk") ?? u.searchParams.get("vjk")
    if (jk) return { url: `https://${u.hostname}/viewjob?jk=${jk}`, source }
  }
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k)
  u.searchParams.sort()
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "")
  return { url: u.toString(), source }
}
