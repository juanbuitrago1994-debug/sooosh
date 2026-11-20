import { readFileSync } from "node:fs"
import path from "node:path"
import { sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"
import type { Db } from "@/lib/db"
import { createTestDb } from "@/lib/db/testing"
import { activeTrend, snapshotSourceStats } from "@/lib/sources/snapshots"

// `jobs` real usa pgvector (no disponible en PGlite): aquí va una versión mínima con las columnas que lee la foto.
const JOBS = `create table public.jobs (
  id serial primary key, source_key text, status text not null default 'activa', is_tech boolean not null default false,
  salary jsonb, work_mode text, offer jsonb not null default '{}', posted_at timestamptz, created_at timestamptz not null default now())`

const row = (sourceKey: string, o: { tech?: boolean; salary?: boolean; mode?: string; items?: number; status?: string; ageDays?: number } = {}) =>
  sql`insert into public.jobs (source_key, status, is_tech, salary, work_mode, offer, created_at) values (${sourceKey}, ${o.status ?? "activa"}, ${o.tech ?? false}, ${o.salary ? sql`'{"min":1}'::jsonb` : null}, ${o.mode ?? null},
    ${JSON.stringify({ requirements: Array.from({ length: o.items ?? 0 }, (_, i) => `r${i}`), responsibilities: [], niceToHave: [] })}::jsonb, now() - make_interval(days => ${o.ageDays ?? 0}))`

describe("foto diaria por fuente", () => {
  let db: Db
  const run = (q: ReturnType<typeof sql>) => (db as unknown as { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> }).execute(q)
  beforeEach(async () => {
    db = await createTestDb()
    const client = (db as unknown as { $client: { exec: (q: string) => Promise<unknown> } }).$client
    await client.exec(JOBS)
    await client.exec(readFileSync(path.join(process.cwd(), "db/migrations/0011_sync_runs.sql"), "utf8"))
  })

  it("agrupa las empresas de los 7 sistemas en «companies» y cuenta bien tecnología, salario, remotas y completas; ignora cerradas", async () => {
    await run(row("getonboard", { tech: true, salary: true, mode: "remoto", items: 3, ageDays: 2 }))
    await run(row("getonboard", { items: 0, ageDays: 4 }))
    await run(row("getonboard", { status: "cerrada", tech: true }))
    await run(row("greenhouse:acme", { tech: true, items: 2 }))
    await run(row("ashby:mural", { tech: true, items: 5 }))
    await run(row("workable:platzi", {}))
    await run(row("remote:jobicy", { mode: "remoto", items: 1 }))
    expect(await snapshotSourceStats(db)).toBe(3)

    const r = (await run(sql`select source_key, active_offers, tech_offers, salary_offers, remote_offers, structured_offers, avg_age_days::float as age from public.source_daily_stats order by source_key`)).rows
    const by = Object.fromEntries(r.map((x) => [x.source_key as string, x]))
    expect(by.getonboard).toMatchObject({ active_offers: 2, tech_offers: 1, salary_offers: 1, remote_offers: 1, structured_offers: 1 })
    expect(by.getonboard.age).toBeCloseTo(3, 0)
    expect(by.companies).toMatchObject({ active_offers: 3, tech_offers: 2, structured_offers: 2 })
    expect(by["remote:jobicy"]).toMatchObject({ active_offers: 1, remote_offers: 1, structured_offers: 0 })
  })

  it("las lecturas del día salen de sync_runs, y repetir la foto sobrescribe la fila (no duplica)", async () => {
    await run(row("getonboard", {}))
    await run(sql`insert into public.sync_runs (target, ok, fetched, created, updated, closed, finished_at) values ('getonboard', true, 976, 18, 955, 20, now()), ('getonboard', false, 0, 0, 0, 0, now()), ('getonboard', true, 10, 2, 8, 1, now() - interval '3 days')`)
    await snapshotSourceStats(db)
    await run(row("getonboard", {}))
    await snapshotSourceStats(db)
    const r = (await run(sql`select count(*)::int as n, max(active_offers) as active, max(runs) as runs, max(runs_ok) as ok, max(fetched) as fetched, max(added) as added, max(closed) as closed from public.source_daily_stats`)).rows[0]
    expect(r).toMatchObject({ n: 1, active: 2, runs: 2, ok: 1, fetched: 976, added: 18, closed: 20 })
  })

  it("la tendencia devuelve los días en orden por fuente y se limita a la ventana pedida", async () => {
    await run(sql`insert into public.source_daily_stats (day, source_key, active_offers) values ((now() at time zone 'utc')::date - 40, 'getonboard', 900), ((now() at time zone 'utc')::date - 2, 'getonboard', 950), ((now() at time zone 'utc')::date - 1, 'getonboard', 960), ((now() at time zone 'utc')::date, 'getonboard', 975)`)
    const t = (await activeTrend(db, 30)).get("getonboard")!
    expect(t.map((x) => x.n)).toEqual([950, 960, 975])
    expect(t[0].day < t[2].day).toBe(true)
  })
})
