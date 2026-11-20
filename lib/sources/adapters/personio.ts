import { htmlListItems, htmlToLines } from "../text"
import { SOURCE_HEADERS, type ExternalJob, type FetchResult } from "../types"

/** Personio: `{empresa}.jobs.personio.de/xml` (feed público, sin clave). Sin país: trae la oficina (ciudad). */
const tag = (s: string, t: string) => s.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, "i"))?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim()
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")

const EMPLOYMENT: Record<string, string> = { "full-time": "Tiempo completo", "part-time": "Medio tiempo", intern: "Prácticas", trainee: "Prácticas" }

export function parsePersonio(xml: string, slug: string, company?: string): ExternalJob[] {
  const out: ExternalJob[] = []
  for (const m of xml.matchAll(/<position>([\s\S]*?)<\/position>/gi)) {
    const p = m[1]
    const id = tag(p, "id")
    const name = tag(p, "name")
    if (!id || !name) continue
    const sections = [...p.matchAll(/<jobDescription>([\s\S]*?)<\/jobDescription>/gi)].map((s) => ({ title: decode(tag(s[1], "name") ?? ""), html: decode(tag(s[1], "value") ?? "") }))
    const lines = sections.flatMap((s) => [s.title, ...htmlToLines(s.html)]).filter(Boolean)
    const reqs = sections.filter((s) => /requisit|requirement|profile|qualif|perfil|about you|dein profil/i.test(s.title)).flatMap((s) => htmlListItems(s.html))
    const tasks = sections.filter((s) => /task|responsib|aufgabe|role|tareas|what you/i.test(s.title)).flatMap((s) => htmlListItems(s.html))
    out.push({
      sourceKey: `personio:${slug}`,
      sourceName: "personio",
      externalId: id,
      url: `https://${slug}.jobs.personio.de/job/${id}`,
      title: decode(name),
      company,
      locationText: tag(p, "office"),
      department: tag(p, "department"),
      employmentType: EMPLOYMENT[(tag(p, "schedule") ?? "").toLowerCase()] ?? undefined,
      seniority: tag(p, "seniority"),
      postedAt: tag(p, "createdAt"),
      description: lines.join("\n"),
      structured: reqs.length || tasks.length ? { requirements: reqs, responsibilities: tasks } : undefined,
    })
  }
  return out
}

export async function fetchPersonio(slug: string, company?: string, opts: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}): Promise<FetchResult> {
  const res = await (opts.fetchImpl ?? fetch)(`https://${encodeURIComponent(slug)}.jobs.personio.de/xml`, { headers: { ...SOURCE_HEADERS, Accept: "application/xml,text/xml" }, signal: opts.signal ?? AbortSignal.timeout(30_000) })
  if (res.status === 404) throw new Error(`No existe la empresa «${slug}» en Personio`)
  if (!res.ok) throw new Error(`Personio respondió ${res.status}`)
  return { jobs: parsePersonio(await res.text(), slug, company), complete: true }
}
