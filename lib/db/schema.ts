import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uuid, vector } from "drizzle-orm/pg-core"

/**
 * Esquema de Supabase (Postgres). La fuente de verdad del DDL son los archivos de `db/migrations/`; esto es su reflejo tipado.
 * Todas las tablas tienen RLS activo: el servidor entra con la conexión directa (rol postgres, que ignora RLS) y el navegador
 * solo puede LEER las ofertas activas.
 */
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" })

/** Memoria de preferencias. NO es entrenamiento del modelo: son decisiones y reglas que se inyectan en el prompt de reescritura. */
export const decisions = pgTable(
  "decisions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    /** clave estable (oferta + cambio): si el usuario cambia de opinión se actualiza la fila, no se duplica */
    ref: text("ref").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    /** cambiar | quitar | añadir */
    kind: text("kind").notNull(),
    section: text("section").notNull(),
    risk: text("risk").notNull(),
    original: text("original").notNull(),
    proposal: text("proposal").notNull(),
    /** aceptado | rechazado | editado */
    decision: text("decision").notNull(),
    editedText: text("edited_text"),
    /** motivo opcional escrito por la persona */
    reason: text("reason"),
    /** motivo que dio el sistema al proponer el cambio */
    changeReason: text("change_reason"),
    offerTitle: text("offer_title"),
    language: text("language"),
  },
  (t) => [index("decisions_kind_updated_idx").on(t.kind, t.updatedAt.desc())],
)

export const rules = pgTable("rules", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  text: text("text").notNull(),
  /** aprendida (resumida por el modelo) | manual (escrita o editada por la persona: no se pisa) */
  source: text("source").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
})

export const meta = pgTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
})

/** Ofertas de empleo (tarjetas del buscador). La columna generada `search` (tsvector) vive solo en la base. */
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceUrl: text("source_url").notNull().unique(),
  sourceName: text("source_name").notNull().default("manual"),
  title: text("title").notNull(),
  company: text("company"),
  locationText: text("location_text"),
  /** ISO 3166-1 alfa-2 (CO, MX, AR, US, ES…); null si es remota sin país */
  country: text("country"),
  /** regiones en las que se puede postular: LATAM, CO, MX… */
  regions: text("regions").array().notNull().default([]),
  workMode: text("work_mode"),
  remoteScope: text("remote_scope"),
  employmentType: text("employment_type"),
  seniority: text("seniority"),
  language: text("language"),
  /** oferta estructurada (esquema Offer) */
  offer: jsonb("offer").notNull(),
  skills: text("skills").array().notNull().default([]),
  postedAt: ts("posted_at"),
  validThrough: ts("valid_through"),
  /** cómo se postula: { method, platform?, url?, email? } */
  apply: jsonb("apply"),
  /** salario si la fuente lo dice con moneda explícita: { min?, max?, currency, period } */
  salary: jsonb("salary"),
  /** de qué fuente viene (`getonboard`, `greenhouse:cabify`…); null si la cargó Juan a mano */
  sourceKey: text("source_key"),
  externalId: text("external_id"),
  /** última sincronización en que la fuente devolvió esta oferta (si deja de aparecer, se marca cerrada) */
  lastSeenAt: ts("last_seen_at"),
  /** título|empresa|país normalizados, para no repetir la misma oferta que llega de dos fuentes */
  dedupeKey: text("dedupe_key"),
  /** familia de cargo (`desarrollo`, `datos`, `diseno-digital`, `ventas`…; ver lib/jobs/classify.ts) */
  roleFamily: text("role_family"),
  /** true si la familia es de tecnología: activa el filtro «Tecnología» */
  isTech: boolean("is_tech").notNull().default(false),
  /** manual = cargada en el panel; feed = traída por una fuente */
  origin: text("origin").notNull().default("manual"),
  status: text("status").notNull().default("activa"),
  embedding: vector("embedding", { dimensions: 1024 }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
})

/** Empresas cuyo tablero de empleo (Greenhouse, Lever, Ashby) se sincroniza (directorio de fuentes). */
export const sourceCompanies = pgTable(
  "source_companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ats: text("ats").notNull(),
    token: text("token").notNull(),
    name: text("name"),
    active: boolean("active").notNull().default(true),
    note: text("note"),
    lastSyncedAt: ts("last_synced_at"),
    lastStatus: text("last_status"),
    lastCount: integer("last_count"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [unique("source_companies_ats_token_key").on(t.ats, t.token)],
)

/** Consentimientos de medición (un registro por decisión; el vigente es el último). Ver docs/CONSENTIMIENTO.md. */
export const consentLog = pgTable(
  "consent_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    anonId: uuid("anon_id").notNull(),
    version: text("version").notNull(),
    personal: boolean("personal").notNull(),
    aggregate: boolean("aggregate").notNull(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("consent_log_anon_idx").on(t.anonId, t.at.desc())],
)

/** Eventos de uso, solo con consentimiento. `personal` = puede ordenar SUS resultados; `aggregate` = puede entrar a estadísticas anónimas. */
export const events = pgTable(
  "events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    anonId: uuid("anon_id").notNull(),
    at: ts("at").notNull().defaultNow(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull().default({}),
    personal: boolean("personal").notNull().default(false),
    aggregate: boolean("aggregate").notNull().default(false),
  },
  (t) => [index("events_anon_at_idx").on(t.anonId, t.at.desc()), index("events_kind_at_idx").on(t.kind, t.at.desc()), index("events_at_idx").on(t.at)],
)

/** Cola de enriquecimiento con IA: el texto original se guarda solo hasta procesarlo y se borra al terminar. */
export const jobEnrichment = pgTable(
  "job_enrichment",
  {
    jobId: uuid("job_id").primaryKey(),
    contentHash: text("content_hash").notNull(),
    text: text("text"),
    status: text("status").notNull().default("pendiente"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    queuedAt: ts("queued_at").notNull().defaultNow(),
    processedAt: ts("processed_at"),
    ms: integer("ms"),
  },
  (t) => [index("job_enrichment_status_idx").on(t.status, t.queuedAt)],
)

/** Registro de la sincronización automática (una fila por fuente y por corrida). */
export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    target: text("target").notNull(),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    ok: boolean("ok").notNull().default(false),
    fetched: integer("fetched").notNull().default(0),
    created: integer("created").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    closed: integer("closed").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("sync_runs_target_idx").on(t.target, t.startedAt)],
)

/** Candado de la sincronización (una corrida a la vez); caduca solo. */
export const syncLocks = pgTable("sync_locks", {
  name: text("name").primaryKey(),
  holder: text("holder").notNull(),
  lockedUntil: ts("locked_until").notNull(),
})

/** Catálogo de fuentes de ofertas: datos para mostrar, atribución, interruptor «activa» y cadencia propia (ver migración 0013). */
export const sources = pgTable("sources", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  homeUrl: text("home_url"),
  description: text("description").notNull().default(""),
  attribution: text("attribution").notNull().default(""),
  cadenceHours: integer("cadence_hours"),
  active: boolean("active").notNull().default(true),
  termsReviewedOn: text("terms_reviewed_on"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
})

/** Foto diaria por fuente (tendencias y calidad); ver migración 0014. */
export const sourceDailyStats = pgTable(
  "source_daily_stats",
  {
    day: text("day").notNull(),
    sourceKey: text("source_key").notNull(),
    activeOffers: integer("active_offers").notNull().default(0),
    techOffers: integer("tech_offers").notNull().default(0),
    salaryOffers: integer("salary_offers").notNull().default(0),
    remoteOffers: integer("remote_offers").notNull().default(0),
    structuredOffers: integer("structured_offers").notNull().default(0),
    avgAgeDays: text("avg_age_days"),
    runs: integer("runs").notNull().default(0),
    runsOk: integer("runs_ok").notNull().default(0),
    fetched: integer("fetched").notNull().default(0),
    added: integer("added").notNull().default(0),
    closed: integer("closed").notNull().default(0),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("source_daily_stats_pk").on(t.day, t.sourceKey)],
)

/** Perfil de la persona (migración 0016). `id` es el usuario de Supabase Auth. */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  /** ISO 3166-1 de dos letras */
  country: text("country").notNull(),
  roleInterests: text("role_interests").array().notNull().default([]),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
})

/** Dispositivos con sesión (migración 0016): una fila por sesión de navegador. */
export const trustedDevices = pgTable(
  "trusted_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    /** «Mantener sesión iniciada» marcado */
    remember: boolean("remember").notNull().default(false),
    label: text("label").notNull().default(""),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("trusted_devices_user_idx").on(t.userId, t.lastSeenAt)],
)
