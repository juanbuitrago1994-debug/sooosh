"use client"

import type { ComponentProps } from "react"
import { BorderBeam } from "border-beam"
import { useTheme } from "next-themes"

/**
 * Beam — el efecto de haz/resplandor de borde de la app, reutilizable en cualquier componente (primero en el distintivo «Ofertas encontradas»).
 * Envuelve a la librería `border-beam` (MIT, versión fija 1.4.1; aprobada por Juan el 20-nov-2026) con los valores de la app: **un solo color**
 * (`mono`, escala de grises), intensidad baja (`strength` 0,5) y el tema claro u oscuro según el de la app (no el del sistema).
 * `size` elige el estilo: `pulse-inner` (resplandor interior que respira, el sutil), `sm`/`md` (haz que viaja por el borde) o `line` (haz inferior).
 * El hijo debe tener su propio borde y radio: el efecto detecta el radio solo. La librería respeta «reducir movimiento».
 */
export type BeamStyle = ComponentProps<typeof BorderBeam>["size"]

export function Beam({ size = "pulse-inner", strength = 0.5, children, ...props }: Omit<ComponentProps<typeof BorderBeam>, "colorVariant" | "theme" | "size"> & { size?: BeamStyle }) {
  const { resolvedTheme } = useTheme()
  return (
    <BorderBeam size={size} colorVariant="mono" theme={resolvedTheme === "light" ? "light" : "dark"} strength={strength} {...props}>
      {children}
    </BorderBeam>
  )
}
