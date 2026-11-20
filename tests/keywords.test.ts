import { describe, expect, it } from "vitest"
import { containsKeys, contentKeys, fold, stem, streamOf, synonymsOf, SYNONYMS_VERSION, termsIn } from "@/lib/keywords"

describe("normalización", () => {
  it("quita tildes y mayúsculas", () => {
    expect(fold("Gestión de PROYECTOS")).toBe("gestion de proyectos")
    expect(fold("Español")).toBe("espanol")
  })
  it("iguala singular y plural en español e inglés", () => {
    for (const [a, b] of [["habilidades", "habilidad"], ["servicios", "servicio"], ["databases", "database"], ["services", "service"], ["classes", "class"]]) expect(stem(a)).toBe(stem(b))
  })
  it("no confunde palabras distintas", () => {
    expect(stem("java")).not.toBe(stem("javascript"))
    expect(stem("react")).not.toBe(stem("reactive"))
  })
})

describe("coincidencia léxica", () => {
  it("claves de contenido: sin conectores ni relleno de ofertas", () => {
    expect(contentKeys("Dominio avanzado de Excel y SQL")).toEqual(["excel", "sql"])
    expect(contentKeys("Strong SQL and advanced Excel")).toEqual(["sql", "excel"])
  })
  it("las frases deben ser contiguas; una coma o un 'y' las rompen", () => {
    expect(containsKeys(streamOf("App en React Native"), contentKeys("React Native"))).toBe(true)
    expect(containsKeys(streamOf("React, Native"), contentKeys("React Native"))).toBe(false)
    expect(containsKeys(streamOf("React y Native"), contentKeys("React Native"))).toBe(false)
  })
  it("no hay falsos positivos entre términos parecidos", () => {
    for (const [term, text] of [["Java", "JavaScript"], ["SQL", "MySQL"], ["React", "Reactive programming"], ["Python", "Pythonic"]]) {
      expect(termsIn(text, [{ key: contentKeys(term).join(" ") }]), `${term} vs ${text}`).toEqual([])
    }
  })
  it("equivalencias es/en de la tabla versionada", () => {
    expect(synonymsOf("javascript").length).toBeGreaterThan(0)
    const keys = ["JavaScript", "Kubernetes"].map((t) => ({ key: contentKeys(t).join(" ") }))
    expect(termsIn("Trabajé con JS y K8s", keys)).toHaveLength(2)
    expect(SYNONYMS_VERSION).toBeGreaterThanOrEqual(1)
  })
})
