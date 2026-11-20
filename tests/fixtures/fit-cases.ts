import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"

/** Conjunto de referencia del motor de fit (K4): una oferta y tres CV (fuerte, medio, débil). */
export const NOW = new Date(2026, 10, 18)
export const offer: Offer = {
  title: "Analista de Datos Senior",
  language: "es",
  seniority: "senior",
  yearsExperience: { min: 3 },
  requirements: ["Mínimo 3 años de experiencia en SQL y Python", "Dominio de Power BI para construir dashboards", "Licenciatura en Ingeniería de Sistemas o afines", "Comunicación efectiva con stakeholders"],
  niceToHave: ["Conocimientos de Airflow"],
  responsibilities: ["Mantener pipelines ETL"],
  tools: ["SQL", "Python", "Power BI"],
  softSkills: ["Comunicación"],
}

export const strong: CV = {
  header: { fullName: "Ana Torres", headline: "Analista de Datos Senior", email: "ana@mail.com", phone: "999", location: "Lima", links: [] },
  summary: "Analista de datos con 6 años de experiencia en SQL, Python y Power BI. Construyo dashboards que aceleran decisiones comerciales.",
  experience: [
    { company: "Globex", role: "Analista de Datos Sr", startDate: "Mar 2022", endDate: "Actual", bullets: ["Reduje 40% el tiempo de reporte con SQL y Python", "Construí 12 dashboards en Power BI para el equipo comercial", "Comuniqué hallazgos a stakeholders de 5 áreas", "Mantuve pipelines ETL en Airflow"] },
    { company: "Initech", role: "Analista de Datos", startDate: "Ene 2019", endDate: "Feb 2022", bullets: ["Automaticé 30 reportes con Python", "Diseñé modelos de datos en SQL"] },
  ],
  education: [{ institution: "UNI", degree: "Ingeniería de Sistemas", field: "", startDate: "2012", endDate: "2017", details: [] }],
  skills: [{ category: "Datos", items: ["SQL", "Python", "Power BI", "Airflow"] }],
  languages: [{ name: "Inglés", level: "B2" }],
  projects: [],
}
export const mid: CV = {
  header: { fullName: "Luis Pérez", email: "luis@mail.com", phone: "888", links: [] },
  summary: "Persona proactiva y dinámica con experiencia en análisis.",
  experience: [{ company: "Acme", role: "Analista", startDate: "Ene 2022", endDate: "Actual", bullets: ["Responsable de reportes en Excel", "Preparé tableros en Tableau", "Usé SQL para consultas básicas"] }],
  education: [{ institution: "UPC", degree: "Administración", field: "", startDate: "2015", endDate: "2019", details: [] }],
  skills: [{ items: ["Excel", "SQL", "Tableau"] }],
  languages: [],
  projects: [],
}
export const weak: CV = {
  header: { fullName: "Eva Ruiz", links: [] },
  experience: [{ company: "Tienda", role: "Vendedora", startDate: "", endDate: "", bullets: ["Atención al cliente en tienda"] }],
  education: [],
  skills: [{ items: ["Word"] }],
  languages: [],
  projects: [],
}

