import { UploadIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/**
 * Mismo mensaje en todos los momentos de soltar un CV (pantalla inicial, panel «Mi CV», con o sin CV): el mismo ícono (16 px) en un cuadro de 36 px, el mismo orden y los mismos
 * tamaños; solo cambia la frase. Los formatos aceptados van siempre debajo, en una insignia redonda. Con `onPick`, el cuadro del ícono es un BOTÓN que abre el selector de archivos
 * (la pantalla inicial, mientras no hay nada subido); sin él, es solo el ícono.
 */
export function DropMessage({ title, description, onPick }: { title: React.ReactNode; description: React.ReactNode; onPick?: () => void }) {
  return (
    <div className="flex w-full max-w-full flex-col items-center gap-6 text-center">
      {onPick ? (
        <Button type="button" variant="secondary" size="icon" aria-label="Elegir un archivo de tu equipo" onClick={onPick}>
          <UploadIcon aria-hidden />
        </Button>
      ) : (
        <span className="grid size-9 place-items-center rounded-lg bg-muted text-foreground">
          <UploadIcon className="size-4" aria-hidden />
        </span>
      )}
      <div className="flex w-full max-w-full flex-col items-center gap-1">
        {title}
        {description}
      </div>
      <Badge variant="secondary" className="font-normal text-muted-foreground">
        PDF, Word o imagen
      </Badge>
    </div>
  )
}
