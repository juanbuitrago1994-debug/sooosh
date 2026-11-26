import { Logo } from "@/components/brand/logo"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"

const ERRORS: Record<string, string> = {
  google: "No pudimos iniciar sesión con Google. Inténtalo de nuevo.",
  dispositivo: "No pudimos registrar este dispositivo. Inténtalo de nuevo.",
}

/** Entrada única: Google. Un formulario GET normal (sin JavaScript): la casilla viaja como `?remember=1` solo si está marcada. */
export function LoginCard({ error }: { error?: string }) {
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
      <Field orientation="horizontal">
        <Checkbox id="remember" name="remember" value="1" />
        <FieldContent>
          <FieldLabel htmlFor="remember">Mantener sesión iniciada en este dispositivo</FieldLabel>
          <FieldDescription>Solo en tu equipo personal. En un dispositivo nuevo siempre se te pedirá entrar de nuevo.</FieldDescription>
        </FieldContent>
      </Field>
      <Button type="submit" size="lg" className="w-full">
        Continuar con Google
      </Button>
      <p className="text-center text-xs text-muted-foreground">Tu CV validado se guarda en tu cuenta y solo tú puedes verlo. El archivo original no se guarda.</p>
    </form>
  )
}
