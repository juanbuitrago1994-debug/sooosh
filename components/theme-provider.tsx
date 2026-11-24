"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * La app es SOLO oscura (decisión de Juan, 24-nov-2026): no hay interruptor de tema y no se sigue el del sistema. `forcedTheme` fija la clase `dark` en
 * <html> (los componentes que preguntan el tema, como `Beam`, reciben «dark»). Las variables del tema claro siguen en `globals.css` sin usarse.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
