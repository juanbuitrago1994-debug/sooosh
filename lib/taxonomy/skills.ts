/**
 * Taxonomía local de habilidades (Fase K2). Semilla CURADA a mano, offline y de costo cero: no es una importación de ESCO ni de
 * O*NET (esas bases son grandes y requieren descarga y atribución; el formato admite cargarlas después sin cambiar el código).
 * Cada entrada: id estable, nombre canónico, categoría y alias (es/en) que se comparan sin tildes ni mayúsculas.
 * Regla anti-invención: la taxonomía solo NORMALIZA lo que la oferta ya dice; nunca añade habilidades que la oferta no nombra.
 */
export type SkillCategory = "tool" | "tech" | "soft" | "cert" | "domain"
export type Skill = { id: string; label: string; category: SkillCategory; aliases: string[] }

const t = (id: string, label: string, ...aliases: string[]): Skill => ({ id, label, category: "tool", aliases: [label, ...aliases] })
const k = (id: string, label: string, ...aliases: string[]): Skill => ({ id, label, category: "tech", aliases: [label, ...aliases] })
const s = (id: string, label: string, ...aliases: string[]): Skill => ({ id, label, category: "soft", aliases: [label, ...aliases] })
const c = (id: string, label: string, ...aliases: string[]): Skill => ({ id, label, category: "cert", aliases: [label, ...aliases] })
const d = (id: string, label: string, ...aliases: string[]): Skill => ({ id, label, category: "domain", aliases: [label, ...aliases] })

export const TAXONOMY_VERSION = 1

export const SKILLS: Skill[] = [
  // Herramientas y tecnologías
  t("sql", "SQL", "t-sql", "mysql", "postgresql", "postgres", "sql server", "consultas sql"),
  t("python", "Python"), t("javascript", "JavaScript", "js", "ecmascript"), t("typescript", "TypeScript", "ts"),
  t("java", "Java"), t("csharp", "C#", "c sharp"), t("cpp", "C++"), t("go", "Golang"), t("php", "PHP"), t("ruby", "Ruby", "ruby on rails", "rails"), t("rust", "Rust"),
  t("r-lang", "R", "lenguaje r", "rstudio", "r studio"), t("scala", "Scala"), t("kotlin", "Kotlin"), t("swift", "Swift"),
  t("react", "React", "react.js", "reactjs"), t("angular", "Angular"), t("vue", "Vue", "vue.js", "vuejs"), t("nextjs", "Next.js", "nextjs"),
  t("node", "Node.js", "nodejs", "node"), t("django", "Django"), t("flask", "Flask"), t("spring", "Spring Boot", "spring framework"), t("dotnet", ".NET", "dotnet", "asp.net"),
  t("html-css", "HTML/CSS", "html", "css", "html5", "css3"), t("tailwind", "Tailwind CSS", "tailwind"),
  t("excel", "Excel", "microsoft excel", "ms excel", "hojas de calculo", "tablas dinamicas"),
  t("power-bi", "Power BI", "powerbi"), t("tableau", "Tableau"), t("looker", "Looker", "looker studio", "data studio"),
  t("sheets", "Google Sheets", "hojas de calculo de google"), t("office", "Microsoft Office", "ms office", "office 365", "paquete office"),
  t("aws", "AWS", "amazon web services"), t("azure", "Azure", "microsoft azure"), t("gcp", "Google Cloud", "gcp", "google cloud platform"),
  t("docker", "Docker"), t("kubernetes", "Kubernetes", "k8s"), t("terraform", "Terraform"), t("git", "Git", "github", "gitlab", "bitbucket"),
  t("ci-cd", "CI/CD", "integracion continua", "despliegue continuo", "jenkins", "github actions"),
  t("linux", "Linux"), t("mongodb", "MongoDB"), t("redis", "Redis"), t("kafka", "Kafka"), t("spark", "Spark", "apache spark", "pyspark"), t("airflow", "Airflow", "apache airflow"),
  t("dbt", "dbt"), t("snowflake", "Snowflake"), t("bigquery", "BigQuery"), t("pandas", "Pandas"), t("numpy", "NumPy"), t("sklearn", "scikit-learn", "sklearn"),
  t("tensorflow", "TensorFlow"), t("pytorch", "PyTorch"),
  t("jira", "Jira"), t("confluence", "Confluence"), t("notion", "Notion"), t("slack", "Slack"), t("figma", "Figma"), t("sketch", "Sketch"),
  t("photoshop", "Photoshop", "adobe photoshop"), t("illustrator", "Illustrator", "adobe illustrator"), t("canva", "Canva"),
  t("sap", "SAP"), t("salesforce", "Salesforce"), t("hubspot", "HubSpot"), t("zendesk", "Zendesk"), t("odoo", "Odoo"), t("quickbooks", "QuickBooks"),
  t("google-analytics", "Google Analytics", "ga4"), t("google-ads", "Google Ads", "adwords"), t("meta-ads", "Meta Ads", "facebook ads", "instagram ads"), t("seo-tools", "SEMrush", "ahrefs"),
  t("shopify", "Shopify"), t("wordpress", "WordPress"), t("autocad", "AutoCAD"), t("matlab", "MATLAB"), t("spss", "SPSS"), t("stata", "Stata"),
  // Conocimientos técnicos y de oficio
  k("data-analysis", "Análisis de datos", "data analysis", "analisis de datos", "analitica de datos", "analytics"),
  k("data-viz", "Visualización de datos", "data visualization", "dashboards", "tableros", "cuadros de mando"),
  k("etl", "ETL", "pipelines de datos", "data pipelines", "ingenieria de datos", "data engineering"),
  k("ml", "Machine learning", "aprendizaje automatico", "aprendizaje de maquina", "modelos predictivos"),
  k("statistics", "Estadística", "statistics", "estadistica", "pruebas de hipotesis", "regresion"),
  k("ab-testing", "Pruebas A/B", "a/b testing", "ab testing", "experimentacion"),
  k("api-rest", "APIs REST", "rest api", "api rest", "restful", "apis"), k("microservices", "Microservicios", "microservices"),
  k("testing", "Pruebas de software", "testing", "qa", "pruebas automatizadas", "unit testing", "pruebas unitarias"),
  k("agile", "Metodologías ágiles", "agile", "scrum", "kanban", "agil", "metodologias agiles"),
  k("project-mgmt", "Gestión de proyectos", "project management", "gestion de proyectos", "direccion de proyectos", "administracion de proyectos"),
  k("product-mgmt", "Gestión de producto", "product management", "gestion de producto", "roadmap", "product owner"),
  k("ux", "Diseño UX/UI", "ux", "ui", "ux/ui", "experiencia de usuario", "user experience", "diseno de interfaces", "investigacion de usuarios"),
  k("seo", "SEO", "posicionamiento web", "optimizacion para buscadores"), k("sem", "SEM", "publicidad en buscadores", "ppc"),
  k("digital-marketing", "Marketing digital", "digital marketing", "marketing de contenidos", "content marketing", "email marketing"),
  k("social-media", "Redes sociales", "social media", "community management", "community manager"),
  k("copywriting", "Redacción", "copywriting", "redaccion de contenidos", "redaccion"),
  k("sales", "Ventas", "sales", "venta consultiva", "prospeccion", "cierre de ventas", "negociacion comercial"),
  k("crm", "CRM", "gestion de clientes", "customer relationship management"),
  k("customer-service", "Atención al cliente", "customer service", "servicio al cliente", "soporte al cliente", "customer success", "atencion al cliente"),
  k("accounting", "Contabilidad", "accounting", "contabilidad general", "conciliaciones", "cierre contable"),
  k("finance", "Finanzas", "finance", "analisis financiero", "financial analysis", "modelado financiero", "presupuestos", "budgeting", "forecasting"),
  k("ifrs", "NIIF/IFRS", "ifrs", "niif", "gaap"), k("tax", "Impuestos", "tributacion", "tax", "declaraciones de impuestos"),
  k("payroll", "Nómina", "nomina", "payroll"), k("hr", "Recursos humanos", "human resources", "talento humano", "reclutamiento", "recruiting", "seleccion de personal"),
  k("procurement", "Compras y abastecimiento", "procurement", "compras", "abastecimiento", "negociacion con proveedores"),
  k("logistics", "Logística", "logistics", "logistica", "cadena de suministro", "supply chain", "gestion de inventarios", "inventory"),
  k("operations", "Operaciones", "operations", "mejora de procesos", "process improvement"),
  k("security", "Seguridad informática", "cybersecurity", "ciberseguridad", "seguridad de la informacion", "infosec"),
  k("networking", "Redes", "networking", "redes de computadores", "tcp/ip"), k("devops", "DevOps", "sre", "infraestructura como codigo"),
  k("compliance", "Cumplimiento normativo", "compliance", "regulatorio", "gestion de riesgos", "risk management", "auditoria", "audit"),
  k("legal", "Derecho", "contratos", "derecho laboral", "derecho corporativo"),
  k("teaching", "Docencia", "teaching", "ensenanza", "capacitacion", "training"),
  k("healthcare", "Atención clínica", "atencion clinica", "cuidado de pacientes", "patient care", "enfermeria", "nursing"),
  // Habilidades transversales
  s("communication", "Comunicación", "communication", "comunicacion efectiva", "comunicacion asertiva", "comunicacion escrita", "comunicacion oral", "comunique", "comunicar", "comunicamos"),
  s("leadership", "Liderazgo", "leadership", "liderazgo de equipos", "lead teams", "manejo de equipos", "gestion de equipos", "team management"),
  s("teamwork", "Trabajo en equipo", "teamwork", "colaboracion", "collaboration", "trabajo colaborativo"),
  s("problem-solving", "Resolución de problemas", "problem solving", "resolucion de problemas", "pensamiento analitico", "analytical thinking", "pensamiento critico", "critical thinking"),
  s("adaptability", "Adaptabilidad", "adaptability", "flexibilidad", "flexibility"), s("time-mgmt", "Gestión del tiempo", "time management", "gestion del tiempo", "priorizacion"),
  s("negotiation", "Negociación", "negotiation", "negociacion"), s("autonomy", "Autonomía", "autonomia", "self-starter", "proactividad", "proactivo", "proactive", "ownership"),
  s("stakeholders", "Gestión de stakeholders", "stakeholder management", "relacion con stakeholders", "partes interesadas"),
  s("presentation", "Presentaciones", "presentation skills", "presentaciones ejecutivas", "public speaking", "hablar en publico"), s("mentoring", "Mentoría", "mentoring", "mentoria", "coaching"),
  s("creativity", "Creatividad", "creativity", "pensamiento creativo"), s("detail", "Atención al detalle", "attention to detail", "atencion al detalle"),
  // Certificaciones
  c("pmp", "PMP", "project management professional"), c("scrum-cert", "Scrum Master", "psm", "csm", "certified scrum master"), c("aws-cert", "AWS Certified", "aws certified", "certificacion aws"),
  c("azure-cert", "Azure Certified", "az-900", "az-104", "microsoft certified"), c("gcp-cert", "Google Cloud Certified", "google cloud certified"), c("itil", "ITIL"),
  c("cisa", "CISA"), c("cissp", "CISSP"), c("cpa", "CPA", "contador publico"), c("cfa", "CFA"), c("ccna", "CCNA", "cisco certified"), c("six-sigma-cert", "Six Sigma", "green belt", "black belt"),
  c("toefl", "TOEFL"), c("ielts", "IELTS"), c("cambridge", "Cambridge English", "fce", "cae"),
  // Dominios / industrias
  d("fintech", "Fintech", "servicios financieros", "financial services", "banca", "banking", "seguros", "insurance"),
  d("ecommerce", "E-commerce", "comercio electronico", "marketplace", "retail online"), d("retail", "Retail", "comercio minorista"),
  d("saas", "SaaS", "software como servicio", "b2b saas"), d("health", "Salud", "healthcare industry", "healthtech", "farmaceutica", "pharma"),
  d("edtech", "Educación", "edtech", "educacion", "education"), d("logistics-industry", "Transporte y logística", "transporte", "transportation", "last mile"),
  d("manufacturing", "Manufactura", "manufacturing"), d("energy", "Energía", "energy", "oil & gas", "petroleo", "mineria", "mining"),
  d("real-estate", "Inmobiliario", "real estate", "bienes raices", "construccion", "construction"), d("telecom", "Telecomunicaciones", "telecom", "telecomunicaciones"),
  d("media", "Medios y entretenimiento", "entretenimiento", "gaming", "videojuegos"), d("public-sector", "Sector público", "gobierno", "government", "ong", "nonprofit"),
]

/** Nombres que también son palabras comunes (swift, notion, slack…): solo cuentan si aparecen con su mayúscula inicial. */
export const CASE_SENSITIVE = new Set(["swift", "notion", "slack", "sketch", "rust", "ruby", "scala", "flask", "looker"])

export const SKILL_BY_ID = new Map(SKILLS.map((x) => [x.id, x]))
