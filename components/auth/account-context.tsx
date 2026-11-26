"use client"

import { createContext, useContext, type ReactNode } from "react"

const AccountContext = createContext<{ name: string } | null>(null)

/** Nombre de la persona con sesión, entregado por el servidor: así las iniciales del botón de perfil salen desde el primer pintado. */
export function AccountProvider({ name, children }: { name: string; children: ReactNode }) {
  return <AccountContext.Provider value={{ name }}>{children}</AccountContext.Provider>
}

export const useAccountName = (): string | null => useContext(AccountContext)?.name ?? null
