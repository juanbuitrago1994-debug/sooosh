"use client"

import { useEffect, useRef, useState } from "react"
import { clearCv, pullCv, pushCv } from "@/app/cuenta/actions"
import { claimLocalData } from "@/lib/auth/local-data"
import { getSearchProfile, hydrateSearchProfile, useSearchProfile, type SearchProfile } from "@/lib/profile/search-profile"

/** Huella del CV validado: si cambia el contenido o la validación, hay algo nuevo que guardar. */
const keyOf = (p: SearchProfile) => `${p.validatedAt}|${p.fileId ?? ""}|${JSON.stringify(p.cv)}`
const time = (iso?: string) => (iso ? new Date(iso).getTime() : 0)

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
  const [ready, setReady] = useState(false)
  const synced = useRef("")
  const hadValidated = useRef(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const me = await pullCv().catch(() => null)
      if (!alive || !me) return
      claimLocalData(me.userId)
      const remote = me.cv
      const local = getSearchProfile()
      if (remote && (!local || (local.validatedAt && time(remote.validatedAt) > time(local.validatedAt)))) {
        if (hydrateSearchProfile(remote)) synced.current = keyOf({ ...remote, updatedAt: remote.validatedAt })
      } else if (remote && local?.validatedAt && time(remote.validatedAt) === time(local.validatedAt)) {
        synced.current = keyOf(local)
      }
      hadValidated.current = !!getSearchProfile()?.validatedAt
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
          if (ok) synced.current = key
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
