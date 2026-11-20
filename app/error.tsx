"use client"

import { useEffect } from "react"
import { TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

/** Error inesperado en la app. En esta versión de Next el botón usa `retry` (no `reset`). */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl items-center p-4">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Algo salió mal</EmptyTitle>
          <EmptyDescription>Ocurrió un error inesperado. Tus datos no salen de este equipo. Inténtalo de nuevo; si sigue pasando, recarga la página.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button className="h-11" onClick={() => retry()}>
            Reintentar
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
