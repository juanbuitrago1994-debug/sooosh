/**
 * Listas de palabras (es/en) del motor de palabras clave.
 * - SOFT: conectores que pueden ir DENTRO de una frase ("gestión de proyectos").
 * - HARD: cortan la frase ("react y typescript" son dos términos).
 * - GENERIC: palabras de relleno de las ofertas que no son competencias; también cortan.
 */
export const SOFT = new Set(["de", "del", "of"])

export const HARD = new Set(
  `el la los las un una unos unas y e o u ni a al ante con contra en entre hacia hasta para por segun sin sobre tras que como cuando donde
   se su sus tu tus nuestro nuestra nuestros nuestras lo le les es son ser estar ha han mas muy no si ya tambien otros otras otro otra este esta estos estas ese esa
   tener tendras tendra buscamos busca ofrecemos unirte unirse
   the an and or to in on at for with by from as is are be been this that these those you your we our will can may must should have has having using use used into over under per
   ad hoc etc incluye incluyendo including such also not no yo`.split(/\s+/),
)

export const GENERIC = new Set(
  `experiencia experiencias experience years year anos ano dominio conocimiento conocimientos manejo capacidad capacidades habilidad habilidades skills skill
   nivel avanzado avanzada advanced intermedio basico solido solidos fuerte excelente buen buena bueno good strong excellent proven deseable valorable valora valoran plus minimo minimos previa previo
   similar similares afin afines tecnico tecnicos tecnica tecnicas empresa puesto persona personas area areas funciones funcion responsabilidades responsabilidad requisitos requisito
   ability knowledge working work role position candidate candidates ideal requirements responsibilities nice have estudios formacion titulo
   nociones nocion resultados resultado equipo equipos team teams results existente existentes solicitado solicitados solicitada solicitadas semanal semanales mensual mensuales diario diarios
   actual actuales relevante relevantes nuevo nuevos nueva nuevas new existing weekly monthly daily
   y/o and/or etc`.split(/\s+/),
)

/** Niveles del MCER (A1…C2): no son términos del CV. */
export const CEFR = /^[abc][12]$/

/**
 * Infinitivos frecuentes en ofertas ("Preparar reportes"): no son competencias y se quitan del inicio de una frase.
 * Es una lista explícita (no una regla por terminación) para no romper "Angular", "Developer" o "Docker".
 */
export const VERBS = new Set(
  `preparar mantener apoyar desarrollar disenar implementar gestionar coordinar analizar elaborar realizar participar colaborar liderar administrar documentar
   supervisar asegurar garantizar construir crear mejorar optimizar monitorear comunicar atender resolver planificar ejecutar proponer identificar generar revisar
   automatizar integrar evaluar definir impulsar contribuir trabajar redactar controlar manejar ofrecer brindar dar asistir capacitar formar reportar`.split(/\s+/),
)
