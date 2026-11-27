"use client"

import { useEffect, useRef } from "react"
import { useReducedMotion } from "motion/react"
import type { AuraRun } from "@/lib/aura/aura"

/**
 * Aura de la pantalla inicial (en la línea de Siri y Apple Intelligence): en el instante en que `active` pasa a verdadero (se detecta un CV arrastrado encima, o empieza la subida y
 * lectura), un lienzo WebGL transparente a pantalla completa lanza un GOLPE de luz desde el centro (el halo se hincha y se enciende y sale una onda de luz ancha) y después sigue en
 * bucle con un halo que respira y pulsos suaves (`lib/aura/aura.ts`). Solo suma luz sobre la página: no deforma nada ni necesita una «foto». El mensaje central es DOM real encima del
 * lienzo. Solo existe en esta pantalla (CLAUDE.md); el login mantiene su efecto aparte. Con «reducir movimiento» o sin WebGL no se pinta nada. El módulo se precarga al montar (para que el
 * golpe no espere la descarga) y el lienzo se crea al activarse y se destruye al terminar (nada corre en reposo).
 */
export function AuraField({ active }: { active: boolean }) {
  const reduce = useReducedMotion()
  const mount = useRef<HTMLDivElement>(null)

  // Precarga: la primera vez, descargar el módulo (y OGL) retrasaría el golpe justo cuando más se nota.
  useEffect(() => {
    if (!reduce) void import("@/lib/aura/aura").catch(() => {})
  }, [reduce])

  useEffect(() => {
    const host = mount.current
    if (!host || !active || reduce) return
    let cancelled = false
    let run: AuraRun | null = null
    void import("@/lib/aura/aura")
      .then(({ runAura }) => {
        if (cancelled) return
        run = runAura(host)
      })
      .catch(() => {
        /* sin WebGL: la pantalla funciona igual, sin aura */
      })
    return () => {
      cancelled = true
      void run?.stop()
    }
  }, [active, reduce])

  return <div ref={mount} aria-hidden data-aura-field className="pointer-events-none fixed inset-0 z-40" />
}
