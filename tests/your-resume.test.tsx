import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

describe("Your resume", () => {
  it("muestra las secciones con el patrón de Ajustes y deja las opcionales para agregar", async () => {
    const { ResumeForm } = await import("@/components/cv/your-resume")
    const html = renderToStaticMarkup(<ResumeForm />)
    expect(html).toContain("Your resume")
    for (const t of ["Datos personales", "Resumen profesional", "Experiencia laboral", "Educación", "Habilidades", "Idiomas", "Proyectos"]) expect(html, t).toContain(t)
    // Lo opcional no aparece hasta que la persona lo agrega o trae datos.
    for (const t of ["Certificaciones y cursos", "Voluntariado", "Premios y reconocimientos", "Publicaciones y charlas"]) expect(html, t).not.toContain(`>${t}<`)
    expect(html).toContain("Agregar sección")
    expect(html).toContain("Llenar con tu CV")
    // Sin cambios no se puede guardar ni cancelar.
    expect(html).toMatch(/<button[^>]*disabled[^>]*>(?:(?!<\/button>).)*Guardar cambios/)
  })
})
