/**
 * Reglas del verificador ATS. Espejo en código de docs/CONOCIMIENTO-ATS.md §3 (una prueba comprueba que ids y pesos coinciden).
 * Peso: C crítica (5 puntos), A alta (3), M media (2), B baja (1). Confianza: de las fuentes (Alta = ≥ 3 coinciden; Baja = una sola fuente o síntesis).
 */
export type Weight = "C" | "A" | "M" | "B"
export type Confidence = "Alta" | "Media" | "Baja"
export type RuleGroup = "archivo" | "tipografía" | "secciones" | "contacto" | "experiencia" | "contenido"

export type RuleDef = { id: string; group: RuleGroup; title: string; weight: Weight; confidence: Confidence; fix: string }
export const WEIGHT_POINTS: Record<Weight, number> = { C: 5, A: 3, M: 2, B: 1 }

export const ATS_RULES: RuleDef[] = [
  { id: "ATS-F1", group: "archivo", title: "El archivo tiene texto seleccionable", weight: "C", confidence: "Alta", fix: "Genera el archivo desde el texto, no desde una imagen ni un escaneo." },
  { id: "ATS-F2", group: "archivo", title: "Formato permitido (PDF con texto o Word .docx)", weight: "C", confidence: "Alta", fix: "Descarga la versión en PDF o en Word (.docx)." },
  { id: "ATS-F3", group: "archivo", title: "Una sola columna, en orden de lectura", weight: "C", confidence: "Alta", fix: "Quita columnas y barras laterales: todo el contenido en una sola columna." },
  { id: "ATS-F4", group: "archivo", title: "Sin tablas, cuadros de texto, imágenes ni íconos", weight: "C", confidence: "Alta", fix: "Quita tablas, cuadros de texto, imágenes, íconos y barras de nivel." },
  { id: "ATS-F5", group: "archivo", title: "Contacto en el cuerpo, no en encabezado ni pie", weight: "C", confidence: "Alta", fix: "Mueve nombre, correo y teléfono al cuerpo del documento." },
  { id: "ATS-F6", group: "archivo", title: "1–2 páginas, sin encoger fuente ni márgenes", weight: "M", confidence: "Media", fix: "Resume el contenido para que quepa en 2 páginas sin reducir tamaños." },
  { id: "ATS-F7", group: "archivo", title: "Nombre de archivo profesional (Nombre-Apellido-Cargo)", weight: "B", confidence: "Media", fix: "Nombra el archivo «Nombre-Apellido-Cargo», sin espacios ni símbolos." },
  { id: "ATS-F8", group: "archivo", title: "El archivo pesa menos de 2,5 MB", weight: "M", confidence: "Baja", fix: "Reduce el tamaño del archivo: no incrustes imágenes ni fuentes extra." },
  { id: "ATS-T1", group: "tipografía", title: "Una sola fuente estándar (Arial, Calibri o Times New Roman)", weight: "A", confidence: "Alta", fix: "Usa solo Arial, Calibri o Times New Roman en todo el documento." },
  { id: "ATS-T2", group: "tipografía", title: "Cuerpo entre 10 y 12 pt, nada menor a 10 pt", weight: "A", confidence: "Alta", fix: "Usa 10–12 pt en el cuerpo y no bajes de 10 pt en ningún texto." },
  { id: "ATS-T3", group: "tipografía", title: "Márgenes entre 1,25 y 2,5 cm", weight: "M", confidence: "Media", fix: "Deja márgenes de 1,25 a 2,5 cm en los cuatro lados." },
  { id: "ATS-T4", group: "tipografía", title: "Texto negro sobre fondo blanco, sin sombreados", weight: "M", confidence: "Baja", fix: "Usa texto negro sobre blanco, sin colores ni sombreados." },
  { id: "ATS-T5", group: "tipografía", title: "Títulos solo en negrita o mayúsculas, sin espaciado entre letras", weight: "B", confidence: "Media", fix: "Destaca los títulos solo con negrita; quita el espaciado entre letras." },
  { id: "ATS-T6", group: "tipografía", title: "Espacio en blanco entre secciones", weight: "B", confidence: "Baja", fix: "Deja más espacio antes de cada título de sección." },
  { id: "ATS-S1", group: "secciones", title: "Títulos de sección convencionales", weight: "C", confidence: "Alta", fix: "Usa títulos estándar: Experiencia laboral, Educación, Habilidades…" },
  { id: "ATS-S2", group: "secciones", title: "Están Experiencia, Educación y Habilidades (si el CV las tiene)", weight: "A", confidence: "Alta", fix: "Agrega la sección que falta con su título estándar." },
  { id: "ATS-S3", group: "secciones", title: "Resumen de 2–4 frases y hasta ~4 líneas", weight: "M", confidence: "Media", fix: "Acorta el resumen a 2–4 frases (unas 4 líneas)." },
  { id: "ATS-S4", group: "secciones", title: "Experiencia en orden cronológico inverso", weight: "A", confidence: "Alta", fix: "Ordena los puestos del más reciente al más antiguo." },
  { id: "ATS-S5", group: "secciones", title: "Orden de secciones recomendado", weight: "B", confidence: "Baja", fix: "Orden: Resumen, Experiencia, Educación y Habilidades, y al final Idiomas y Proyectos." },
  { id: "ATS-S6", group: "secciones", title: "Ningún título de sección repetido", weight: "B", confidence: "Baja", fix: "Une las secciones repetidas en una sola." },
  { id: "ATS-K1", group: "contacto", title: "Primera línea: nombre completo", weight: "C", confidence: "Alta", fix: "Pon tu nombre completo, en texto, en la primera línea." },
  { id: "ATS-K2", group: "contacto", title: "Línea de contacto con «|» entre las primeras líneas", weight: "A", confidence: "Alta", fix: "Escribe «Ciudad | Teléfono | Correo | Enlaces» en una línea bajo tu nombre." },
  { id: "ATS-K3", group: "contacto", title: "Correo válido, escrito como texto", weight: "A", confidence: "Media", fix: "Escribe tu correo como texto, no como ícono ni imagen." },
  { id: "ATS-K4", group: "contacto", title: "Enlaces (LinkedIn, portafolio) como URL en texto", weight: "B", confidence: "Media", fix: "Escribe las URL completas como texto." },
  { id: "ATS-K5", group: "contacto", title: "Sin foto ni datos personales sensibles", weight: "M", confidence: "Baja", fix: "Quita la foto y datos como fecha de nacimiento, estado civil o nacionalidad." },
  { id: "ATS-E1", group: "experiencia", title: "Cada puesto: Cargo — Empresa, Ciudad | fechas", weight: "A", confidence: "Alta", fix: "Escribe cada puesto como «Cargo — Empresa, Ciudad | Mes Año – Mes Año»." },
  { id: "ATS-E2", group: "experiencia", title: "Un solo formato de fecha en todo el documento", weight: "A", confidence: "Media", fix: "Usa el mismo formato de fecha en todas partes (no mezcles «Marzo 2021» con «03/2021»)." },
  { id: "ATS-E3", group: "experiencia", title: "Rangos con guion largo y con mes cuando el CV lo trae", weight: "M", confidence: "Baja", fix: "Usa «–» entre fechas e incluye el mes si lo tienes." },
  { id: "ATS-E4", group: "experiencia", title: "Viñetas simples (• o –)", weight: "A", confidence: "Media", fix: "Usa solo «•» o «–» como viñetas." },
  { id: "ATS-E5", group: "experiencia", title: "Viñetas con verbo de acción y de hasta ~25 palabras", weight: "M", confidence: "Baja", fix: "Empieza cada viñeta con un verbo de acción y acórtala a ~25 palabras." },
  { id: "ATS-E6", group: "experiencia", title: "Entre 1 y 6 viñetas por puesto", weight: "B", confidence: "Baja", fix: "Deja entre 1 y 6 viñetas por puesto." },
  { id: "ATS-E7", group: "experiencia", title: "Educación: Título — Institución | fecha", weight: "M", confidence: "Media", fix: "Escribe cada estudio como «Título — Institución | Mes Año»." },
  { id: "ATS-E8", group: "experiencia", title: "Habilidades en texto plano, sin niveles ni barras", weight: "A", confidence: "Media", fix: "Lista las habilidades separadas por comas, sin porcentajes, estrellas ni niveles." },
  { id: "ATS-E9", group: "experiencia", title: "Siglas con su forma completa (si el CV la trae)", weight: "B", confidence: "Media", fix: "Escribe la sigla con su nombre completo al menos una vez." },
  { id: "ATS-E10", group: "experiencia", title: "Cargos sin abreviaturas (Sr., Jr., Ssr.)", weight: "M", confidence: "Media", fix: "Escribe los cargos completos: Senior, Junior, Semi Senior." },
  { id: "ATS-I1", group: "contenido", title: "Nada inventado: todo sale del CV original", weight: "C", confidence: "Alta", fix: "Quita lo que no esté en tu CV original." },
  { id: "ATS-I2", group: "contenido", title: "Nada omitido: puestos, estudios, viñetas y habilidades están", weight: "A", confidence: "Alta", fix: "Vuelve a incluir lo que falta de tu CV original." },
  { id: "ATS-I3", group: "contenido", title: "Sin relleno de palabras clave", weight: "M", confidence: "Media", fix: "No repitas la misma palabra más de 4 veces en el resumen y las habilidades." },
  { id: "ATS-I4", group: "contenido", title: "Sin frases vagas de moda sin evidencia", weight: "B", confidence: "Baja", fix: "Cambia «proactivo», «apasionado»… por un resultado concreto." },
  { id: "ATS-I5", group: "contenido", title: "Mismo idioma que el CV original, también en los títulos", weight: "A", confidence: "Alta", fix: "Usa los títulos de sección en el idioma de tu CV." },
]

export const RULE_BY_ID = new Map(ATS_RULES.map((r) => [r.id, r]))
