"use client"

import { useSyncExternalStore } from "react"

/** Un panel o ventana de la app (Dialog/Drawer de Base UI) está abierto: su elemento lleva `role="dialog"` y `data-open` mientras dura. */
export const OPEN_OVERLAY = '[role="dialog"][data-open]'

const anyOpen = () => typeof document !== "undefined" && document.querySelector(OPEN_OVERLAY) !== null

function subscribe(cb: () => void) {
  // Los paneles se montan en un portal dentro de <body> y cambian `data-open` al abrir y cerrar.
  const mo = new MutationObserver(cb)
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-open"] })
  return () => mo.disconnect()
}

/**
 * ¿Hay algún panel o ventana abierto? Sirve para ocultar lo que flota sobre la página (p. ej. el distintivo «Ofertas encontradas») mientras
 * otro panel está a la vista, sin tener que pasar el estado de cada panel hasta aquí: vale para los que existan hoy y los que se agreguen.
 */
export const useAnyOverlayOpen = (): boolean => useSyncExternalStore(subscribe, anyOpen, () => false)
