import { contentKeys } from "@/lib/keywords"
import type { MatchResult } from "@/lib/match/types"
import type { CV } from "@/lib/schemas/cv"
import type { RewriteItem } from "./groups"
import { verifyNoInvention } from "./verify"

const words = (s: string) => s.split(/\s+/).filter(Boolean).length
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim()

/**
 * Cambios que NO necesitan al modelo (deterministas y con evidencia exacta del CV):
 *  - quitar: viñetas demasiado cortas o repetidas (no aportan información);
 *  - añadir: herramientas y habilidades que tu experiencia ya demuestra con las mismas palabras de la oferta,
 *    pero que no figuran en tu lista de habilidades.
 */
export function proposeExtras(cv: CV, match: MatchResult | null, guard?: string): RewriteItem[] {
  const out: RewriteItem[] = []

  // quitar
  const seen = new Set<string>()
  const scan = (bullets: string[], idPrefix: string, label: (j: number) => string, section: string) => {
    bullets.forEach((b, j) => {
      const key = norm(b)
      const dup = seen.has(key)
      seen.add(key)
      if (words(b) < 4 || dup) {
        out.push({
          id: `rm.${idPrefix}.${j}`,
          label: label(j),
          original: b,
          proposed: "",
          status: "changed",
          kind: "quitar",
          section,
          reason: dup ? "Está repetida: ya la dices en otra viñeta." : "Es demasiado corta para aportar información útil.",
          evidence: [b],
          risk: "medio",
        })
      }
    })
  }
  cv.experience.forEach((e, i) => scan(e.bullets, `exp.${i}`, (j) => `${e.role} · ${e.company} — viñeta ${j + 1}`, "Experiencia"))
  cv.projects.forEach((p, i) => scan(p.bullets, `proj.${i}`, (j) => `Proyecto ${p.name} — viñeta ${j + 1}`, "Proyectos"))

  // añadir
  if (match) {
    const have = new Set(cv.skills.flatMap((g) => g.items).map((x) => contentKeys(x).join(" ")))
    let n = 0
    for (const m of match.groups.fit) {
      if (m.status !== "cubierto" || m.how !== "lexico" || (m.term.kind !== "tool" && m.term.kind !== "softSkill")) continue
      const key = contentKeys(m.term.text).join(" ")
      const frag = m.evidence.find((e) => e.section === "Experiencia" || e.section === "Proyectos")
      if (!key || have.has(key) || !frag) continue
      if (!verifyNoInvention(guard ?? cv, m.term.text).ok) continue
      have.add(key)
      out.push({
        id: `add.skill.${n++}`,
        label: "Habilidades",
        original: "",
        proposed: m.term.text,
        status: "changed",
        kind: "añadir",
        section: "Habilidades",
        reason: `«${m.term.text}» aparece en tu experiencia y la oferta lo pide, pero no figura en tus habilidades.`,
        evidence: [frag.text],
        risk: "bajo",
      })
      if (n >= 5) break
    }
  }
  return out.slice(0, 9)
}
