import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import type { Db } from "@/lib/db"
import { createTestDb } from "@/lib/db/testing"
import { jobs } from "@/lib/db/schema"
import { mapGetOnBoardJob } from "@/lib/sources/adapters/getonboard"
import { ingest, type IngestItem } from "@/lib/sources/ingest"
import { dedupeKey, externalToDraft } from "@/lib/sources/normalize"

const gob = JSON.parse(readFileSync(path.join(__dirname, "fixtures/sources/getonboard.json"), "utf8"))

/** Una oferta de la fuente de prueba con otro título y otro enlace (misma empresa y país). */
function item(title: string, n: number): IngestItem {
  const base = externalToDraft(mapGetOnBoardJob(gob.data[0])!)!
  const draft = { ...base.draft, title, sourceUrl: `https://example.com/oferta-${n}` }
  return { draft, dedupe: dedupeKey(title, draft.company, draft.country), externalId: String(n) }
}
const opts = () => ({ closeMissing: false, startedAt: new Date() })

describe("clave de duplicados: los signos que cambian el puesto", () => {
  it("«C++», «C#» y «C» son puestos distintos de la misma empresa (antes daban la misma clave)", () => {
    const keys = ["Desarrollador C++", "Desarrollador C#", "Desarrollador C"].map((t) => dedupeKey(t, "Acme", "CO"))
    expect(new Set(keys).size).toBe(3)
    expect(keys[0]).toBe("desarrollador cplusplus|acme|co")
    expect(keys[1]).toBe("desarrollador csharp|acme|co")
  })
  it("F#, .NET y Node.js también se distinguen de sus parecidos", () => {
    expect(dedupeKey("Ingeniero F#", "Acme", "CO")).not.toBe(dedupeKey("Ingeniero F", "Acme", "CO"))
    expect(dedupeKey("Ingeniero Node.js", "Acme", "CO")).not.toBe(dedupeKey("Ingeniero Node", "Acme", "CO"))
    expect(dedupeKey("Ingeniero .NET", "Acme", "CO")).not.toBe(dedupeKey("Ingeniero", "Acme", "CO"))
  })
  it("lo que SÍ es la misma oferta sigue dando la misma clave: tildes, mayúsculas, signos sueltos y separadores", () => {
    expect(dedupeKey("Desarrollador C++ (Sr.)", "Acme S.A.", "CO")).toBe(dedupeKey("DESARROLLADOR  c++  Sr", "acme s a", "CO"))
    expect(dedupeKey("Diseñador UX/UI", "Acme", "CO")).toBe(dedupeKey("Disenador UX UI", "Acme", "CO"))
    expect(dedupeKey("Analista de Datos", "Acme", undefined)).toBe("analista de datos|acme|")
  })
  it("las claves que ya funcionaban no cambian (las filas guardadas siguen reconociéndose)", () => {
    expect(dedupeKey("Ingeniero de Datos (Sr.)", "Acme S.A.", "CO")).toBe("ingeniero de datos sr|acme s a|co")
    expect(dedupeKey("Diseñador UX", undefined, undefined)).toBe("disenador ux||")
  })
})

describe("ingesta entre fuentes (base de pruebas): una oferta distinta no se omite por parecerse a otra", () => {
  let db: Db
  beforeEach(async () => {
    db = await createTestDb()
    // `jobs` real usa pgvector (no disponible en PGlite): versión con TODAS las columnas que lee y escribe `ingest` (el vector, como texto).
    await (db as unknown as { $client: { exec: (q: string) => Promise<unknown> } }).$client.exec(`create table public.jobs (
      id uuid primary key default gen_random_uuid(), source_url text not null unique, source_name text not null default 'manual', title text not null, company text, location_text text,
      country text, regions text[] not null default '{}', work_mode text, remote_scope text, employment_type text, seniority text, language text, offer jsonb not null,
      skills text[] not null default '{}', posted_at timestamptz, valid_through timestamptz, apply jsonb, salary jsonb, source_key text, external_id text, last_seen_at timestamptz,
      dedupe_key text, role_family text, is_tech boolean not null default false, origin text not null default 'manual', status text not null default 'activa', embedding text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now())`)
  })

  it("el «C#» de una fuente entra aunque otra fuente ya tenga el «C++» de la misma empresa", async () => {
    await ingest(db, "fuente-a", [item("Desarrollador C++", 1)], opts())
    const r = await ingest(db, "fuente-b", [item("Desarrollador C#", 2)], opts())
    expect(r.duplicates).toBe(0)
    expect(r.created).toBe(1)
    expect((await db.select({ t: jobs.title }).from(jobs)).map((x) => x.t).sort()).toEqual(["Desarrollador C#", "Desarrollador C++"])
  })

  it("la MISMA oferta publicada en dos fuentes sí se detecta como duplicada y no se guarda dos veces", async () => {
    await ingest(db, "fuente-a", [item("Desarrollador C++", 1)], opts())
    const r = await ingest(db, "fuente-b", [item("Desarrollador C++", 2)], opts())
    expect(r.duplicates).toBe(1)
    expect(r.created).toBe(0)
    expect(await db.select({ t: jobs.title }).from(jobs)).toHaveLength(1)
  })
})
