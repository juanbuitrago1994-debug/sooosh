"use client"

import type { ComponentProps } from "react"
import { BorderBeam } from "border-beam"
import { useTheme } from "next-themes"

/**
 * Beam — el efecto de haz/resplandor de borde de la app, reutilizable en cualquier componente (primero en el distintivo «Ofertas encontradas»).
 * Envuelve a la librería `border-beam` (MIT, versión fija 1.4.1; aprobada por Juan el 20-nov-2026) con los valores de la app: **un solo color**
 * (`mono`, escala de grises, por defecto; `colorVariant` permite otra paleta de la librería, p. ej. `ice`), intensidad baja (`strength` 0,5 en oscuro y 1 en claro: ver `beamStrength`) y el tema claro u oscuro según el de la app (no el del sistema).
 * `size` elige el estilo: `pulse-inner` (resplandor interior que respira, el sutil), `sm`/`md` (haz que viaja por el borde) o `line` (haz inferior).
 * El hijo debe tener su propio borde y radio: el efecto detecta el radio solo. La librería respeta «reducir movimiento».
 */
export type BeamStyle = ComponentProps<typeof BorderBeam>["size"]

/**
 * Intensidad por defecto según el tema. Los presets de la librería ya son MUCHO más tenues en claro (en `pulse-inner` el borde vale 0,32 en claro
 * frente a 1,54 en oscuro), así que con la misma intensidad el resplandor casi no se vería en el tema claro: en oscuro 0,5 (sutil) y en claro 1 (el máximo).
 * Si se pasa `strength` explícito, manda ese valor.
 */
export const beamStrength = (theme: "light" | "dark", explicit?: number): number => explicit ?? (theme === "light" ? 1 : 0.5)

export function Beam({ size = "pulse-inner", colorVariant = "mono", strength, children, ...props }: Omit<ComponentProps<typeof BorderBeam>, "theme" | "size"> & { size?: BeamStyle }) {
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === "light" ? "light" : "dark"
  return (
    <BorderBeam size={size} colorVariant={colorVariant} theme={theme} strength={beamStrength(theme, strength)} {...props}>
      {children}
    </BorderBeam>
  )
}
