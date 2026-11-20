export const STEPS = [
  { id: "perfil", label: "Perfil", description: "Sube tu CV actual" },
  { id: "oferta", label: "Oferta", description: "Pega la oferta de trabajo" },
  { id: "analisis", label: "Análisis", description: "Compara tu perfil con la oferta" },
  { id: "revision", label: "Revisión", description: "Revisa y ajusta los cambios" },
  { id: "exportar", label: "Exportar", description: "Descarga tu CV adaptado" },
] as const

export type StepId = (typeof STEPS)[number]["id"]
