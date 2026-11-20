"use client"

import { useCallback, useRef, useState } from "react"
import { useDropzone, type FileRejection } from "react-dropzone"
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
  | { status: "uploading"; name: string; progress: number }
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
export function useCvDropzone({ onChange, disabled }: { onChange?: (file: UploadedFile | null) => void; disabled?: boolean }) {
  const [state, setState] = useState<DropState>({ status: "idle" })
  const currentId = useRef<string | null>(null)

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
      setState({ status: "uploading", name: file.name, progress: 0 })
      try {
        const saved = await sendFile(file, (progress) => setState({ status: "uploading", name: file.name, progress }))
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPT,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: false,
    noClick: true, // solo se admite arrastrar y soltar
    noKeyboard: true,
    disabled: disabled || state.status === "uploading",
    onDropAccepted: (files) => void upload(files[0]),
    onDropRejected: (rejections) => {
      setState({ status: "error", message: rejectionMessage(rejections[0]) })
      onChange?.(null)
    },
  })

  return {
    state,
    isDragActive,
    /** Props del contenedor que actúa como zona de soltar. */
    rootProps: getRootProps(),
    /** Entrada oculta de archivo: colócala dentro del contenedor. */
    inputProps: getInputProps(),
  }
}
