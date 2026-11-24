import { UploadIcon } from "lucide-react"

/**
 * Mismo mensaje en todos los momentos de soltar un CV (pantalla inicial, panel «Mi CV», con o sin CV): el mismo ícono, el mismo orden y los mismos
 * tamaños; solo cambia la frase. Los formatos aceptados van siempre debajo.
 */
export function DropMessage({ title, description }: { title: React.ReactNode; description: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="grid size-14 place-items-center rounded-lg bg-muted text-foreground">
        <UploadIcon className="size-4" />
      </span>
      <div className="flex flex-col items-center gap-1">
        {title}
        {description}
      </div>
      <p className="text-xs text-muted-foreground">PDF, Word o imagen</p>
    </div>
  )
}
