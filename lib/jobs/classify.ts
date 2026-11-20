import { fold } from "@/lib/keywords/normalize"

/**
 * Familia de cargo de una oferta, SIN IA: reglas sobre el título (lo más específico) y, si el título no alcanza, sobre el área que la
 * fuente declara («Engineering», «Design / UX»…) y las habilidades de la oferta. La IA entra después solo para lo ambiguo (ver docs/PLAN-IA.md).
 * `tecnologia` = cualquiera de las familias técnicas: es lo que activa el filtro «Tecnología» del buscador.
 */
export const FAMILIES = {
  desarrollo: "Desarrollo de software",
  datos: "Datos e IA",
  "diseno-digital": "Diseño digital (UX/UI, producto)",
  producto: "Producto",
  infraestructura: "Infraestructura y nube",
  calidad: "Calidad (QA)",
  seguridad: "Seguridad informática",
  "gestion-ti": "Gestión de tecnología",
  "soporte-ti": "Soporte TI",
  "consultoria-ti": "Consultoría TI y ERP",
  ventas: "Ventas y negocios",
  marketing: "Marketing y comunicación",
  finanzas: "Finanzas y contabilidad",
  operaciones: "Operaciones y logística",
  rrhh: "Personas y talento",
  atencion: "Atención al cliente",
  administracion: "Administración",
  legal: "Legal y cumplimiento",
  otros: "Otros",
} as const
export type Family = keyof typeof FAMILIES

export const TECH_FAMILIES: ReadonlySet<Family> = new Set<Family>(["desarrollo", "datos", "diseno-digital", "producto", "infraestructura", "calidad", "seguridad", "gestion-ti", "soporte-ti", "consultoria-ti"])
export const isTechFamily = (f: Family | null | undefined): boolean => !!f && TECH_FAMILIES.has(f)

const r = (s: string) => new RegExp(s)

/** Reglas en orden: gana la primera que coincide. Se aplican al título sin tildes ni mayúsculas. */
const TITLE_RULES: [Family, RegExp][] = [
  // «sales engineer» y similares son ventas, no desarrollo
  ["ventas", r("\\b(sales|pre-?sales|ventas|vendas) ?(engineer|ingenier)|\\b(solutions?|sales) engineer\\b(?!.*(software|data))")],
  // diseño gráfico, de marca y de moda no es tecnología
  ["marketing", r("\\b(brand|graphic|grafico|grafica|visual communication|motion|packaging|moda|interiores)\\b.*\\b(design|disen)|\\bdisenador(a)? (grafic|de marca|de moda|industrial|de interiores)|\\bdiseno grafico|\\bbrand design")],
  ["seguridad", r("\\b(cyber|ciberseguridad|seguridad (de la |informatica|de la informacion)|infosec|appsec|pentest|ethical hack|security (engineer|analyst|architect|specialist)|soc (analyst|l\\d)|siem|secops|sec ops|grc)\\b")],
  ["calidad", r("\\b(qa|quality assurance|tester|testing|sdet|atqc|test automation|automation (engineer|tester|framework)|analista de pruebas|ingeniero de pruebas|control de calidad de software)\\b")],
  ["datos", r("\\b(data|datos)\\b.*\\b(analyst|scientist|engineer|engineering|architect|steward|governance|analytics|ops|analista|cientifico|ingenier[oa]|arquitect[oa]|especialista|operational)|\\b(analista|ingenier[oa]|especialista|cientifico|arquitect[oa]|scientist|engineer|analyst) (de |en |of |in )?(data|datos|big data|bi\\b|business intelligence|machine learning|ia\\b|ai\\b)|\\bmachine learning\\b|\\bml (engineer|ops)\\b|\\b(ai|ia|llm)[- ](native )?(engineer|ingenier|developer)|\\bcientista de (dados|datos)\\b|\\bdata consultant\\b|\\bcientifico de datos\\b|\\binteligencia artificial\\b|\\bciencia de datos\\b|\\bbig data\\b|\\bbusiness intelligence\\b|\\banalytics engineer\\b|\\bbi (developer|analyst|analista)\\b|\\betl\\b")],
  ["diseno-digital", r("\\b(ux|ui)\\b|\\bproduct design|\\bdesign systems?\\b|\\bdiseno (ux|ui|de producto|de interfaz|de interfaces|digital|web)|\\bdisenador(a)? (ux|ui|de producto|web|digital|de interfaz|de experiencia)|\\bux (research|writer|designer)|\\binteraction design|\\buser research|\\bresearcher\\b|\\bdesigner\\b")],
  ["infraestructura", r("\\b(devops|devsecops|sre|site reliability|cloud|infraestructura|infrastructure|platform engineer|sysadmin|administrador(a)? de (sistemas|redes|bases de datos|plataforma)|dba|network|redes|wireless|telecom|telecomunicaciones|kubernetes|systems? (engineer|administrator)|ingenier[oa] de (sistemas|redes|plataforma))\\b")],
  ["soporte-ti", r("\\b(it support|soporte (tecnico|ti|informatico|n[123]|de aplicaciones|y adopcion)|help ?desk|mesa de ayuda|service desk|it analyst|analista (de )?(ti|it)|servicio ti|soporte (y )?hardware|analista de soporte (y )?hardware|tecnico (en )?(soporte|informatic|computacion|sistemas)|ingeniero de soporte|support engineer|technical support)\\b")],
  ["producto", r("\\b(product (manager|owner|lead|analyst|operations|ops|builder|business analyst|execution|specialist)|gerente de producto|jefe de producto|head of product|chief product|po\\b|product management)\\b")],
  ["consultoria-ti", r("\\bsap\\b|\\b(mulesoft|outsystems|middleware|boomi|tibco)\\b|\\b(erp|oracle|salesforce|dynamics|servicenow|workday|netsuite)\\b.*\\b(consult|especialista|analista|developer|abap|functional|funcional|jefe|lider|architect)|\\b(consultor|consultant|especialista|analista|jefe|lider) (de )?(sap|erp|oracle|salesforce|dynamics|servicenow|workday|netsuite)\\b|\\b(jefe|gerente|lider|coordinador|director)\\b.*\\b(sap|erp|oracle|salesforce|dynamics|servicenow|workday|netsuite)\\b|\\bsoluciones (ti|tecnologicas|de tecnologia)\\b|\\bconsultor(a)? (ti|de sistemas|tecnologico)")],
  ["desarrollo", r("\\b(developers?|desarrolladores|desarrolladora|desarrollador|sw|programador(a)?|software|front[- ]?end|back[- ]?end|full[- ]?stack|fullstack|mobile (developer|engineer)|android|ios|web developer|arquitect[oa] de (software|soluciones|sistemas|ti|datos)|iot|embedded|firmware|ingenier[oa] (de )?(software|desarrollo)|analista (programador|desarrollador|de sistemas|funcional ti)|devs?|ingeniero full|lider tecnico|tech lead|technical lead|node\\.?js|react|java|python|\\.net|php|golang|laravel|django|angular|vue)\\b")],
  ["gestion-ti", r("\\b(scrum master|agile coach|engineering manager|engineering (director|lead)|director(a)? (of|de) (engineering|ingenieria)|vp (of )?engineering|head of engineering|cto|chief technology|director(a)? de tecnologia|gerente de (tecnologia|ti|sistemas|desarrollo|ingenieria)|jefe de (tecnologia|ti|sistemas|desarrollo)|delivery manager|it manager|it director|technology manager)\\b")],
  ["legal", r("\\b(legal|abogad|juridic|lawyer|attorney|counsel|compliance|cumplimiento normativo|privacy)\\b")],
  ["ventas", r("\\b(sales|ventas|vendas|vendedor|vendedora|comercial|account (executive|manager)|kam|key account|sdr|bdr|business development|desarrollo de negocios|ejecutiv[oa] de (cuentas|negocios|ventas|onboarding)|gtm|partnerships?|growth sales|asesor(a)? (comercial|de ventas)|consultor(a)? de vendas|corretor)\\b")],
  ["marketing", r("\\b(marketing|seo|sem|sea|content|contenido|community manager|social media|brand|branding|growth|\\bpr\\b|relaciones publicas|comunicacion|comunicaciones|e-?commerce|publicidad|copywriter|media buyer|performance|crm marketing|influencer|eventos|events|trade marketing|growth & e-commerce)\\b")],
  ["finanzas", r("\\b(financ|contab|contador|contadora|accountant|accounting|tesorer|treasury|auditor|audit|controller|payroll|nomina|cobranza|recaudacion|credit|credito|riesgo|risk|fraud|fraude|tax|impuestos|fiscal|billing|facturacion|cuentas por|finance|financial|control de gestion|planeamiento financiero|fp&a)\\w*")],
  ["rrhh", r("\\b(recursos humanos|rrhh|hr|human resources|talent|talento|reclutador|recruiter|recruiting|people|seleccion|capacitacion|training|treinamento|compensaciones|bienestar|employer branding)\\b")],
  ["atencion", r("\\b(customer (service|support|experience|success|care)|atencion al cliente|servicio al cliente|contact center|call center|agente de (contact|atencion|servicio)|cx|experiencia del cliente|soporte al cliente|asesor(a)? de servicio)\\b")],
  ["operaciones", r("\\b(operations?|operaciones|logistic\\w*|supply|almacen|bodega|warehouse|operari[oa]|conductor|driver|rider|reparto|planta|produccion|mantenimiento|procesos|process|lean|cadena|compras|procurement|purchasing|inventari\\w*|despacho|transport\\w*|jefe de proyecto|project manager|gerente de proyecto|implementacion)\\b")],
  ["administracion", r("\\b(administrativ[oa]|asistente|secretari[oa]|recepcion\\w*|office|data entry|digitador|auxiliar|asesor(a)? educativ)\\b")],
]

/** Área que declara la fuente (Get on Board, ATS) → familia; solo se usa si el título no decidió. */
const DEPARTMENT_RULES: [Family, RegExp][] = [
  ["seguridad", r("cyber|security|seguridad")],
  ["calidad", r("\\bqa\\b|quality|testing|calidad")],
  ["datos", r("data|machine learning|\\bai\\b|analytics|datos|bi\\b")],
  ["diseno-digital", r("design|diseno|\\bux\\b")],
  ["infraestructura", r("devops|sysadmin|infrastructure|infraestructura|platform|\\bit ops|network")],
  ["soporte-ti", r("\\bit\\b|help ?desk|it support|tecnologia de la informacion")],
  ["producto", r("\\bproduct\\b|producto")],
  ["desarrollo", r("engineering|programming|software|development|desarrollo|ingenieria|technology|tecnologia|\\btech\\b|r&d")],
  ["ventas", r("sales|ventas|business development|partnerships|account")],
  ["marketing", r("marketing|brand|communications|comunicacion|content")],
  ["finanzas", r("financ|accounting|contab|treasury|legal & finance")],
  ["rrhh", r("people|human resources|\\bhr\\b|talent|recursos humanos")],
  ["atencion", r("customer|support|atencion|\\bcx\\b|success")],
  ["legal", r("legal|compliance")],
  ["operaciones", r("operations|operaciones|logistic|supply")],
]

const TECH_SKILLS = 2

/** Ingenierías que no son de tecnología: no pasan por el respaldo de «engineer». */
const OTHER_ENGINEERING = r("\\b(industrial|civil|quimic|mecanic|electric|electronic|mining|minas|agronom|ambiental|petrol|construccion|biomedic|alimentos|procesos)\\b")

export type Classification = { family: Family; tech: boolean; basis: "titulo" | "area" | "habilidades" | "ninguna" }

export function classifyRole(input: { title: string; department?: string | null; skills?: string[] }): Classification {
  // «Arquitecto/a», «Jefe(a)»: se quitan las marcas de género para que las reglas vean la palabra completa.
  const title = fold(input.title).replace(/\(a\)|\(o\)|\/a\b|\/o\b/g, "")
  for (const [family, re] of TITLE_RULES) if (re.test(title)) return { family, tech: isTechFamily(family), basis: "titulo" }
  // «Ingeniero/Engineer» genérico: tecnología solo si hay otra señal (área o varias habilidades técnicas) y no es otra ingeniería.
  const dept = input.department ? fold(input.department) : ""
  const generic = /\b(engineer|ingenier[oa]|arquitect[oa]|analista|specialist|especialista|consultor\w*|lead|lider)\b/.test(title) && !OTHER_ENGINEERING.test(title)
  const deptFamily = dept ? DEPARTMENT_RULES.find(([, re]) => re.test(dept))?.[0] : undefined
  if (deptFamily) return { family: deptFamily, tech: isTechFamily(deptFamily), basis: "area" }
  if (generic && (input.skills?.length ?? 0) >= TECH_SKILLS && /\b(engineer|ingenier[oa]|developer)\b/.test(title)) return { family: "desarrollo", tech: true, basis: "habilidades" }
  return { family: "otros", tech: false, basis: "ninguna" }
}
