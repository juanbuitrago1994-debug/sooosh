"use client"

import { useMemo, useSyncExternalStore } from "react"
import { HISTORY_EVENT, parseHistory, readRaw, type HistoryEntry } from "@/lib/history"

function subscribe(onChange: () => void) {
  window.addEventListener(HISTORY_EVENT, onChange)
  window.addEventListener("storage", onChange) // otra pestaña
  return () => {
    window.removeEventListener(HISTORY_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

/** Historial guardado en este navegador; se actualiza solo al añadir o borrar. */
export function useHistory(): HistoryEntry[] {
  const raw = useSyncExternalStore(subscribe, () => readRaw(), () => null)
  return useMemo(() => parseHistory(raw), [raw])
}
