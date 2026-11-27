"use client"

import { useCallback, useRef, useState } from "react"
import { useDropzone, type FileRejection } from "react-dropzone"
import { describeDrag, type DragInfo } from "@/lib/profile/cv-drop"
import {
  ACCEPT,
  ACCEPT_LABEL,
  MAX_UPLOAD_BYTES,
  formatBytes,
  validateFile,
  type UploadedFile,
} from "@/lib/uploads"

export type DropState =
  | { status: "idle" }
  | { status: "uploading"; name: string; size: number; type: string; progress: number }
  | { status: "ready"; file: UploadedFile }
  | { status: "error"; message: string }

function rejectionMessage(r: FileRejection): string {
  const code = r.errors[0]?.code
  if (code === "too-many-files") return "Sube un solo archivo a la vez."
  if (code === "file-too-large")
    return `«${r.file.name}» pesa ${formatBytes(r.file.size)}; el máximo es ${formatBytes(MAX_UPLOAD_BYTES)}.`
  return `«${r.file.name}» no es un formato admitido. Usa ${ACCEPT_LABEL}.`
}

function sendFile(file: File, onProgress: (pct: number) => void): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/upload")
    xhr.responseType = "json"
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as UploadedFile)
      else reject(new Error(xhr.response?.error ?? "No se pudo subir el archivo."))
    }
    xhr.onerror = () => reject(new Error("Sin conexión con el servidor. Inténtalo de nuevo."))
    const body = new FormData()
    body.append("file", file)
    xhr.send(body)
  })
}

/**
 * useCvDropzone — lógica de subida del CV (validación, progreso, reemplazo). No dibuja nada: la pantalla decide
 * cómo mostrar cada estado y aplica `rootProps` al elemento que hará de zona de soltar (puede ser la página entera).
 */
export function useCvDropzone({ onChange, disabled, onCancelDrop }: { onChange?: (file: UploadedFile | null) => void; disabled?: boolean; /** se soltó el archivo sobre la zona de cancelar: no se sube nada */ onCancelDrop?: () => void }) {
  const [state, setState] = useState<DropState>({ status: "idle" })
  const currentId = useRef<string | null>(null)
  // Lo que se ve del archivo mientras se arrastra (cuántos y de qué tipo; nunca nombre ni peso).
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null)
  // Zona de cancelar: mientras el archivo está encima de ella, soltarlo NO lo sube. La bandera vive en una referencia (la lee `onDrop` en el mismo instante en que se suelta) y se refleja en el estado para pintar la zona.
  const cancelRef = useRef(false)
  const [overCancel, setOverCancel] = useState(false)
  const setCancel = useCallback((v: boolean) => {
    cancelRef.current = v
    setOverCancel(v)
  }, [])

  const removeStored = useCallback(async () => {
    const id = currentId.current
    currentId.current = null
    if (id) await fetch(`/api/upload?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {})
  }, [])

  const upload = useCallback(
    async (file: File) => {
      const invalid = validateFile(file)
      if (invalid) {
        setState({ status: "error", message: invalid })
        onChange?.(null)
        return
      }
      setState({ status: "uploading", name: file.name, size: file.size, type: file.type, progress: 0 })
      try {
        const saved = await sendFile(file, (progress) => setState({ status: "uploading", name: file.name, size: file.size, type: file.type, progress }))
        await removeStored() // reemplazo: borra el anterior
        currentId.current = saved.id
        setState({ status: "ready", file: saved })
        onChange?.(saved)
      } catch (e) {
        setState({ status: "error", message: (e as Error).message })
        onChange?.(null)
      }
    },
    [onChange, removeStored],
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPT,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: false,
    noClick: true, // la página no es clicable: se arrastra y suelta, o se usa el botón del ícono (`open`)
    noKeyboard: true,
    onDragEnter: (e) => setDragInfo(describeDrag((e as unknown as DragEvent).dataTransfer?.items)),
    onDragOver: (e) => setDragInfo((cur) => cur ?? describeDrag((e as unknown as DragEvent).dataTransfer?.items)),
    onDragLeave: () => setDragInfo(null),
    onDrop: () => setDragInfo(null),
    disabled: disabled || state.status === "uploading",
    onDropAccepted: (files) => {
      if (cancelRef.current) {
        setCancel(false)
        onCancelDrop?.()
        return
      }
      void upload(files[0])
    },
    onDropRejected: (rejections) => {
      if (cancelRef.current) {
        setCancel(false)
        onCancelDrop?.()
        return
      }
      setState({ status: "error", message: rejectionMessage(rejections[0]) })
      onChange?.(null)
    },
  })

  return {
    state,
    isDragActive,
    /** Qué se ve del archivo que se está arrastrando (antes de soltar); null si el navegador no lo dice. */
    dragInfo,
    /** ¿El archivo que se arrastra está sobre la zona de cancelar? */
    overCancel,
    /** Props de la zona de cancelar (un elemento DENTRO de la zona de soltar): al soltar el archivo encima no se sube nada. Sus hijos deben ser `pointer-events-none` para que sea un solo blanco. */
    cancelZoneProps: {
      onDragEnter: (e: React.DragEvent) => {
        e.preventDefault()
        setCancel(true)
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        if (!cancelRef.current) setCancel(true)
      },
      onDragLeave: () => setCancel(false),
    },
    /** Props del contenedor que actúa como zona de soltar. */
    rootProps: getRootProps(),
    /** Abre el selector de archivos (para un botón explícito; la página en sí no es clicable). */
    open,
    /** Entrada oculta de archivo: colócala dentro del contenedor. */
    inputProps: getInputProps(),
  }
}
