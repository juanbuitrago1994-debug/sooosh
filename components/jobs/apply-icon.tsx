import { ExternalLinkIcon, FileTextIcon, GlobeIcon, LinkIcon, MailIcon } from "lucide-react"
import type { Apply } from "@/lib/jobs/apply"

/** Ícono del camino de postulación (decorativo: el texto lo dice). */
export function ApplyIcon({ method, className }: { method?: Apply["method"]; className?: string }) {
  const Icon = method === "plataforma" ? GlobeIcon : method === "formulario" ? FileTextIcon : method === "correo" ? MailIcon : method === "sitio" ? LinkIcon : ExternalLinkIcon
  return <Icon className={className} aria-hidden />
}
