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
    // Divisor bajo el encabezado (el mismo que separa las secciones).
    expect(html).toContain("border-b border-foreground/10 pt-2 pb-6")
    // Título profesional y titulares son dos campos; los titulares son etiquetas (campo + botón «+»), no texto con comas.
    expect(html).toContain("Título profesional")
    expect(html).toContain("Titulares")
    expect(html).toContain("Escribe una y pulsa Enter")
    // Tarjeta de avance (esquina inferior derecha): perfil vacío = 0/10 y el botón lleva al primer pendiente.
    expect(html).toContain("Completa tu perfil")
    expect(html).toContain("Continúa con Nombre")
    expect(html).not.toContain("Falta:")
    expect(html).not.toContain("Ir a:")
    expect(html).toContain("0/12")
    expect(html).toContain("Continuar")
    // Una sola barra de progreso (el componente de shadcn ya dibuja la suya).
    expect(html.match(/data-slot="progress-track"/g) ?? []).toHaveLength(1)
    expect(html).toContain("bottom-4")
    // Ancho fijo: la tarjeta no cambia de tamaño según el contenido; y el botón es un enlace con chevron, no un botón grande.
    expect(html).toContain("sm:w-56")
    // Sin botones que no hagan nada: no hay «Cancelar» y «Guardar cambios» siempre está disponible.
    expect(html).not.toContain("Cancelar")
    expect(html).toContain("Guardar cambios")
  })
})
