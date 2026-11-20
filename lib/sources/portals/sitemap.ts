/** Direcciones de un sitemap o de un índice de sitemaps (acepta `<![CDATA[…]]>`). */
export type SitemapEntry = { loc: string; lastmod?: string }

const clean = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").trim()

export function parseSitemap(xml: string): { index: boolean; entries: SitemapEntry[] } {
  const index = /<sitemapindex[\s>]/i.test(xml)
  const block = index ? /<sitemap\b[\s\S]*?<\/sitemap>/gi : /<url\b[\s\S]*?<\/url>/gi
  const entries: SitemapEntry[] = []
  for (const m of xml.matchAll(block)) {
    const loc = m[0].match(/<loc>([\s\S]*?)<\/loc>/i)?.[1]
    if (!loc) continue
    const lastmod = m[0].match(/<lastmod>([\s\S]*?)<\/lastmod>/i)?.[1]
    entries.push({ loc: clean(loc), lastmod: lastmod ? clean(lastmod) : undefined })
  }
  return { index, entries }
}
