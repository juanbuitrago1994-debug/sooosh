import Link from "next/link"
import { SearchXIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl items-center p-4">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>No encontramos esa página</EmptyTitle>
          <EmptyDescription>La dirección no existe o cambió. Vuelve al inicio para seguir adaptando tu CV.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button className="h-11" nativeButton={false} render={<Link href="/" />}>
            Volver al inicio
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  )
}
