import { XIcon } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { initialsOf, type LastUser } from "@/lib/auth/last-user"

const ERRORS: Record<string, string> = {
  google: "No pudimos iniciar sesión con Google. Inténtalo de nuevo.",
  dispositivo: "No pudimos registrar este dispositivo. Inténtalo de nuevo.",
}

/**
 * Entrada única: Google. Un formulario GET normal (sin JavaScript para entrar). «Mantener sesión iniciada» ya no se elige aquí: se configura en Ajustes, con la sesión abierta.
 * La entrada animada (efecto lupa) la pone `LoginLens` alrededor de toda la pantalla. Si en este dispositivo ya entró alguien, se le ofrece «Continuar como …» (ver `lib/auth/last-user.ts`).
 */
export function LoginCard({ error, last }: { error?: string; last?: LastUser | null }) {
  const first = last?.name.split(/\s+/)[0]
  return (
    <form action="/auth/google" method="get" className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo className="size-10" />
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-medium">Entra a Sooosh</h1>
          <p className="text-sm text-muted-foreground">Guarda tus CV y sigue tus ofertas con tu cuenta de Google.</p>
        </div>
      </div>

      {error && ERRORS[error] && (
        <Alert variant="destructive">
          <AlertDescription>{ERRORS[error]}</AlertDescription>
        </Alert>
      )}

      {last && (
        <div className="flex items-center gap-3 rounded-2xl border px-3 py-2.5">
          {/* Semiredondo, del mismo tamaño y forma que el botón de perfil de la barra superior (nunca un círculo). */}
          <Avatar className="size-9 rounded-lg after:rounded-lg">
            <AvatarFallback className="rounded-lg text-xs font-medium text-foreground">{initialsOf(last.name)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{last.name}</span>
            <span className="truncate text-xs text-muted-foreground">{last.email}</span>
          </div>
          {/* Quitar esta cuenta de este dispositivo: el mismo formulario, con otro destino. */}
          <Button type="submit" variant="ghost" size="icon-xs" className="text-muted-foreground" formAction="/auth/olvidar" formMethod="post" aria-label="Quitar esta cuenta de este dispositivo">
            <XIcon aria-hidden />
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Button type="submit" size="xl" className="w-full" {...(last ? { name: "cuenta", value: "ultima" } : {})}>
          {last ? `Continuar como ${first}` : "Continuar con Google"}
        </Button>
        {last && (
          <Button type="submit" variant="ghost" size="xl" className="w-full text-muted-foreground">
            Usar otra cuenta
          </Button>
        )}
      </div>
    </form>
  )
}
