"use client"

import { useEffect } from "react"
import { TriangleAlertIcon } from "lucide-react"
import { ThemeProvider } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { geistMono, geistSans } from "./fonts"
import "./globals.css"

/** Último recurso: reemplaza al layout raíz, por eso define su propio <html> y <body>. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="es" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <ThemeProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-xl items-center p-4">
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <TriangleAlertIcon />
                </EmptyMedia>
                <EmptyTitle>La aplicación tuvo un problema</EmptyTitle>
                <EmptyDescription>Ocurrió un error grave y no pudimos mostrar la página. Tus datos no salen de este equipo. Intenta de nuevo o recarga.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button className="h-11" onClick={() => retry()}>
                  Reintentar
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
