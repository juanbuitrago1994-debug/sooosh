import { Skeleton } from "@/components/ui/skeleton"

/** Esqueleto de una lista mientras llegan los datos: la página responde al instante en vez de quedarse en blanco. */
export function ListSkeleton({ rows = 4, label = "Cargando" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-6">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}
