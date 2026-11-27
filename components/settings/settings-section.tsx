import type { ReactNode } from "react"

/**
 * Una sección de Ajustes: a la izquierda el título y su descripción; a la derecha lo editable (patrón de las referencias de Juan, 27-nov-2026). En pantallas angostas se apilan.
 * Las secciones se separan con un divisor apenas más claro que el fondo (el `divide-y` de `SettingsSections`).
 */
export function SettingsSection({ id, title, description, children }: { id: string; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-6 py-8 md:grid-cols-3 md:gap-10">
      <div className="flex flex-col gap-1 md:pr-6">
        <h2 id={id} className="text-sm font-medium">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-6 md:col-span-2">{children}</div>
    </section>
  )
}

/** Contenedor de las secciones: el divisor entre ellas es `foreground` al 10 %, ligeramente más claro que el fondo oscuro. */
export function SettingsSections({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-foreground/10">{children}</div>
}
