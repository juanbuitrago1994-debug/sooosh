import { Readability } from "@mozilla/readability"
import { parseHTML } from "linkedom"
import { decodeEntities, fragmentToText, htmlToText, jobPostingFromJsonLd, socialPostingFromJsonLd, type JobLd } from "./html"

/**
 * Capa 1 del pipeline de ofertas: extracción DETERMINISTA del contenido principal de una página.
 * Orden: JSON-LD `JobPosting` → selectores por sitio (LinkedIn, Indeed, Greenhouse, Lever, Workable…) →
 * Readability (respaldo) → heurística simple. En todos los casos se quita primero el "ruido" conocido
 * (comentarios, reacciones, navegación, cookies, publicidad).
 */
export type ExtractMethod = "json-ld" | "site" | "readability" | "heuristic"
export type Extracted = { text: string; method: ExtractMethod; site?: string; title?: string; company?: string; /** quién publicó (si es una persona, no una empresa) */ postedBy?: string; /** datos estructurados (JSON-LD) si la página los publica */ ld?: JobLd }

/** Elementos que nunca son parte de la oferta, en cualquier sitio. */
const GLOBAL_NOISE = [
  "script", "style", "noscript", "template", "svg", "iframe", "nav", "footer", "form", "button", "select", "dialog",
  "[role=navigation]", "[role=dialog]", "[aria-hidden=true]",
  // hilos de comentarios y respuestas, reacciones, compartir, cookies, publicidad
  "[class*=comment]", "[id*=comment]", "[data-test-id*=comment]", "[aria-label*=omment]", "[aria-label*=omentario]",
  "[class*=reaction]", "[class*=social-share]", "[class*=share-]", "[class*=cookie]", "[id*=cookie]", "[class*=consent]",
  "[class*=advert]", "[class*=sponsored]", "[class*=similar-jobs]", "[class*=related-jobs]", "[class*=more-jobs]",
  "[class*=sign-in]", "[class*=signin]", "[class*=join-now]", "[class*=authwall]",
]

type Site = {
  name: string
  /** ¿aplica a este host/ruta? */
  match: (host: string, path: string) => boolean
  /** selectores del cuerpo de la oferta, por orden de preferencia */
  body: string[]
  title?: string[]
  company?: string[]
  /** ruido adicional propio del sitio */
  remove?: string[]
}

export const SITES: Site[] = [
  {
    name: "linkedin-empleo",
    match: (h, p) => /(^|\.)linkedin\.com$/.test(h) && /\/jobs\//.test(p),
    body: [".show-more-less-html__markup", ".description__text", ".jobs-description__content", ".jobs-box__html-content", "[class*=job-details]"],
    title: [".top-card-layout__title", ".topcard__title", "h1"],
    company: [".topcard__org-name-link", ".top-card-layout__card a[href*='/company/']", ".jobs-unified-top-card__company-name"],
  },
  {
    name: "linkedin-publicacion",
    match: (h, p) => /(^|\.)linkedin\.com$/.test(h) && /\/(posts|feed\/update|pulse)\//.test(p),
    // el cuerpo de la publicación; los comentarios se eliminan antes (GLOBAL_NOISE + estos)
    body: [".attributed-text-segment-list__content", ".feed-shared-update-v2__description", "[data-test-id='main-feed-activity-card__commentary']", ".share-update-card__update-text", "article"],
    remove: [".comments-comment-item", ".comments-comments-list", ".social-details-social-counts", ".feed-shared-social-actions", ".social-actions", "[class*=social-counts]", "[class*=reactions]"],
  },
  {
    name: "indeed",
    match: (h) => /(^|\.)indeed\.[a-z.]+$/.test(h),
    body: ["#jobDescriptionText", ".jobsearch-JobComponent-description", "[data-testid=jobsearch-JobComponent-description]", ".jobsearch-jobDescriptionText"],
    title: [".jobsearch-JobInfoHeader-title", "[data-testid=jobsearch-JobInfoHeader-title]", "h1"],
    company: ["[data-testid=inlineHeader-companyName]", "[data-company-name=true]", ".jobsearch-CompanyInfoContainer a"],
  },
  { name: "greenhouse", match: (h) => /greenhouse\.io$/.test(h), body: ["#content", ".job__description", ".job-post"], title: [".app-title", ".job__title", "h1"], company: [".company-name"] },
  { name: "lever", match: (h) => /(^|\.)lever\.co$/.test(h), body: [".posting-page .content", ".section-wrapper.page-full-width", ".content"], title: [".posting-headline h2", "h2"], company: [".main-header-logo img"] },
  { name: "workable", match: (h) => /workable\.com$/.test(h), body: ["[data-ui=job-description]", "[data-ui=job-breakdown]", "main"], title: ["[data-ui=job-title]", "h1"] },
  { name: "computrabajo", match: (h) => /computrabajo\./.test(h), body: ["[class*=box_detail]", "#detail_dt", "[class*=detail]"], title: ["h1"] },
]

type Doc = ReturnType<typeof parseHTML>["document"]

const clean = (s: string) => decodeEntities(s).replace(/\s+/g, " ").trim()
const nodeText = (n: Element) => fragmentToText(n.innerHTML)

function firstText(doc: Doc, sels?: string[]): string | undefined {
  for (const s of sels ?? []) {
    try {
      const el = doc.querySelector(s)
      const t = el && (el.tagName === "IMG" ? (el as HTMLImageElement).alt : clean(el.textContent ?? ""))
      if (t) return t
    } catch {
      /* selector no soportado */
    }
  }
}

function removeAll(doc: Doc, sels: string[]) {
  for (const s of sels) {
    try {
      doc.querySelectorAll(s).forEach((n: Element) => n.remove())
    } catch {
      /* selector no soportado */
    }
  }
}

/** Quita el ruido sin tocar el contenedor del cuerpo de la oferta (por si su clase contiene "comment" u otro término). */
function removeNoise(doc: Doc, sels: string[], keep: Element | null) {
  for (const s of sels) {
    try {
      doc.querySelectorAll(s).forEach((n: Element) => {
        if (keep && (n === keep || n.contains(keep))) return
        n.remove()
      })
    } catch {
      /* selector no soportado */
    }
  }
}

export function extractOffer(html: string, url?: string): Extracted | null {
  // 1) JSON-LD
  const ld = htmlToTextFromJsonLd(html)
  if (ld) return ld

  let host = ""
  let path = ""
  try {
    if (url) {
      const u = new URL(url)
      host = u.hostname.replace(/^www\./, "")
      path = u.pathname
    }
  } catch {
    /* url inválida: se ignora el sitio */
  }

  // 2) Selectores por sitio
  const site = SITES.find((s) => s.match(host, path))
  if (site) {
    const { document } = parseHTML(html)
    let body: Element | null = null
    for (const sel of site.body) {
      try {
        const el = document.querySelector(sel)
        if (el && clean(el.textContent ?? "").length >= 60) {
          body = el
          break
        }
      } catch {
        /* selector no soportado */
      }
    }
    if (body) {
      removeAll(document, site.remove ?? [])
      removeNoise(document, GLOBAL_NOISE, body)
      // eliminar también el ruido DENTRO del cuerpo (p. ej. hilos de comentarios incrustados)
      removeNoise(body.ownerDocument as Doc, GLOBAL_NOISE.filter((s) => s !== "[aria-hidden=true]"), null)
      const text = nodeText(body)
      if (text.length >= 60) {
        // En una publicación de LinkedIn la empresa y la fecha salen de los datos estructurados de la página (no del texto).
        const social = site.name === "linkedin-publicacion" ? socialPostingFromJsonLd(html) : null
        return {
          text,
          method: "site",
          site: site.name,
          title: firstText(document, site.title),
          company: social?.company ?? firstText(document, site.company),
          postedBy: social?.postedBy,
          ld: social?.datePublished ? { datePosted: social.datePublished } : undefined,
        }
      }
    }
  }

  // 3) Readability (respaldo general)
  try {
    const { document } = parseHTML(html)
    removeNoise(document, GLOBAL_NOISE, null)
    const article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse()
    const text = article?.content ? fragmentToText(article.content) : ""
    if (text.length >= 200) return { text: article?.title ? `${clean(article.title)}\n\n${text}` : text, method: "readability", title: article?.title ? clean(article.title) : undefined }
  } catch {
    /* Readability no pudo: se sigue */
  }

  // 4) Heurística simple (última opción)
  const text = htmlToText(html)
  return text ? { text, method: "heuristic" } : null
}

function htmlToTextFromJsonLd(html: string): Extracted | null {
  const job = jobPostingFromJsonLd(html)
  if (!job) return null
  const body = fragmentToText(decodeEntities(job.description))
  if (body.length < 200) return null
  return { text: [job.title, job.company, "", body].filter((x) => x !== undefined).join("\n").trim(), method: "json-ld", title: job.title, company: job.company, ld: job.ld }
}
