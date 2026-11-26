"use client"

import { useEffect, useRef, useState } from "react"
import { clearCv, pullCv, pushCv } from "@/app/cuenta/actions"
import { syncSavedJobs } from "@/app/mis-ofertas/actions"
import { getMarks, mergeSaved } from "@/lib/profile/job-marks"
import { claimLocalData } from "@/lib/auth/local-data"
import { getSearchProfile, hydrateSearchProfile, useSearchProfile, type SearchProfile } from "@/lib/profile/search-profile"

/** Huella del CV validado: si cambia el contenido o la validación, hay algo nuevo que guardar. */
const keyOf = (p: SearchProfile) => `${p.validatedAt}|${p.fileId ?? ""}|${JSON.stringify(p.cv)}`
const time = (iso?: string) => (iso ? new Date(iso).getTime() : 0)

/** Marca (en esta pestaña) de la última vez que el CV local y el de la cuenta quedaron iguales: evita repetir la consulta en cada pantalla. */
const MARK_KEY = "sooosh:sync-cv"
const FRESH_MS = 10 * 60_000
const markOf = (p: SearchProfile) => `${p.validatedAt ?? ""}|${p.fileId ?? ""}`
const writeMark = (p: SearchProfile | null) => {
  try {
    if (p) sessionStorage.setItem(MARK_KEY, JSON.stringify({ at: Date.now(), mark: markOf(p) }))
  } catch {
    /* sin almacenamiento */
  }
}
/** ¿Se sincronizó hace poco y el CV local no cambió desde entonces? Entonces no hace falta preguntar a la cuenta otra vez. */
function recentlySynced(local: SearchProfile | null): boolean {
  try {
    const m = JSON.parse(sessionStorage.getItem(MARK_KEY) ?? "null") as { at?: number; mark?: string } | null
    return !!local?.validatedAt && !!m && Date.now() - (m.at ?? 0) < FRESH_MS && m.mark === markOf(local)
  } catch {
    return false
  }
}

/**
 * Mantiene el CV validado de este navegador y el de la cuenta iguales (no pinta nada):
 * - al entrar: si este dispositivo no tiene CV, carga el de la cuenta; si tiene uno validado más reciente, lo sube; si el de la cuenta es más reciente, lo carga.
 *   Un CV a medio validar nunca se pisa.
 * - después: cada vez que la persona valida (o corrige y vuelve a validar) su CV, se guarda en la cuenta.
 * - si pide cambiar de CV, el de la cuenta deja de ser el activo para que no vuelva solo al recargar.
 * Solo viaja el CV validado; el archivo original y su texto se quedan en este navegador.
 */
export function CvSync() {
  const profile = useSearchProfile()
  // Si ya se sincronizó hace poco no hay nada que preguntar: se parte «listo» (el componente no pinta nada, así que no hay diferencia con el servidor).
  const [ready, setReady] = useState(() => typeof window !== "undefined" && recentlySynced(getSearchProfile()))
  const synced = useRef("")
  const hadValidated = useRef(false)

  useEffect(() => {
    let alive = true
    const start = getSearchProfile()
    if (recentlySynced(start)) {
      synced.current = keyOf(start!)
      hadValidated.current = true
      return
    }
    void (async () => {
      const me = await pullCv().catch(() => null)
      if (!alive || !me) return
      claimLocalData(me.userId)
      // Las ofertas guardadas de este navegador suben a la cuenta y las de la cuenta se marcan aquí (una vez por pestaña).
      try {
        if (!sessionStorage.getItem("sooosh:guardadas-sync")) {
          sessionStorage.setItem("sooosh:guardadas-sync", "1")
          void syncSavedJobs(getMarks().saved).then((ids) => ids && mergeSaved(ids))
        }
      } catch {
        /* sin almacenamiento */
      }
      const remote = me.cv
      const local = getSearchProfile()
      if (remote && (!local || (local.validatedAt && time(remote.validatedAt) > time(local.validatedAt)))) {
        if (hydrateSearchProfile(remote)) synced.current = keyOf({ ...remote, updatedAt: remote.validatedAt })
      } else if (remote && local?.validatedAt && time(remote.validatedAt) === time(local.validatedAt)) {
        synced.current = keyOf(local)
      }
      hadValidated.current = !!getSearchProfile()?.validatedAt
      if (synced.current) writeMark(getSearchProfile())
      setReady(true)
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    if (profile?.validatedAt) {
      hadValidated.current = true
      const key = keyOf(profile)
      if (key === synced.current) return
      const t = setTimeout(() => {
        void pushCv({ cv: profile.cv, label: profile.label, file: profile.file, originalAts: profile.originalAts, fileId: profile.fileId, validatedAt: profile.validatedAt }).then((ok) => {
          if (ok) {
            synced.current = key
            writeMark(profile)
          }
        })
      }, 1500)
      return () => clearTimeout(t)
    }
    if (!profile && hadValidated.current) {
      hadValidated.current = false
      synced.current = ""
      void clearCv()
    }
  }, [profile, ready])

  return null
}
